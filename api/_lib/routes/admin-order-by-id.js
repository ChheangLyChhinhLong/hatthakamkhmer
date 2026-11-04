import { handleError, methodNotAllowed, readBody, sendJson, createHttpError } from '../http.js';
import { getAdminClient, requireAdmin } from '../supabase.js';

const transitions = {
  pending_cod: ['processing', 'cancelled'],
  paid: ['processing'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  try {
    await requireAdmin(req);
    const id = String(req.query?.id || '');
    if (!/^[\da-f-]{36}$/i.test(id)) throw createHttpError(400, 'Invalid order id.');
    const { status } = readBody(req) || {};
    if (!Object.values(transitions).flat().includes(status)) throw createHttpError(400, 'Choose a valid fulfilment status.');
    const client = getAdminClient();
    const { data: order, error: orderError } = await client.from('orders')
      .select('id,status,payment_method')
      .eq('id', id)
      .single();
    if (orderError?.code === 'PGRST116') throw createHttpError(404, 'Order not found.');
    if (orderError) throw orderError;
    if (!transitions[order.status]?.includes(status)) {
      throw createHttpError(409, 'This order cannot move to that fulfilment status.');
    }
    if (status === 'cancelled') {
      const { data, error } = await client.rpc('cancel_store_order', { p_order_id: id });
      if (error) throw error;
      if (!data?.changed && data?.status !== 'cancelled') throw createHttpError(409, 'This order could not be cancelled.');
      return sendJson(res, 200, { order: data });
    }
    const update = {
      status,
      updated_at: new Date().toISOString(),
      ...(order.payment_method === 'cod' && status === 'delivered' ? { paid_at: new Date().toISOString() } : {}),
    };
    const { data, error } = await client.from('orders').update(update).eq('id', id).select().single();
    if (error) throw error;
    return sendJson(res, 200, { order: data });
  } catch (error) {
    return handleError(res, error);
  }
}
