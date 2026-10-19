import { handleError, methodNotAllowed, sendJson } from './_lib/http.js';
import { PRODUCT_COLUMNS, toProduct } from './_lib/catalog.js';
import { getAdminClient } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const client = getAdminClient();
    let query = client.from('products').select(PRODUCT_COLUMNS).eq('is_active', true).gt('stock', 0).order('created_at', { ascending: false }).limit(100);
    if (req.query?.category) query = query.eq('category', String(req.query.category).slice(0, 50));
    if (req.query?.material) query = query.ilike('material', `%${String(req.query.material).replace(/[%_,()]/g, '').slice(0, 50)}%`);
    if (req.query?.province) query = query.eq('province', String(req.query.province).slice(0, 80));
    const { data, error } = await query;
    if (error) throw error;
    return sendJson(res, 200, { products: data.map(toProduct) });
  } catch (error) {
    return handleError(res, error);
  }
}
