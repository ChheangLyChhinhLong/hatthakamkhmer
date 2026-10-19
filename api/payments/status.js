import { handleError, methodNotAllowed, sendJson, createHttpError } from '../_lib/http.js';
import { khpayRequest, normalizeGatewayStatus } from '../_lib/khpay.js';
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
    const providerResult = await khpayRequest(`/qr/check/${encodeURIComponent(transaction.provider_transaction_id)}`);
    const status = normalizeGatewayStatus(providerResult.status || providerResult.action);
    if (status && status !== 'pending') {
      const amount = providerResult.amount ?? transaction.amount_usd;
      const currency = providerResult.currency || transaction.currency;
      await applyPaymentEvent({
        transactionId: transaction.provider_transaction_id,
        amount: String(amount),
        currency,
        status,
        event: `payment.${status}`,
        payload: { source: 'server_status_check', ...providerResult },
        dedupeKey: `status-check:${transaction.provider_transaction_id}:${status}`,
      });
      const { data: updatedOrder, error: updatedError } = await client.from('orders')
        .select('status')
        .eq('id', order.id)
        .single();
      if (updatedError) throw updatedError;
      return sendJson(res, 200, { orderId, status: updatedOrder.status });
    }
    return sendJson(res, 200, { orderId, status: status || order.status });
  } catch (error) {
    return handleError(res, error);
  }
}
