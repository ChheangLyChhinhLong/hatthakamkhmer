import { createClient } from '@supabase/supabase-js';
import { getJwtClaims, hashAdminOtp } from '../../_lib/admin-otp.js';
import { createHttpError, handleError, methodNotAllowed, readBody, requireEnv, sendJson } from '../../_lib/http.js';
import { getAdminClient, getSupabaseAnonKey } from '../../_lib/supabase.js';

async function writeAudit(client, telegramId, event) {
  const { error } = await client.from('admin_auth_audit').insert({ telegram_id: telegramId, event });
  if (error) throw new Error(`Could not record admin authentication activity: ${error.message}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    requireEnv(['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']);
    const body = readBody(req);
    const telegramId = String(body?.telegramId || '');
    const code = String(body?.code || '');
    if (!/^\d{1,20}$/.test(telegramId) || !/^\d{6}$/.test(code)) {
      throw createHttpError(400, 'Enter your Telegram account ID and the 6-digit code.');
    }

    const adminClient = getAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id,telegram_id')
      .eq('telegram_id', telegramId)
      .eq('role', 'admin')
      .maybeSingle();
    if (profileError) throw new Error(`Could not verify admin access: ${profileError.message}`);
    if (!profile) {
      throw createHttpError(401, 'The code is invalid or expired. Request a new code.');
    }

    const { data: verification, error: verificationError } = await adminClient.rpc('verify_admin_login_otp', {
      p_telegram_id: telegramId,
      p_code_hash: hashAdminOtp(telegramId, code, process.env.TELEGRAM_BOT_TOKEN),
    });
    if (verificationError) throw new Error(`Could not verify the admin sign-in code: ${verificationError.message}`);
    if (verification !== 'verified') {
      const auditEvent = ['invalid', 'expired', 'used', 'locked'].includes(verification)
        ? `otp_verify_${verification}`
        : 'otp_verify_invalid';
      await writeAudit(adminClient, telegramId, auditEvent);
      const message = verification === 'locked'
        ? 'Too many incorrect codes. Request a new code after the cooldown.'
        : 'The code is invalid or expired. Request a new code.';
      throw createHttpError(401, message);
    }

    const email = `telegram-${telegramId}@telegram.hatthakamkhmer.com`;
    const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkError || !link?.properties?.hashed_token || link.user?.id !== profile.id) {
      throw new Error(`Could not create an admin session: ${linkError?.message || 'Supabase did not return the expected admin account.'}`);
    }

    const authClient = createClient(process.env.SUPABASE_URL, getSupabaseAnonKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink',
    });
    if (authError || !authData.session?.access_token || !authData.session.refresh_token) {
      throw new Error(`Could not verify the one-time admin session: ${authError?.message || 'Supabase did not return a session.'}`);
    }

    const claims = getJwtClaims(authData.session.access_token);
    if (claims.sub !== profile.id || typeof claims.session_id !== 'string') {
      throw new Error('Supabase returned an unexpected admin session.');
    }
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const { error: sessionError } = await adminClient.from('admin_auth_sessions').insert({
      session_id: claims.session_id,
      user_id: profile.id,
      expires_at: expiresAt,
    });
    if (sessionError) throw new Error(`Could not register the admin session: ${sessionError.message}`);
    await writeAudit(adminClient, telegramId, 'otp_verified');

    return sendJson(res, 200, {
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
