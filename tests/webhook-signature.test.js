import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { khpayRequest, normalizeGatewayStatus } from '../api/_lib/khpay.js';
import { verifyKhpaySignature } from '../api/_lib/webhook-signature.js';

const secret = 'test-webhook-secret';
const body = Buffer.from('{"event":"payment.paid","data":{"transaction_id":"tx-123"}}');
const digest = createHmac('sha256', secret).update(body).digest('hex');

test('verifies the X-Webhook-Signature header with the sha256 prefix', () => {
  assert.equal(verifyKhpaySignature(body, { 'x-webhook-signature': `sha256=${digest}` }, secret), true);
});

test('verifies the alternate KHPay signature header without a prefix', () => {
  assert.equal(verifyKhpaySignature(body, { 'x-khpay-signature': digest }, secret), true);
});

test('rejects a modified request body', () => {
  assert.equal(verifyKhpaySignature(Buffer.from(`${body.toString()} `), { 'x-webhook-signature': digest }, secret), false);
});

test('rejects malformed signatures and absent signature headers', () => {
  assert.equal(verifyKhpaySignature(body, { 'x-webhook-signature': 'sha256=abc' }, secret), false);
  assert.equal(verifyKhpaySignature(body, {}, secret), false);
});

test('sends KHPay requests with Bearer auth, JSON, and idempotency headers', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.KHPAY_API_KEY;
  const originalBaseUrl = process.env.KHPAY_BASE_URL;
  let requestUrl;
  let requestOptions;
  process.env.KHPAY_API_KEY = 'test-api-key';
  delete process.env.KHPAY_BASE_URL;
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ success: true, data: { transaction_id: 'tx-123' } }),
    };
  };

  try {
    const result = await khpayRequest('/qr/generate', {
      method: 'POST',
      idempotencyKey: 'order-test',
      body: { amount: '10.00', currency: 'USD' },
    });
    assert.equal(requestUrl, 'https://khpay.site/api/v1/qr/generate');
    assert.equal(requestOptions.headers.Authorization, 'Bearer test-api-key');
    assert.equal(requestOptions.headers['Idempotency-Key'], 'order-test');
    assert.deepEqual(JSON.parse(requestOptions.body), { amount: '10.00', currency: 'USD' });
    assert.equal(result.transaction_id, 'tx-123');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KHPAY_API_KEY;
    else process.env.KHPAY_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.KHPAY_BASE_URL;
    else process.env.KHPAY_BASE_URL = originalBaseUrl;
  }
});

test('refuses KHPay API base URLs outside the documented HTTPS host', async () => {
  const originalKey = process.env.KHPAY_API_KEY;
  const originalBaseUrl = process.env.KHPAY_BASE_URL;
  process.env.KHPAY_API_KEY = 'test-api-key';
  process.env.KHPAY_BASE_URL = 'https://attacker.example/api/v1';
  try {
    await assert.rejects(() => khpayRequest('/qr/generate'), /documented HTTPS KHPay API host/);
  } finally {
    if (originalKey === undefined) delete process.env.KHPAY_API_KEY;
    else process.env.KHPAY_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.KHPAY_BASE_URL;
    else process.env.KHPAY_BASE_URL = originalBaseUrl;
  }
});

test('normalizes only documented terminal and pending payment states', () => {
  assert.equal(normalizeGatewayStatus('PAID'), 'paid');
  assert.equal(normalizeGatewayStatus('pending'), 'pending');
  assert.equal(normalizeGatewayStatus('success'), null);
});
