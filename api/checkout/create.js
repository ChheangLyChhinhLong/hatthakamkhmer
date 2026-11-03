import { handleError, methodNotAllowed, readBody, requireEnv, sendJson, createHttpError } from '../_lib/http.js';
import { getAdminClient, requireUser } from '../_lib/supabase.js';
import { khqrpayRequest } from '../_lib/khqrpay.js';
import { notifyNewOrder } from '../_lib/telegram.js';

function validRequiredText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function getPublicBaseUrl() {
  const value = process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw createHttpError(500, 'PUBLIC_BASE_URL must use HTTPS.');
  }
  return value;
}

async function createPayment(client, order, method, baseUrl) {
  if (!['aba', 'bakong'].includes(method)) {
    throw createHttpError(400, 'Select ABA or Bakong KHQR for online payment.');
  }
  if (order.status !== 'pending_payment') {
    throw createHttpError(409, 'This order can no longer accept a payment.');
  }
  if (order.payment_method !== method) {
    const { data: previous, error: previousError } = await client.from('transactions')
      .select('gateway')
      .eq('order_id', order.id)
      .maybeSingle();
    if (previousError) throw previousError;
    if (previous) throw createHttpError(409, 'A payment session already exists for the selected payment method.');
    const { data: updatedOrder, error } = await client.from('orders').update({ payment_method: method })
      .eq('id', order.id).eq('status', 'pending_payment').select('id').maybeSingle();
    if (error) throw error;
    if (!updatedOrder) throw createHttpError(409, 'This order can no longer accept a payment.');
    order.payment_method = method;
  }

  const { data: existing, error: existingError } = await client.from('transactions')
    .select('gateway,provider_transaction_id,payment_url,qr,md5,expires_at,status')
    .eq('order_id', order.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.gateway !== method) throw createHttpError(409, 'A payment session already exists for another gateway.');
    return {
      transactionId: existing.provider_transaction_id,
      paymentUrl: existing.payment_url,
      qr: existing.qr,
      expiresAt: existing.expires_at,
    };
  }

  const callbackUrl = `${baseUrl}/api/v1/webhooks`;
  const requestBody = {
    amount: Number(order.total_usd),
    webhook: callbackUrl,
  };
  const paymentData = method === 'aba'
    ? await khqrpayRequest('/aba/create', {
        method: 'POST',
        idempotencyKey: `order-${order.id}`,
        body: requestBody,
      })
    : await khqrpayRequest('/bakong/create', {
        method: 'POST',
        idempotencyKey: `order-${order.id}`,
        body: requestBody,
      });

  const paymentId = String(paymentData.id ?? '');
  let paymentUrl;
  try {
    paymentUrl = new URL(paymentData.checkout_url);
  } catch {
    throw new Error('khqrpay returned an invalid checkout URL.');
  }
  if (!/^\d{12}$/.test(paymentId) || paymentUrl.protocol !== 'https:' || paymentUrl.hostname !== 'khqrpay.site') {
    throw new Error('khqrpay returned an invalid payment response.');
  }

  const { error: transactionError } = await client.from('transactions').insert({
    order_id: order.id,
    gateway: method,
    provider_transaction_id: paymentId,
    amount_usd: order.total_usd,
    currency: 'USD',
    status: 'pending',
    payment_url: paymentUrl.href,
    qr: paymentData.qr || null,
    md5: paymentData.md5 || null,
    expires_at: paymentData.expires_at || null,
    provider_response: {
      id: paymentData.id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: paymentData.status,
      expires_at: paymentData.expires_at || null,
    },
  });
  if (transactionError?.code === '23505') {
    const { data: duplicate, error } = await client.from('transactions')
      .select('gateway,provider_transaction_id,payment_url,qr,expires_at')
      .eq('order_id', order.id)
      .single();
    if (error) throw error;
    if (duplicate.gateway !== method) throw createHttpError(409, 'A payment session already exists for another gateway.');
    return { transactionId: duplicate.provider_transaction_id, paymentUrl: duplicate.payment_url, qr: duplicate.qr, expiresAt: duplicate.expires_at };
  }
  if (transactionError) throw transactionError;
  return {
    transactionId: paymentId,
    paymentUrl: paymentUrl.href,
    qr: paymentData.qr || null,
    expiresAt: paymentData.expires_at || null,
  };
}

