import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Heart, Minus, Plus, ShieldCheck, Truck, X } from 'lucide-react';
import { useShop } from '../context/useShop';
import ProductCard from '../components/ProductCard';

export default function ProductDetail() {
  const { id } = useParams();
  const { products, addToCart, favorites, toggleFavorite, setCartOpen } = useShop();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const product = products.find((item) => item.id === id);

  if (!product) {
    return <div className="not-found wrap"><span className="eyebrow">A PIECE YET TO BE FOUND</span><h1>រកមិនឃើញផលិតផលនេះទេ</h1><Link className="button button-primary" to="/products"><ArrowLeft size={17} /> ត្រឡប់ទៅហាង</Link></div>;
  }

  const gallery = product.gallery || [product.image, ...products.filter((item) => item.id !== product.id).slice(0, 2).map((item) => item.image)];
  const related = products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 3);

  function buyNow() {
    addToCart(product, quantity);
    setCartOpen(false);
    navigate('/cart');
  }

  return (
    <div className="detail-page">
      <div className="wrap product-breadcrumb"><Link to="/">ទំព័រដើម</Link><span>/</span><Link to="/products">ផលិតផល</Link><span>/</span><strong>{product.name}</strong></div>
      <div className="wrap detail-layout">
        <div className="detail-gallery">
          <button className="detail-main-image" onClick={() => setZoomed(true)} aria-label="ពង្រីករូបភាពផលិតផល"><img src={gallery[selectedImage]} alt={product.enName} /><span className="gallery-zoom">VIEW DETAIL · CLICK TO ZOOM</span></button>
          <div className="thumbnail-row">{gallery.map((image, index) => <button key={image} className={selectedImage === index ? 'thumbnail active' : 'thumbnail'} onClick={() => setSelectedImage(index)} aria-label={`រូបភាពទី ${index + 1}`}><img src={image} alt="" /></button>)}</div>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{product.material.toUpperCase()} · {product.province.toUpperCase()}</span>
          <div className="detail-rating"><span>★★★★★</span> {product.rating} <span className="muted">({product.reviews} reviews)</span></div>
          <h1>{product.name}</h1><p className="detail-enname">{product.enName}</p>
          <div className="detail-price">${product.price.toFixed(2)} {product.oldPrice && <del>${product.oldPrice.toFixed(2)}</del>}</div>
          <p className="detail-description">{product.description}</p>
          <div className="detail-maker"><img src={product.artisanImage || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80'} alt="" /><div><small>MADE BY</small><strong>{product.artisan}</strong><span>{product.artisanProvince}, កម្ពុជា</span></div><Link to="/artisans" aria-label="មើលសិប្បករ"><ArrowRight size={17} /></Link></div>
          <div className="detail-quantity"><span>ចំនួន</span><div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="បន្ថយ"><Minus size={14} /></button><span>{quantity}</span><button onClick={() => setQuantity(quantity + 1)} aria-label="បន្ថែម"><Plus size={14} /></button></div></div>
          <div className="detail-actions"><button className="button button-primary" onClick={() => addToCart(product, quantity)}>ដាក់ចូលកន្ត្រក <ArrowRight size={17} /></button><button className="button button-buy-now" onClick={buyNow}>ទិញឥឡូវ</button><button onClick={() => toggleFavorite(product.id)} className={`button button-icon-outline ${favorites.includes(product.id) ? 'is-favorite' : ''}`} aria-label="បន្ថែមទៅចំណូលចិត្ត"><Heart size={19} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button></div>
          <div className="detail-assurances"><span><Check size={15} /> ផលិតដោយដៃដោយយកចិត្តទុកដាក់</span><span><Truck size={15} /> ដឹកជញ្ជូននៅទូទាំងកម្ពុជា</span><span><ShieldCheck size={15} /> ទិញដោយមានទំនុកចិត្ត</span></div>
        </div>
      </div>
      <div className="wrap product-story"><div><span className="eyebrow">A STORY IN EVERY DETAIL</span><h2>បង្កើតដោយចេតនា<br />សម្រាប់ជីវិតប្រចាំថ្ងៃ</h2></div><p>{product.description} ស្នាដៃនេះផលិតដោយយកចិត្តទុកដាក់ និងគោរពដល់ធនធានធម្មជាតិ។ ការគាំទ្ររបស់អ្នកជួយឱ្យជំនាញបុរាណបន្តមានជីវិត និងបង្កើតប្រាក់ចំណូលសមរម្យសម្រាប់សហគមន៍។</p></div>
      <section className="review-section wrap">
        <div className="review-summary"><span className="eyebrow">CUSTOMER NOTES</span><h2>ការវាយតម្លៃពីអតិថិជន</h2><div className="review-score"><strong>{product.rating}</strong><span>★★★★★<small>{product.reviews} ការវាយតម្លៃ</small></span></div>{[5, 4, 3, 2, 1].map((stars) => <div className="rating-bar" key={stars}><span>{stars} ★</span><i><b style={{ width: `${Math.max(10, (product.rating - 3.5) * (stars === 5 ? 42 : stars === 4 ? 20 : 7))}%` }} /></i><small>{stars === 5 ? '78%' : stars === 4 ? '18%' : '4%'}</small></div>)}</div>
        <div className="review-quotes"><article><span>★★★★★</span><p>“ស្នាដៃពិតជាស្រស់ស្អាត និងធ្វើដោយយកចិត្តទុកដាក់។ វេចខ្ចប់បានល្អ ហើយដឹកជញ្ជូនរហ័ស។”</p><small>សុភា · អ្នកទិញដែលបានផ្ទៀងផ្ទាត់</small></article><article><span>★★★★★</span><p>“ខ្ញុំស្រឡាញ់វត្ថុដែលមានរឿងរ៉ាវនៅពីក្រោយ។ គុណភាពស្អាតជាងការរំពឹងទុក។”</p><small>ដារ៉ា · អ្នកទិញដែលបានផ្ទៀងផ្ទាត់</small></article></div>
      </section>
      <section className="related-section wrap"><div className="section-heading"><div><span className="eyebrow">MORE FROM THE MAKERS</span><h2>ស្នាដៃដែលអ្នកអាចចូលចិត្ត</h2></div><Link className="text-link" to="/products">រកមើលបន្ថែម <ArrowRight size={16} /></Link></div><div className="product-grid">{(related.length ? related : products.filter((item) => item.id !== product.id).slice(0, 3)).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>
      {zoomed && <div className="image-zoom-overlay" role="dialog" aria-modal="true" aria-label="រូបភាពផលិតផលពង្រីក" onClick={() => setZoomed(false)}><button onClick={() => setZoomed(false)} aria-label="បិទរូបភាព"><X size={24} /></button><img src={gallery[selectedImage]} alt={product.enName} /></div>}
    </div>
  );
}
