import { handleError, methodNotAllowed, sendJson } from '../http.js';
import { PRODUCT_COLUMNS, toProduct } from '../catalog.js';
import { getAdminClient } from '../supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const id = String(req.query?.id || '');
    if (!/^[a-z0-9-]{1,100}$/.test(id)) return sendJson(res, 400, { error: 'Invalid product id.' });
    const { data, error } = await getAdminClient().from('products').select(PRODUCT_COLUMNS).eq('id', id).eq('is_active', true).single();
    if (error) return sendJson(res, error.code === 'PGRST116' ? 404 : 500, { error: error.code === 'PGRST116' ? 'Product not found.' : 'Product could not be loaded.' });
    return sendJson(res, 200, { product: toProduct(data) });
  } catch (error) {
    return handleError(res, error);
  }
}
