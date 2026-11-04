import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminOtp, hashAdminOtp } from '../api/_lib/admin-otp.js';

test('creates a six-digit admin OTP', () => {
  const code = createAdminOtp();
  assert.match(code, /^\d{6}$/);
});

test('binds the stored OTP digest to the account and bot secret', () => {
  const digest = hashAdminOtp('123456789', '123456', 'test-bot-token');
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, hashAdminOtp('123456789', '123456', 'test-bot-token'));
  assert.notEqual(digest, hashAdminOtp('987654321', '123456', 'test-bot-token'));
  assert.notEqual(digest, hashAdminOtp('123456789', '123457', 'test-bot-token'));
  assert.notEqual(digest, hashAdminOtp('123456789', '123456', 'different-bot-token'));
});
