import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { khqrpayRequest, normalizeKhqrpayStatus } from '../api/_lib/khqrpay.js';
import { verifyKhqrpaySignature } from '../api/_lib/webhook-signature.js';

const secret = 'test-webhook-secret';
const body = Buffer.from('{"event":"payment.update","id":847291036184,"status":"Paid","amount":5}');
const digest = createHmac('sha256', secret).update(body).digest('hex');

test('verifies the X-Webhook-Signature header with the sha256 prefix', () => {
  assert.equal(verifyKhqrpaySignature(body, { 'x-webhook-signature': `sha256=${digest}` }, secret), true);
});

test('rejects a modified request body', () => {
  assert.equal(verifyKhqrpaySignature(Buffer.from(`${body.toString()} `), { 'x-webhook-signature': digest }, secret), false);
});

test('rejects malformed, missing, and legacy provider signature headers', () => {
  assert.equal(verifyKhqrpaySignature(body, { 'x-webhook-signature': 'sha256=abc' }, secret), false);
  assert.equal(verifyKhqrpaySignature(body, { 'x-webhook-delivery': digest }, secret), false);
  assert.equal(verifyKhqrpaySignature(body, {}, secret), false);
});

test('sends khqrpay requests with Bearer auth, JSON, and idempotency headers', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.KHQRPAY_API_KEY;
  const originalBaseUrl = process.env.KHQRPAY_BASE_URL;
  let requestUrl;
  let requestOptions;
  process.env.KHQRPAY_API_KEY = 'test-api-key';
  delete process.env.KHQRPAY_BASE_URL;
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true, id: 847291036184, qr: 'raw-khqr' }),
    };
  };

  try {
    const result = await khqrpayRequest('/bakong/create', {
      method: 'POST',
      idempotencyKey: 'order-test',
      body: { amount: 10, webhook: 'https://shop.example/api/v1/webhooks' },
    });
    assert.equal(requestUrl, 'https://khqrpay.site/api/v1/bakong/create');
    assert.equal(requestOptions.headers.Authorization, `Bearer ${process.env.KHQRPAY_API_KEY}`);
    assert.equal(requestOptions.headers['Idempotency-Key'], 'order-test');
    assert.deepEqual(JSON.parse(requestOptions.body), {
      amount: 10,
      webhook: 'https://shop.example/api/v1/webhooks',
    });
    assert.equal(result.id, 847291036184);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KHQRPAY_API_KEY;
    else process.env.KHQRPAY_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.KHQRPAY_BASE_URL;
    else process.env.KHQRPAY_BASE_URL = originalBaseUrl;
  }
});

test('reports khqrpay API failures', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.KHQRPAY_API_KEY;
  process.env.KHQRPAY_API_KEY = 'test-api-key';
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    headers: { get: () => null },
    json: async () => ({ ok: false, error: 'invalid_amount', msg: 'Amount is invalid.' }),
  });
  try {
    await assert.rejects(() => khqrpayRequest('/aba/create'), /Amount is invalid/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KHQRPAY_API_KEY;
    else process.env.KHQRPAY_API_KEY = originalKey;
  }
});

test('refuses API base URLs outside the documented HTTPS host', async () => {
  const originalKey = process.env.KHQRPAY_API_KEY;
  const originalBaseUrl = process.env.KHQRPAY_BASE_URL;
  process.env.KHQRPAY_API_KEY = 'test-api-key';
  process.env.KHQRPAY_BASE_URL = 'https://attacker.example/api/v1';
  try {
    await assert.rejects(() => khqrpayRequest('/aba/create'), /documented HTTPS khqrpay.site API host/);
  } finally {
    if (originalKey === undefined) delete process.env.KHQRPAY_API_KEY;
    else process.env.KHQRPAY_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.KHQRPAY_BASE_URL;
    else process.env.KHQRPAY_BASE_URL = originalBaseUrl;
  }
});

test('normalizes documented status values and leaves UnderPaid uncredited', () => {
  assert.equal(normalizeKhqrpayStatus('Paid'), 'paid');
  assert.equal(normalizeKhqrpayStatus('Pending'), 'pending');
  assert.equal(normalizeKhqrpayStatus('Expired'), 'expired');
  assert.equal(normalizeKhqrpayStatus('UnderPaid'), 'underpaid');
  assert.equal(normalizeKhqrpayStatus('success'), null);
});
