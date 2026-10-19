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
