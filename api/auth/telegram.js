import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { createHttpError, handleError, methodNotAllowed, readBody, requireEnv, sendJson } from '../_lib/http.js';
import { getAdminClient } from '../_lib/supabase.js';

function verifyTelegramLogin(payload, botToken) {
  if (!payload || typeof payload !== 'object' || typeof payload.hash !== 'string') return false;
  const authDate = Number(payload.auth_date);
  if (!Number.isInteger(authDate) || Math.abs(Date.now() / 1000 - authDate) > 300) return false;

  const entries = Object.entries(payload)
    .filter(([key, value]) => key !== 'hash' && typeof value !== 'object' && value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const checkString = entries.join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(checkString).digest();
  let received;
  try {
    received = Buffer.from(payload.hash, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(expected, received);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    requireEnv(['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const body = readBody(req);
    if (!verifyTelegramLogin(body, process.env.TELEGRAM_BOT_TOKEN)) {
      throw createHttpError(401, 'Telegram verification failed or expired. Please sign in again.');
    }
    if (!/^\d{1,20}$/.test(String(body.id))) throw createHttpError(400, 'Invalid Telegram account.');

    const displayName = [body.first_name, body.last_name].filter((part) => typeof part === 'string').join(' ').trim().slice(0, 160);
    const userMetadata = {
      telegram_id: String(body.id),
      telegram_username: typeof body.username === 'string' ? body.username.slice(0, 64) : '',
      display_name: displayName,
    };
    const email = `telegram-${body.id}@telegram.hatthakamkhmer.com`;
    const client = getAdminClient();
    const { data, error } = await client.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { data: userMetadata },
    });
    if (error || !data?.properties?.hashed_token || !data.user) {
      throw new Error(`Could not create the Telegram session: ${error?.message || 'Supabase did not return a one-time token.'}`);
    }

    const { error: profileError } = await client.from('profiles').upsert({
      id: data.user.id,
      telegram_id: String(body.id),
      telegram_username: userMetadata.telegram_username,
      display_name: displayName,
    }, { onConflict: 'id' });
    if (profileError) throw new Error(`Could not save the Telegram profile: ${profileError.message}`);

    return sendJson(res, 200, { tokenHash: data.properties.hashed_token });
  } catch (error) {
    return handleError(res, error);
  }
}
