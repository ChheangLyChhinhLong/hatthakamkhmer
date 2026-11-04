import { createHmac, randomInt } from 'node:crypto';

export function createAdminOtp() {
  return String(randomInt(100000, 1000000));
}

export function hashAdminOtp(telegramId, code, botToken) {
  return createHmac('sha256', botToken)
    .update(`${telegramId}:${code}`)
    .digest('hex');
}

export function getJwtClaims(accessToken) {
  const payload = accessToken.split('.')[1];
  if (!payload) throw new Error('Supabase did not return a valid access token.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
