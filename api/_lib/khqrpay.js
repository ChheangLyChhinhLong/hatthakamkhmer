import { createHttpError, requireEnv } from './http.js';

export async function khqrpayRequest(path, { method = 'GET', body, idempotencyKey, signal } = {}) {
  requireEnv(['KHQRPAY_API_KEY']);
  const baseUrl = (process.env.KHQRPAY_BASE_URL || 'https://khqrpay.site/api/v1').replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, '')}`);
  if (url.protocol !== 'https:' || url.hostname !== 'khqrpay.site') {
    throw createHttpError(500, 'KHQRPAY_BASE_URL must use the documented HTTPS khqrpay.site API host.');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.KHQRPAY_API_KEY}`,
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  const requestId = response.headers.get('x-request-id');
  let result;
  try {
    result = await response.json();
  } catch {
    throw createHttpError(502, `khqrpay returned a non-JSON response${requestId ? ` (request ${requestId})` : ''}.`);
  }

  if (!response.ok || result.ok === false) {
    const message = result.error_text || result.msg || result.error;
    const error = createHttpError(
      response.status >= 400 && response.status < 500 ? 502 : 503,
      `khqrpay could not process the payment${message ? `: ${message}` : ''}${requestId ? ` (request ${requestId})` : ''}.`,
      result.error || result.code,
    );
    error.providerStatus = response.status;
    throw error;
  }
  return result;
}

export function normalizeKhqrpayStatus(value) {
  const status = String(value || '').toLowerCase();
  return ['paid', 'expired', 'failed', 'pending', 'underpaid'].includes(status) ? status : null;
}
