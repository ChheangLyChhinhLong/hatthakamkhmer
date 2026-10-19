import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyKhpaySignature(rawBody, headers, secret) {
  const signature = headers['x-webhook-signature'] || headers['x-khpay-signature'];
  if (typeof signature !== 'string' || !/^(?:sha256=)?[a-f\d]{64}$/i.test(signature)) return false;
  const receivedHex = signature.replace(/^sha256=/i, '');
  const received = Buffer.from(receivedHex, 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return received.length === expected.length && timingSafeEqual(expected, received);
}
