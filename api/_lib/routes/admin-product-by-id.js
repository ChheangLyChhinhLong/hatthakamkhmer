import { handleError, methodNotAllowed, readBody, sendJson, createHttpError } from '../http.js';
import { getAdminClient, requireAdmin } from '../supabase.js';

export default async function handler(req, res) {
  if (!['PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['PATCH', 'DELETE']);
  try {
    await requireAdmin(req);
    const id = String(req.query?.id || '');
    if (!/^[a-z0-9-]{1,100}$/.test(id)) throw createHttpError(400, 'Invalid product id.');
    const client = getAdminClient();
    if (req.method === 'DELETE') {
      const { data, error } = await client.from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .single();
      if (error?.code === 'PGRST116') throw createHttpError(404, 'Product not found.');
      if (error) throw error;
      return sendJson(res, 200, { id: data.id, archived: true });
    }

    const body = readBody(req);
    const allowed = ['name_km', 'name_en', 'description_km', 'category', 'material', 'province', 'price_usd', 'compare_at_usd', 'badge', 'image_url', 'gallery', 'artisan_km', 'artisan_province', 'stock', 'is_active'];
    const patch = {};
    for (const key of allowed) {
      if (Object.hasOwn(body || {}, key)) patch[key] = body[key];
    }
    const textFields = ['name_km', 'name_en', 'description_km', 'category', 'material', 'province', 'badge', 'artisan_km', 'artisan_province'];
    if (textFields.some((key) => key in patch && (typeof patch[key] !== 'string' || patch[key].length > 4000))) {
      throw createHttpError(400, 'Product text fields must be valid strings no longer than 4,000 characters.');
    }
    if (typeof patch.image_url === 'string') {
      let image;
      try {
        image = new URL(patch.image_url);
      } catch {
        throw createHttpError(400, 'Upload a product image before saving.');
      }
      if (image.protocol !== 'https:' || image.hostname !== 'res.cloudinary.com') {
        throw createHttpError(400, 'Product images must use a secure Cloudinary URL.');
      }
    }
    if (patch.price_usd !== undefined && (!Number.isFinite(Number(patch.price_usd)) || Number(patch.price_usd) <= 0 || Number(patch.price_usd) > 100000)) {
      throw createHttpError(400, 'Enter a valid USD price.');
    }
    if (patch.stock !== undefined && (!Number.isInteger(Number(patch.stock)) || Number(patch.stock) < 0 || Number(patch.stock) > 100000)) {
      throw createHttpError(400, 'Enter a valid stock quantity.');
    }
    if ('is_active' in patch && typeof patch.is_active !== 'boolean') {
      throw createHttpError(400, 'Product visibility must be true or false.');
    }
    if (patch.gallery && (!Array.isArray(patch.gallery) || patch.gallery.length > 8 ||
      patch.gallery.some((url) => {
        if (typeof url !== 'string') return true;
        try {
          const image = new URL(url);
          return image.protocol !== 'https:' || image.hostname !== 'res.cloudinary.com';
        } catch {
          return true;
        }
      }))) {
      throw createHttpError(400, 'Product gallery images must be secure Cloudinary URLs.');
    }
    if (!Object.keys(patch).length) throw createHttpError(400, 'No product changes were provided.');
    if ('price_usd' in patch || 'compare_at_usd' in patch) {
      const { data: current, error: currentError } = await client.from('products')
        .select('price_usd,compare_at_usd')
        .eq('id', id)
        .single();
      if (currentError?.code === 'PGRST116') throw createHttpError(404, 'Product not found.');
      if (currentError) throw currentError;
      const nextPrice = 'price_usd' in patch ? Number(patch.price_usd) : Number(current.price_usd);
      const nextCompareAt = 'compare_at_usd' in patch
        ? (patch.compare_at_usd === '' || patch.compare_at_usd == null ? null : Number(patch.compare_at_usd))
        : (current.compare_at_usd == null ? null : Number(current.compare_at_usd));
      if (nextCompareAt !== null && (!Number.isFinite(nextCompareAt) || nextCompareAt <= nextPrice || nextCompareAt > 100000)) {
        throw createHttpError(400, 'The comparison price must be greater than the product price.');
      }
      if ('compare_at_usd' in patch) patch.compare_at_usd = nextCompareAt;
      if ('price_usd' in patch) patch.price_usd = nextPrice;
    }
    patch.updated_at = new Date().toISOString();
    const { data, error } = await client.from('products').update(patch).eq('id', id).select().single();
    if (error?.code === 'PGRST116') throw createHttpError(404, 'Product not found.');
    if (error) throw error;
    return sendJson(res, 200, { product: data });
  } catch (error) {
    return handleError(res, error);
  }
}