async function sendOrderNotifications(order, profile) {
  try {
    return await notifyNewOrder(order, profile);
  } catch (error) {
    console.error('Order was saved, but Telegram notification enqueue failed:', error.message);
    return { warning: 'The order was saved, but Telegram notifications could not be queued.' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { user, profile } = await requireUser(req);
    requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const body = readBody(req);
    if (!validRequiredText(body?.customerName, 160) ||
      !validRequiredText(body?.phone, 40) ||
      !validRequiredText(body?.address, 1000)) {
      throw createHttpError(400, 'Enter your name, phone number, and delivery address.');
    }
    if (!['aba', 'bakong', 'cod'].includes(body?.paymentMethod)) {
      throw createHttpError(400, 'Select ABA, Bakong KHQR, or Cash on Delivery.');
    }
    if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 50) {
      throw createHttpError(400, 'Your cart is empty or contains too many products.');
    }
    if (typeof body.checkoutKey !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(body.checkoutKey)) {
      throw createHttpError(400, 'The checkout session is invalid. Refresh the page and try again.');
    }
    const items = body.items.map((item) => {
      if (typeof item?.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(item.id) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        throw createHttpError(400, 'One or more cart items are invalid.');
      }
      return { id: item.id, quantity: item.quantity };
    }).sort((left, right) => left.id.localeCompare(right.id));
    if (body.paymentMethod !== 'cod') {
      requireEnv(['KHQRPAY_API_KEY', 'KHQRPAY_WEBHOOK_SECRET', 'PUBLIC_BASE_URL']);
    }
    const baseUrl = body.paymentMethod === 'cod' ? null : getPublicBaseUrl();
    const client = getAdminClient();
    const { data: savedOrder, error } = await client.rpc('create_store_order', {
      p_user_id: user.id,
      p_checkout_key: body.checkoutKey,
      p_customer_name: body.customerName.trim(),
      p_phone: body.phone.trim(),
      p_address: body.address.trim(),
      p_payment_method: body.paymentMethod,
      p_items: items,
    });
    if (error) {
      if (error.message.includes('stock is insufficient')) throw createHttpError(409, 'A product in your cart no longer has enough stock.');
      if (error.message.includes('Product is unavailable')) throw createHttpError(409, 'A product in your cart is no longer available.');
      throw error;
    }
    const order = savedOrder;
    if (!order?.id || order.user_id !== user.id) throw new Error('The order could not be saved securely.');
    if (order.payment_method !== body.paymentMethod) {
      if (!['pending_payment', 'pending_cod'].includes(order.status)) {
        throw createHttpError(409, 'This checkout session already uses another payment method.');
      }
      const { data: changedOrder, error: changeError } = await client.rpc('change_store_order_payment_method', {
        p_order_id: order.id,
        p_payment_method: body.paymentMethod,
      });
      if (changeError) throw changeError;
      if (!changedOrder?.changed) {
        throw createHttpError(409, 'This checkout session already has a payment or can no longer be changed.');
      }
      Object.assign(order, changedOrder.order);
    }

    const notification = order.status === 'pending_cod' || order.status === 'pending_payment'
      ? await sendOrderNotifications(order, profile)
      : { warning: null };
    if (order.status === 'pending_cod') {
      return sendJson(res, 201, { orderId: order.id, status: order.status, notificationWarning: notification.warning });
    }
    if (order.status !== 'pending_payment') {
      throw createHttpError(409, 'This order is no longer awaiting payment.');
    }
    const payment = await createPayment(client, order, body.paymentMethod, baseUrl);
    return sendJson(res, 201, {
      orderId: order.id,
      status: order.status,
      notificationWarning: notification.warning,
      payment,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
