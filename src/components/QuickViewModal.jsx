import { ArrowRight, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../context/useShop';

export default function QuickViewModal() {
  const { quickView, setQuickView, addToCart } = useShop();
  if (!quickView) return null;

  return (
    <div className="overlay-backdrop quick-view-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setQuickView(null)}>
      <section className="quick-view-modal" role="dialog" aria-modal="true" aria-label={`ព័ត៌មាន ${quickView.name}`}>
        <button className="close-button quick-close" onClick={() => setQuickView(null)} aria-label="បិទ"><X /></button>
        <img src={quickView.image} alt={quickView.enName} />
        <div className="quick-view-copy"><span className="eyebrow">{quickView.material} · {quickView.province}</span><h2>{quickView.name}</h2><p className="product-english">{quickView.enName}</p><div className="quick-price">${quickView.price.toFixed(2)}</div><p>{quickView.description}</p><div className="quick-artisan"><Check size={16} /> ផលិតដោយ {quickView.artisan}</div><button className="button button-primary button-full" onClick={() => { addToCart(quickView); setQuickView(null); }}>ដាក់ចូលកន្ត្រក</button><Link className="text-link" to={`/product/${quickView.id}`} onClick={() => setQuickView(null)}>មើលព័ត៌មានលម្អិត <ArrowRight size={15} /></Link></div>
      </section>
    </div>
  );
}
