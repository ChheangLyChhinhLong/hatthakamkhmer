import { createAdminOtp, hashAdminOtp } from '../admin-otp.js';
import { createHttpError, handleError, methodNotAllowed, readBody, requireEnv, sendJson } from '../http.js';
import { getAdminClient } from '../supabase.js';

const genericMessage = 'If this Telegram account is authorized, a sign-in code will be sent.';

async function writeAudit(client, telegramId, event) {
  const { error } = await client.from('admin_auth_audit').insert({ telegram_id: telegramId, event });
  if (error) throw new Error(`Could not record admin authentication activity: ${error.message}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    requireEnv(['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const body = readBody(req);
    const telegramId = String(body?.telegramId || '');
    if (!/^\d{1,20}$/.test(telegramId)) throw createHttpError(400, 'Enter a valid Telegram account ID.');

    const client = getAdminClient();
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('telegram_id')
      .eq('telegram_id', telegramId)
      .eq('role', 'admin')
      .maybeSingle();
    if (profileError) throw new Error(`Could not verify admin access: ${profileError.message}`);
    if (!profile) {
      return sendJson(res, 202, { message: genericMessage });
    }

    const code = createAdminOtp();
    const codeHash = hashAdminOtp(telegramId, code, process.env.TELEGRAM_BOT_TOKEN);
    const { data: issueResult, error: issueError } = await client.rpc('issue_admin_login_otp', {
      p_telegram_id: telegramId,
      p_code_hash: codeHash,
    });
    if (issueError) throw new Error(`Could not issue the admin sign-in code: ${issueError.message}`);
    if (issueResult === 'cooldown') {
      await writeAudit(client, telegramId, 'otp_request_cooldown');
      return sendJson(res, 429, { error: 'Please wait one minute before requesting another code.', retryAfter: 60 });
    }
    if (issueResult === 'rate_limited') {
      await writeAudit(client, telegramId, 'otp_request_rate_limited');
      return sendJson(res, 429, { error: 'Too many codes were requested. Try again in an hour.', retryAfter: 3600 });
    }
    if (issueResult !== 'sent') throw new Error('The database returned an unexpected OTP request status.');
    await writeAudit(client, telegramId, 'otp_send_requested');

    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: `Hatthakam Khmer admin sign-in code: ${code}\n\nThis code expires in 5 minutes. Never share it with anyone.`,
        protect_content: true,
      }),
    });
    const telegramResult = await response.json();
    if (!response.ok || !telegramResult.ok) {
      const { error: invalidateError } = await client.from('admin_login_otp_challenges')
        .update({ consumed_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (invalidateError) throw new Error(`Could not invalidate the undelivered admin code: ${invalidateError.message}`);
      await writeAudit(client, telegramId, 'otp_delivery_failed');
      console.error('Could not deliver the admin OTP through Telegram:', telegramResult.description || response.status);
      return sendJson(res, 502, {
        error: 'Telegram could not deliver the code. Open the bot and press Start, then try again in one minute.',
        retryAfter: 60,
      });
    }

    try {
      await writeAudit(client, telegramId, 'otp_sent');
    } catch (error) {
      const { error: invalidateError } = await client.from('admin_login_otp_challenges')
        .update({ consumed_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (invalidateError) {
        throw new Error(`Could not invalidate the unlogged admin code: ${invalidateError.message}`, { cause: error });
      }
      throw new Error('Could not record successful admin OTP delivery.', { cause: error });
    }
    return sendJson(res, 200, { message: 'A sign-in code was sent to your Telegram. It expires in 5 minutes.' });
  } catch (error) {
    return handleError(res, error);
  }
}
