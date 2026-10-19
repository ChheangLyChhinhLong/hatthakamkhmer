import { createHttpError } from './http.js';
import { getAdminClient } from './supabase.js';
import { dispatchTelegramOutbox } from './telegram.js';

export async function applyPaymentEvent({
  transactionId,
  amount,
  currency,
  status,
  event,
  payload,
  dedupeKey,
}) {
  const client = getAdminClient();
  const { data, error } = await client.rpc('apply_khpay_event', {
    p_transaction_id: transactionId,
    p_amount: amount,
    p_currency: currency,
    p_status: status,
    p_event: event,
    p_payload: payload,
    p_dedupe_key: dedupeKey,
    p_admin_chat_id: process.env.TELEGRAM_ADMIN_GROUP_ID || null,
  });
  if (error) {
    console.error('KHPay payment event was not applied:', error.message);
    throw createHttpError(400, 'The payment notification did not match a valid pending order.');
  }
  if (data?.processed && status === 'paid') {
    try {
      const deliveries = await dispatchTelegramOutbox();
      const failed = deliveries.filter((delivery) => !delivery.sent);
      if (failed.length) console.error(`${failed.length} Telegram payment notification(s) need retry.`);
    } catch (notificationError) {
      console.error('Payment was applied, but Telegram notifications remain queued:', notificationError.message);
    }
  }
  return data;
}
