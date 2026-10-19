import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useShop } from '../context/useShop';

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, subtotal, updateQuantity, removeFromCart } = useShop();
  if (!cartOpen) return null;

  return (
    <div className="overlay-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
      <aside className="cart-drawer" aria-label="កន្ត្រកទំនិញ">
        <div className="drawer-heading"><div><span className="eyebrow">YOUR SELECTION</span><h2>កន្ត្រករបស់អ្នក <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="បិទ"><X /></button></div>
        {cart.length ? <>
          <div className="drawer-items">{cart.map((item) => <div className="drawer-item" key={item.id}><img src={item.image} alt={item.enName} /><div className="drawer-item-copy"><Link to={`/product/${item.id}`} onClick={() => setCartOpen(false)}>{item.name}</Link><small>{item.material} · ${item.price.toFixed(2)}</small><div className="quantity-control"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="បន្ថយចំនួន"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="បន្ថែមចំនួន"><Plus size={13} /></button></div></div><div className="drawer-item-side"><strong>${(item.price * item.quantity).toFixed(2)}</strong><button aria-label="លុបផលិតផល" onClick={() => removeFromCart(item.id)}><Trash2 size={15} /></button></div></div>)}</div>
          <div className="drawer-summary"><p><span>សរុបរង</span><strong>${subtotal.toFixed(2)}</strong></p><small>ថ្លៃដឹកជញ្ជូននឹងគណនានៅពេលបញ្ជាទិញ។</small><Link to="/cart" className="button button-primary button-full" onClick={() => setCartOpen(false)}>ពិនិត្យការបញ្ជាទិញ <ArrowRight size={17} /></Link></div>
        </> : <div className="empty-cart"><ShoppingBag size={36} /><h3>កន្ត្រកទំនិញនៅទទេ</h3><p>ស្វែងរកស្នាដៃពិសេសដែលផលិតដោយដៃនៅទីនេះ។</p><Link to="/products" className="button button-primary" onClick={() => setCartOpen(false)}>រកមើលផលិតផល</Link></div>}
      </aside>
    </div>
  );
}
