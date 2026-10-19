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
  return session;
}
