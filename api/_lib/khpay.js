import { createHttpError, requireEnv } from './http.js';

export async function khpayRequest(path, { method = 'GET', body, idempotencyKey, signal } = {}) {
  requireEnv(['KHPAY_API_KEY']);
  const baseUrl = (process.env.KHPAY_BASE_URL || 'https://khpay.site/api/v1').replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, '')}`);
  if (url.protocol !== 'https:' || url.hostname !== 'khpay.site') {
    throw createHttpError(500, 'KHPAY_BASE_URL must use the documented HTTPS KHPay API host.');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.KHPAY_API_KEY}`,
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
    throw createHttpError(502, `KHPay returned a non-JSON response${requestId ? ` (request ${requestId})` : ''}.`);
  }

  if (!response.ok || result.success === false) {
    const error = createHttpError(
      response.status >= 400 && response.status < 500 ? 502 : 503,
      `KHPay could not process the payment${result.error ? `: ${result.error}` : ''}${requestId ? ` (request ${requestId})` : ''}.`,
      result.error_code || result.code,
    );
    error.providerStatus = response.status;
    throw error;
  }
  return result.data;
}

export function normalizeGatewayStatus(value) {
  const status = String(value || '').toLowerCase();
  return ['paid', 'expired', 'failed', 'pending'].includes(status) ? status : null;
}
