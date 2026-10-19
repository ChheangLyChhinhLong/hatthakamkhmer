import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleAlert, CreditCard, LoaderCircle, Minus, Plus, QrCode, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useShop } from '../context/useShop';

const paymentOptions = [
  { id: 'aba', title: 'ABA PayWay', subtitle: 'Pay securely using ABA Mobile', Icon: CreditCard },
  { id: 'bakong', title: 'Bakong KHQR', subtitle: 'Cambodian national QR payment', Icon: QrCode },
  { id: 'cod', title: 'ទូទាត់ពេលទទួល', subtitle: 'Cash on Delivery', Icon: Truck },
];

export default function Cart() {
  const { cart, subtotal, updateQuantity, removeFromCart, clearCart, session, isSupabaseConfigured } = useShop();
  const [payment, setPayment] = useState('aba');
  const [details, setDetails] = useState({ name: '', phone: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ordered, setOrdered] = useState('');
  const checkoutFingerprint = cart.map((item) => `${item.id}:${item.quantity}`).sort().join('|');
  const checkoutSession = useRef(null);
  const navigate = useNavigate();
  const delivery = subtotal >= 50 || subtotal === 0 ? 0 : 2.5;
  const total = subtotal + delivery;

  function getCheckoutSession() {
    if (checkoutSession.current?.fingerprint === checkoutFingerprint) return checkoutSession.current;
    const storageKey = `hatthakam-checkout:${checkoutFingerprint}`;
    let key;
    try {
      key = sessionStorage.getItem(storageKey);
    } catch (storageError) {
      console.error('Unable to restore the checkout session key.', storageError);
    }
    if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key || '')) {
      key = globalThis.crypto?.randomUUID?.();
      if (key) {
        try {
          sessionStorage.setItem(storageKey, key);
        } catch (storageError) {
          console.error('Unable to persist the checkout session key.', storageError);
        }
      }
    }
    checkoutSession.current = { fingerprint: checkoutFingerprint, key, storageKey };
    return checkoutSession.current;
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!session?.access_token) {
      navigate(`/login?returnTo=${encodeURIComponent('/cart')}`);
      return;
    }
    const currentCheckout = getCheckoutSession();
    if (!currentCheckout.key) {
      setError('Secure checkout is unavailable in this browser. Please use a modern browser and try again.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          customerName: details.name,
          phone: details.phone,
          address: details.address,
          paymentMethod: payment,
          checkoutKey: currentCheckout.key,
          items: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The order could not be created.');
      if (result.notificationWarning) setError(result.notificationWarning);
      if (result.status === 'pending_cod') {
        try {
          sessionStorage.removeItem(currentCheckout.storageKey);
        } catch (storageError) {
          console.error('Unable to clear the completed checkout session.', storageError);
        }
        clearCart();
        setOrdered(result.orderId);
      } else if (result.payment?.paymentUrl) {
        try {
          sessionStorage.setItem(`hatthakam-order-checkout:${result.orderId}`, currentCheckout.storageKey);
        } catch (storageError) {
          console.error('Unable to link the payment return to its checkout session.', storageError);
        }
        window.location.assign(result.payment.paymentUrl);
      } else if (result.status === 'paid') {
        clearCart();
        navigate(`/payment/return?order=${encodeURIComponent(result.orderId)}`);
      } else {
        throw new Error('The order was saved, but the payment link is not available yet. Contact support before retrying.');
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (ordered) return <div className="order-success wrap"><div><CheckCircle2 size={38} /></div><span className="eyebrow">ORDER RECEIVED</span><h1>អរគុណសម្រាប់ការគាំទ្រ!</h1><p>ការបញ្ជាទិញ #{ordered.slice(0, 8)} ត្រូវបានទទួល។ យើងនឹងទាក់ទងអ្នកដើម្បីបញ្ជាក់ព័ត៌មានដឹកជញ្ជូន និងការទូទាត់ពេលទទួលទំនិញ។</p><Link to="/products" className="button button-primary">បន្តរកមើលស្នាដៃ <ArrowRight size={17} /></Link></div>;

  return <div className="cart-page"><div className="page-banner cart-banner"><div className="wrap"><span className="eyebrow">A GOOD CHOICE, BEAUTIFULLY MADE</span><h1>ការបញ្ជាទិញរបស់អ្នក</h1><div className="breadcrumb"><Link to="/">ទំព័រដើម</Link><span>/</span><strong>កន្ត្រក</strong></div></div></div><div className="wrap cart-layout">{cart.length ? <><section className="cart-items-panel"><div className="cart-table-head"><span>ផលិតផល</span><span>តម្លៃ</span><span>ចំនួន</span><span>សរុប</span></div>{cart.map((item) => <article className="cart-line" key={item.id}><div className="cart-product"><img src={item.image} alt={item.enName} /><div><Link to={`/product/${item.id}`}>{item.name}</Link><small>{item.material} · ផលិតដោយដៃនៅ {item.province}</small><button className="remove-item" onClick={() => removeFromCart(item.id)}><Trash2 size={13} /> លុបចេញ</button></div></div><strong className="cart-line-price">${item.price.toFixed(2)}</strong><div className="quantity-control"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="បន្ថយចំនួន"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="បន្ថែមចំនួន"><Plus size={13} /></button></div><strong className="cart-line-total">${(item.price * item.quantity).toFixed(2)}</strong></article>)}<Link to="/products" className="continue-shopping">← បន្តស្វែងរកផលិតផល</Link><div className="shipping-note"><Truck size={17} /> {subtotal >= 50 ? 'អ្នកទទួលបានការដឹកជញ្ជូនឥតគិតថ្លៃ!' : `បន្ថែម $${Math.max(0, 50 - subtotal).toFixed(2)} ដើម្បីទទួលបានការដឹកជញ្ជូនឥតគិតថ្លៃ។`}</div></section><aside className="checkout-panel"><span className="eyebrow">SECURE CHECKOUT</span><h2>សង្ខេបការបញ្ជាទិញ</h2><div className="checkout-totals"><p><span>សរុបផលិតផល</span><strong>${subtotal.toFixed(2)}</strong></p><p><span>ការដឹកជញ្ជូន</span><strong>{delivery === 0 ? 'ឥតគិតថ្លៃ' : `$${delivery.toFixed(2)}`}</strong></p><p className="grand-total"><span>សរុបរួម</span><strong>${total.toFixed(2)}</strong></p></div><form onSubmit={submitOrder} className="checkout-form"><h3>ព័ត៌មានដឹកជញ្ជូន</h3><label htmlFor="buyer-name">ឈ្មោះពេញ</label><input id="buyer-name" value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} required placeholder="ឈ្មោះរបស់អ្នក" /><label htmlFor="buyer-phone">លេខទូរស័ព្ទ</label><input id="buyer-phone" type="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} required placeholder="+855 ..." /><label htmlFor="buyer-address">អាសយដ្ឋាន</label><textarea id="buyer-address" rows="2" value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} required placeholder="ភូមិ ឃុំ/សង្កាត់ ខេត្ត/ក្រុង" /><h3 className="payment-heading">ជ្រើសរើសការទូទាត់</h3>{paymentOptions.map(({ id, title, subtitle, Icon }) => <label key={id} className={`payment-option ${payment === id ? 'chosen' : ''}`}><input type="radio" name="payment" checked={payment === id} onChange={() => setPayment(id)} /><span><strong>{title}</strong><small>{subtitle}</small></span><Icon size={20} /></label>)}{!session && <div className="checkout-login-note"><CircleAlert size={16} /><span>សូមចូលដោយ Telegram ដើម្បីរក្សាទុកការបញ្ជាទិញ និងផ្ទៀងផ្ទាត់ការទូទាត់។ <Link to={`/login?returnTo=${encodeURIComponent('/cart')}`}>ចូលគណនី</Link></span></div>}{!isSupabaseConfigured && <div className="checkout-login-note"><CircleAlert size={16} /><span>Checkout is disabled until the Supabase project and server environment variables are configured.</span></div>}{error && <p className="form-error" role="alert"><CircleAlert size={15} /> {error}</p>}<button type="submit" className="button button-primary button-full checkout-submit" disabled={submitting || !isSupabaseConfigured}>{submitting ? <LoaderCircle className="payment-spinner" size={17} /> : <ArrowRight size={17} />}{submitting ? 'កំពុងដំណើរការ…' : 'បញ្ជាក់ការបញ្ជាទិញ'}</button><p className="checkout-safe">🔒 ការទូទាត់ត្រូវបានបញ្ជាក់តាម server ដោយសុវត្ថិភាព</p></form></aside></> : <div className="empty-cart-page"><ShoppingBag size={42} /><span className="eyebrow">NOTHING HERE JUST YET</span><h2>កន្ត្រករបស់អ្នកនៅទទេ</h2><p>ស្នាដៃដ៏ស្រស់ស្អាតពីសិប្បករខ្មែរកំពុងរង់ចាំអ្នក។</p><Link to="/products" className="button button-primary">រកមើលផលិតផល <ArrowRight size={17} /></Link></div>}</div></div>;
}
