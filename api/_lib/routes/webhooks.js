import { createHash } from 'node:crypto';
import { handleError, requireEnv, sendJson } from '../http.js';
import { normalizeKhqrpayStatus } from '../khqrpay.js';
import { applyPaymentEvent } from '../payments.js';
import { verifyKhqrpaySignature } from '../webhook-signature.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error('Webhook payload exceeds the allowed size.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  try {
    requireEnv(['KHQRPAY_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const rawBody = await readRawBody(req);
    if (!verifyKhqrpaySignature(rawBody, req.headers, process.env.KHQRPAY_WEBHOOK_SECRET)) {
      return sendJson(res, 401, { error: 'Invalid khqrpay webhook signature.' });
    }
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return sendJson(res, 400, { error: 'Invalid webhook JSON.' });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return sendJson(res, 400, { error: 'Invalid webhook payload.' });
    }
    const rawTransactionId = payload.id ?? payload.transaction_id;
    const transactionId = rawTransactionId === undefined ? null : String(rawTransactionId);
    const status = normalizeKhqrpayStatus(payload.status);
    if (status === 'underpaid') {
      console.warn('khqrpay reported an underpaid transaction requiring manual review:', transactionId);
      return sendJson(res, 200, { received: true, processed: false, reason: 'underpaid_requires_review' });
    }
    if (!['paid', 'expired', 'failed'].includes(status) || !/^\d{12}$/.test(transactionId || '')) {
      return sendJson(res, 400, { error: 'Unsupported khqrpay webhook payload.' });
    }
    const amount = payload.amount;
    const currency = payload.currency || 'USD';
    if (amount === undefined || !/^\d+(?:\.\d{1,2})?$/.test(String(amount))) {
      return sendJson(res, 400, { error: 'khqrpay webhook has no valid amount.' });
    }
    const digest = createHash('sha256').update(rawBody).digest('hex');
    const event = `payment.${status}`;
    const result = await applyPaymentEvent({
      transactionId,
      amount: String(amount),
      currency,
      status,
      event,
      payload,
      dedupeKey: `${event}:${transactionId}:${digest}`,
    });
    return sendJson(res, 200, { received: true, processed: Boolean(result?.processed) });
  } catch (error) {
    return handleError(res, error);
  }
}
