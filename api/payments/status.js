import { handleError, methodNotAllowed, sendJson, createHttpError } from '../_lib/http.js';
import { khqrpayRequest, normalizeKhqrpayStatus } from '../_lib/khqrpay.js';
import { applyPaymentEvent } from '../_lib/payments.js';
import { getAdminClient, requireUser } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const { user } = await requireUser(req);
    const orderId = String(req.query?.orderId || '');
    if (!/^[\da-f-]{36}$/i.test(orderId)) throw createHttpError(400, 'Invalid order id.');
    const client = getAdminClient();
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id,user_id,status,total_usd')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();
    if (orderError || !order) throw createHttpError(404, 'Order not found.');
    const { data: transaction, error: transactionError } = await client
      .from('transactions')
      .select('provider_transaction_id,amount_usd,currency,status')
      .eq('order_id', order.id)
      .single();
    if (transactionError || !transaction) throw createHttpError(404, 'Payment transaction not found.');

    if (order.status === 'paid') return sendJson(res, 200, { orderId, status: 'paid' });
    const providerResult = await khqrpayRequest(`/payment?id=${encodeURIComponent(transaction.provider_transaction_id)}`);
    const payment = providerResult.payment;
    if (!payment || String(payment.id) !== transaction.provider_transaction_id) {
      throw createHttpError(502, 'khqrpay returned an invalid payment status response.');
    }
    const status = normalizeKhqrpayStatus(payment.status);
    if (!status) throw createHttpError(502, 'khqrpay returned an unsupported payment status.');
    if (status === 'underpaid') {
      return sendJson(res, 200, { orderId, status: order.status, paymentStatus: status });
    }
    if (status && status !== 'pending') {
      const amount = payment.amount;
      if (amount === undefined || !/^\d+(?:\.\d{1,2})?$/.test(String(amount))) {
        throw createHttpError(502, 'khqrpay returned an invalid payment amount.');
      }
      const currency = payment.currency || transaction.currency;
      await applyPaymentEvent({
        transactionId: transaction.provider_transaction_id,
        amount: String(amount),
        currency,
        status,
        event: `payment.${status}`,
        payload: { source: 'server_status_check', ...payment },
        dedupeKey: `status-check:${transaction.provider_transaction_id}:${status}`,
      });
      const { data: updatedOrder, error: updatedError } = await client.from('orders')
        .select('status')
        .eq('id', order.id)
        .single();
      if (updatedError) throw updatedError;
      return sendJson(res, 200, { orderId, status: updatedOrder.status });
    }
    return sendJson(res, 200, { orderId, status: order.status });
  } catch (error) {
    return handleError(res, error);
  }
}
