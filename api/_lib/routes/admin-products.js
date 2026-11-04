import { handleError, methodNotAllowed, readBody, sendJson, createHttpError } from '../http.js';
import { getAdminClient, requireAdmin } from '../supabase.js';

function validateProduct(body) {
  const required = ['id', 'name_km', 'name_en', 'description_km', 'category', 'material', 'province', 'badge', 'image_url', 'artisan_km', 'artisan_province'];
  if (!body || required.some((key) => typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 4000)) {
    throw createHttpError(400, 'Complete all required product fields.');
  }
  if (!/^[a-z0-9-]{1,100}$/.test(body.id)) throw createHttpError(400, 'Product id must contain lowercase letters, numbers, and hyphens.');
  const price = Number(body.price_usd);
  const stock = Number(body.stock);
  if (!Number.isFinite(price) || price <= 0 || price > 100000 || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
    throw createHttpError(400, 'Enter a valid USD price and stock quantity.');
  }
  const compareAt = body.compare_at_usd === '' || body.compare_at_usd == null ? null : Number(body.compare_at_usd);
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt <= price || compareAt > 100000)) {
    throw createHttpError(400, 'The comparison price must be greater than the product price.');
  }
  let image;
  try {
    image = new URL(body.image_url);
  } catch {
    throw createHttpError(400, 'Upload a product image before saving.');
  }
  if (image.protocol !== 'https:' || image.hostname !== 'res.cloudinary.com') {
    throw createHttpError(400, 'Product images must use a secure Cloudinary URL.');
  }
  const gallery = Array.isArray(body.gallery) ? body.gallery.filter((url) => typeof url === 'string' && url.startsWith('https://res.cloudinary.com/')).slice(0, 8) : [];
  return {
    id: body.id,
    name_km: body.name_km.trim(),
    name_en: body.name_en.trim(),
    description_km: body.description_km.trim(),
    category: body.category.trim(),
    material: body.material.trim(),
    province: body.province.trim(),
    price_usd: price,
    compare_at_usd: compareAt,
    rating: 5,
    review_count: 0,
    badge: body.badge.trim(),
    image_url: image.href,
    gallery,
    artisan_km: body.artisan_km.trim(),
    artisan_province: body.artisan_province.trim(),
    stock,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  try {
    await requireAdmin(req);
    const client = getAdminClient();
    if (req.method === 'GET') {
      const { data, error } = await client.from('products')
        .select('id,name_km,name_en,category,material,province,price_usd,compare_at_usd,rating,review_count,badge,image_url,gallery,artisan_km,artisan_province,stock,is_active,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return sendJson(res, 200, { products: data });
    }
    const product = validateProduct(readBody(req));
    const { data, error } = await client.from('products').insert(product).select().single();
    if (error?.code === '23505') throw createHttpError(409, 'A product already uses this product id.');
    if (error) throw error;
    return sendJson(res, 201, { product: data });
  } catch (error) {
    return handleError(res, error);
  }
}
