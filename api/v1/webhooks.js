import { createHash } from 'node:crypto';
import { handleError, requireEnv, sendJson } from '../_lib/http.js';
import { applyPaymentEvent } from '../_lib/payments.js';
import { verifyKhpaySignature } from '../_lib/webhook-signature.js';

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
    requireEnv(['KHPAY_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const rawBody = await readRawBody(req);
    if (!verifyKhpaySignature(rawBody, req.headers, process.env.KHPAY_WEBHOOK_SECRET)) {
      return sendJson(res, 401, { error: 'Invalid KHPay webhook signature.' });
    }
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return sendJson(res, 400, { error: 'Invalid webhook JSON.' });
    }
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const transactionId = data.transaction_id || payload.transaction_id;
    const event = payload.event;
    const status = event === 'payment.paid' ? 'paid'
      : event === 'payment.expired' ? 'expired'
        : event === 'payment.failed' ? 'failed' : null;
    if (!status || typeof transactionId !== 'string') {
      return sendJson(res, 400, { error: 'Unsupported KHPay event payload.' });
    }
    const amount = data.amount ?? payload.amount;
    const currency = data.currency || payload.currency;
    if (amount === undefined || !/^\d+(?:\.\d{1,2})?$/.test(String(amount)) || !currency) {
      return sendJson(res, 400, { error: 'KHPay event has no valid amount or currency.' });
    }
    const digest = createHash('sha256').update(rawBody).digest('hex');
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
