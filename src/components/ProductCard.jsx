import { Heart, Eye, ShoppingBag, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/useShop';

export default function ProductCard({ product }) {
  const { addToCart, favorites, toggleFavorite, setQuickView } = useShop();
  const isFavorite = favorites.includes(product.id);

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link to={`/product/${product.id}`} aria-label={`មើល ${product.name}`}><img className="product-image" src={product.image} alt={product.enName} loading="lazy" /></Link>
        <span className="product-tag">{product.badge}</span>
        <button className={`favorite-button ${isFavorite ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label={isFavorite ? 'ដកចេញពីចំណូលចិត្ត' : 'បន្ថែមទៅចំណូលចិត្ត'}><Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} /></button>
        <button className="quick-view-button" onClick={() => setQuickView(product)}><Eye size={15} /> មើលរហ័ស</button>
      </div>
      <div className="product-info">
        <div className="product-rating"><Star size={14} fill="currentColor" /> {product.rating} <span>({product.reviews})</span></div>
        <Link to={`/product/${product.id}`} className="product-title">{product.name}</Link>
        <p className="product-english">{product.enName}</p>
        <div className="product-bottom"><strong>${product.price.toFixed(2)}</strong><button onClick={() => addToCart(product)} aria-label={`ដាក់ ${product.name} ចូលកន្ត្រក`}><ShoppingBag size={17} /></button></div>
      </div>
    </article>
  );
}
