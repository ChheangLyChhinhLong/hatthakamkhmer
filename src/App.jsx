import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import QuickViewModal from './components/QuickViewModal';
import About from './pages/About';
import Artisans from './pages/Artisans';
import Cart from './pages/Cart';
import Contact from './pages/Contact';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Products from './pages/Products';
import Admin from './pages/Admin';
import Login from './pages/Login';
import PaymentReturn from './pages/PaymentReturn';
import { ShopProvider } from './context/ShopProvider';
import { useShop } from './context/useShop';

function NotFound() {
  return <div className="not-found wrap"><span className="eyebrow">PAGE NOT FOUND</span><h1>សូមអភ័យទោស រកមិនឃើញទំព័រនេះទេ</h1><Link className="button button-primary" to="/">ត្រឡប់ទៅទំព័រដើម</Link></div>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AuthGate({ children }) {
  const { session, authLoading } = useShop();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  if (authLoading) {
    return <div className="login-page" role="status" aria-live="polite">កំពុងពិនិត្យស្ថានភាពការចូល...</div>;
  }

  if (location.pathname === '/login') {
    if (!session) return <Login />;
    const returnTo = searchParams.get('returnTo');
    const destination = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
    return <Navigate to={destination} replace />;
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return children;
}

function StoreNotice() {
  const { isSupabaseConfigured, catalogError } = useShop();
  if (!isSupabaseConfigured) {
    return <div className="store-notice" role="status">Preview mode · Configure Supabase and server secrets to enable accounts, real checkout, and live products.</div>;
  }
  if (catalogError) return <div className="store-notice store-notice-error" role="alert">{catalogError}</div>;
  return null;
}

export default function App() {
  return <ShopProvider><ScrollToTop /><AuthGate><div className="app-shell"><Navbar /><StoreNotice /><main className="main-content"><Routes><Route path="/" element={<Home />} /><Route path="/products" element={<Products />} /><Route path="/product/:id" element={<ProductDetail />} /><Route path="/artisans" element={<Artisans />} /><Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} /><Route path="/cart" element={<Cart />} /><Route path="/login" element={<Login />} /><Route path="/admin" element={<Admin />} /><Route path="/payment/return" element={<PaymentReturn />} /><Route path="*" element={<NotFound />} /></Routes></main><Footer /><CartDrawer /><QuickViewModal /></div></AuthGate></ShopProvider>;
}
