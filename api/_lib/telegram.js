import { getAdminClient } from './supabase.js';
import { requireEnv } from './http.js';

export async function enqueueTelegram(client, { dedupeKey, chatId, message }) {
  if (!chatId) return;
  const { error } = await client.from('telegram_outbox').upsert({
    dedupe_key: dedupeKey,
    chat_id: String(chatId),
    message,
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  if (error) throw new Error(`Could not queue Telegram notification: ${error.message}`);
}

export async function dispatchTelegramOutbox(limit = 10) {
  requireEnv(['TELEGRAM_BOT_TOKEN']);
  const client = getAdminClient();
  const { data: messages, error } = await client.rpc('claim_telegram_outbox', { p_limit: limit });
  if (error) throw new Error(`Could not claim Telegram notifications: ${error.message}`);
  const results = [];

  for (const message of messages || []) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: message.chat_id, text: message.message, disable_web_page_preview: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.description || `Telegram HTTP ${response.status}`);
      const { error: updateError } = await client.from('telegram_outbox').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        lock_until: null,
        last_error: null,
      }).eq('id', message.id);
      if (updateError) throw new Error(`Message sent, but delivery status could not be saved: ${updateError.message}`);
      results.push({ id: message.id, sent: true });
    } catch (error) {
      console.error('Telegram notification delivery failed:', error.message);
      const { error: updateError } = await client.from('telegram_outbox').update({
        status: 'failed',
        lock_until: null,
        last_error: error.message.slice(0, 500),
      }).eq('id', message.id);
      if (updateError) console.error('Failed to record Telegram delivery failure:', updateError.message);
      results.push({ id: message.id, sent: false, error: error.message });
    }
  }
  return results;
}

export async function notifyNewOrder(order, profile) {
  const client = getAdminClient();
  const orderLabel = String(order.id).slice(0, 8);
  const message = `ការបញ្ជាទិញថ្មី · #${orderLabel}\nឈ្មោះ៖ ${order.customer_name}\nតម្លៃ៖ $${Number(order.total_usd).toFixed(2)} USD\nការទូទាត់៖ ${order.payment_method.toUpperCase()}\nទំនាក់ទំនង៖ ${order.phone}`;
  if (process.env.TELEGRAM_ADMIN_GROUP_ID) {
    await enqueueTelegram(client, { dedupeKey: `order-created:admin:${order.id}`, chatId: process.env.TELEGRAM_ADMIN_GROUP_ID, message });
  }
  if (profile.telegram_id) {
    await enqueueTelegram(client, {
      dedupeKey: `order-created:user:${order.id}`,
      chatId: profile.telegram_id,
      message: `អរគុណសម្រាប់ការបញ្ជាទិញ! លេខ #${orderLabel} · $${Number(order.total_usd).toFixed(2)} USD។ យើងកំពុងរៀបចំស្នាដៃរបស់អ្នក។`,
    });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('Telegram order notifications remain queued because the bot is not configured.');
    return { warning: 'Telegram notifications are queued until the bot is configured.' };
  }
  const deliveries = await dispatchTelegramOutbox();
  const failed = deliveries.filter((delivery) => !delivery.sent);
  return failed.length
    ? { warning: 'The order was saved, but one or more Telegram notifications could not be delivered.' }
    : { warning: null };
}
