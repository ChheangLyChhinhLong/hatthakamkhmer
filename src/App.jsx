import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import QuickViewModal from './components/QuickViewModal';
import { ShopProvider } from './context/ShopProvider';
import { useShop } from './context/useShop';

const About = lazy(() => import('./pages/About'));
const Artisans = lazy(() => import('./pages/Artisans'));
const Cart = lazy(() => import('./pages/Cart'));
const Contact = lazy(() => import('./pages/Contact'));
const Home = lazy(() => import('./pages/Home'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Products = lazy(() => import('./pages/Products'));
const Admin = lazy(() => import('./pages/Admin'));
const Login = lazy(() => import('./pages/Login'));
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'));

function PageFallback() {
  return <div className="login-page" role="status" aria-live="polite">កំពុងផ្ទុកទំព័រ...</div>;
}

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
    if (!session) return <Suspense fallback={<PageFallback />}><Login /></Suspense>;
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
  return <ShopProvider><ScrollToTop /><AuthGate><div className="app-shell"><Navbar /><StoreNotice /><main className="main-content"><Suspense fallback={<PageFallback />}><Routes><Route path="/" element={<Home />} /><Route path="/products" element={<Products />} /><Route path="/product/:id" element={<ProductDetail />} /><Route path="/artisans" element={<Artisans />} /><Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} /><Route path="/cart" element={<Cart />} /><Route path="/login" element={<Login />} /><Route path="/admin" element={<Admin />} /><Route path="/payment/return" element={<PaymentReturn />} /><Route path="*" element={<NotFound />} /></Routes></Suspense></main><Footer /><CartDrawer /><QuickViewModal /></div></AuthGate></ShopProvider>;
}
