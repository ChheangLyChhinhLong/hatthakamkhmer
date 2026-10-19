import { handleError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { requireAdmin, getAdminClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    await requireAdmin(req);
    const client = getAdminClient();
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [ordersResult, paidResult, productsResult, transactionsResult, outboxResult] = await Promise.all([
      client.from('orders').select('id,status,total_usd,payment_method,customer_name,created_at,paid_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
      client.from('orders').select('total_usd').not('paid_at', 'is', null).gte('paid_at', fromDate),
      client.from('products').select('id,name_km,name_en,category,material,province,price_usd,compare_at_usd,rating,review_count,badge,image_url,gallery,artisan_km,artisan_province,stock,is_active,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
      client.from('transactions').select('id,order_id,gateway,provider_transaction_id,amount_usd,currency,status,payment_url,expires_at,provider_response,created_at,paid_at').order('created_at', { ascending: false }).limit(50),
      client.from('telegram_outbox').select('id,dedupe_key,chat_id,status,attempts,last_error,sent_at,created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    for (const result of [ordersResult, paidResult, productsResult, transactionsResult, outboxResult]) {
      if (result.error) throw result.error;
    }
    const orders = ordersResult.data || [];
    const transactions = transactionsResult.data || [];
    const orderIds = [...new Set(transactions.map((transaction) => transaction.order_id))];
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    if (orderIds.length) {
      const { data: relatedOrders, error } = await client.from('orders')
        .select('id,status,customer_name')
        .in('id', orderIds);
      if (error) throw error;
      for (const order of relatedOrders || []) ordersById.set(order.id, { ...ordersById.get(order.id), ...order });
    }
    const paidOrders = paidResult.data || [];
    return sendJson(res, 200, {
      stats: {
        totalOrders: ordersResult.count || 0,
        pendingOrders: orders.filter((order) => ['pending_payment', 'pending_cod'].includes(order.status)).length,
        products: productsResult.count || 0,
        paidSales30d: paidOrders.reduce((total, order) => total + Number(order.total_usd), 0),
      },
      orders,
      products: (productsResult.data || []).map((product) => ({
        ...product,
        price: Number(product.price_usd),
        oldPrice: product.compare_at_usd == null ? null : Number(product.compare_at_usd),
        image: product.image_url,
      })),
      transactions: transactions.map((transaction) => ({
        ...transaction,
        order: ordersById.get(transaction.order_id) || null,
      })),
      notifications: outboxResult.data || [],
    });
  } catch (error) {
    return handleError(res, error);
  }
}
