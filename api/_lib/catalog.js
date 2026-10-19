export const PRODUCT_COLUMNS = 'id,name_km,name_en,description_km,category,material,province,price_usd,compare_at_usd,rating,review_count,badge,image_url,gallery,artisan_km,artisan_province,stock,is_active,created_at';

export function toProduct(row) {
  return {
    id: row.id,
    name: row.name_km,
    enName: row.name_en,
    category: row.category,
    material: row.material,
    province: row.province,
    price: Number(row.price_usd),
    ...(row.compare_at_usd == null ? {} : { oldPrice: Number(row.compare_at_usd) }),
    rating: Number(row.rating),
    reviews: row.review_count,
    badge: row.badge,
    image: row.image_url,
    gallery: row.gallery?.length ? row.gallery : [row.image_url],
    description: row.description_km,
    artisan: row.artisan_km,
    artisanProvince: row.artisan_province,
    stock: row.stock,
  };
}
