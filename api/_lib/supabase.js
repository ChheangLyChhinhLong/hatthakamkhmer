import { createClient } from '@supabase/supabase-js';
import { createHttpError, getBearerToken, requireEnv } from './http.js';

let adminClient;

export function getAdminClient() {
  requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

export function getSupabaseAnonKey() {
  requireEnv(['SUPABASE_ANON_KEY']);
  return process.env.SUPABASE_ANON_KEY;
}

export async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) throw createHttpError(401, 'Sign in with Telegram before continuing.');
  const client = getAdminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw createHttpError(401, 'Your session is invalid or expired.');
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, display_name, role, telegram_id, telegram_username')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw createHttpError(403, 'Your account profile is not ready.');
  return { user: data.user, profile };
}

export async function requireAdmin(req) {
  const session = await requireUser(req);
  if (session.profile.role !== 'admin') throw createHttpError(403, 'Admin access is required.');
  const token = getBearerToken(req);
  let claims;
  try {
    claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    throw createHttpError(401, 'Your admin session is invalid. Sign in again.');
  }
  if (typeof claims.session_id !== 'string') {
    throw createHttpError(403, 'Admin OTP sign-in is required.', 'ADMIN_OTP_REQUIRED');
  }
  const { data: adminSession, error: sessionError } = await getAdminClient()
    .from('admin_auth_sessions')
    .select('session_id')
    .eq('session_id', claims.session_id)
    .eq('user_id', session.user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (sessionError) throw new Error(`Could not verify the admin OTP session: ${sessionError.message}`);
  if (!adminSession) throw createHttpError(403, 'Admin OTP sign-in is required.', 'ADMIN_OTP_REQUIRED');
  return session;
}
