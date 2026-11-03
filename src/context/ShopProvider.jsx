import { useEffect, useMemo, useState } from 'react';
import { products as demoProducts } from '../data/products';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { toProduct } from '../lib/catalog';
import { ShopContext } from './ShopContext';

function readSavedCart() {
  try {
    const saved = localStorage.getItem('hatthakam-cart');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Unable to restore the saved shopping cart.', error);
    return [];
  }
}

export function ShopProvider({ children }) {
  const [cart, setCart] = useState(readSavedCart);
  const [products, setProducts] = useState(demoProducts);
  const [favorites, setFavorites] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [session, setSession] = useState(null);
  const [profileState, setProfileState] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const profile = profileState && profileState.userId === session?.user?.id ? profileState.value : null;

  useEffect(() => {
    localStorage.setItem('hatthakam-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.from('products')
      .select('id,name_km,name_en,description_km,category,material,province,price_usd,compare_at_usd,rating,review_count,badge,image_url,gallery,artisan_km,artisan_province,stock,created_at')
      .eq('is_active', true)
      .gt('stock', 0)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setCatalogError(`Product catalog is unavailable: ${error.message}`);
          console.error('Could not load products from Supabase:', error.message);
          return;
        }
        setProducts((data || []).map(toProduct));
        setCatalogError('');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('Could not restore the signed-in user:', error.message);
      setSession(data?.session || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined;
    let active = true;
    const userId = session.user.id;
    supabase.from('profiles')
      .select('id,display_name,role,telegram_id,telegram_username')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Could not load the signed-in profile:', error.message);
          setProfileState({ userId, value: null });
        } else {
          setProfileState({ userId, value: data });
        }
      });
    return () => { active = false; };
  }, [session?.user?.id]);

  const addToCart = (product, quantity = 1) => {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      return existing
        ? items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item)
        : [...items, { ...product, quantity }];
    });
    setCartOpen(true);
  };

  const updateQuantity = (id, quantity) => {
    setCart((items) => quantity < 1
      ? items.filter((item) => item.id !== id)
      : items.map((item) => item.id === id ? { ...item, quantity } : item));
  };

  const removeFromCart = (id) => setCart((items) => items.filter((item) => item.id !== id));
  const clearCart = () => setCart([]);
  const toggleFavorite = (id) => setFavorites((items) => items.includes(id)
    ? items.filter((item) => item !== id)
    : [...items, id]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const value = useMemo(() => ({
    products, cart, cartCount, subtotal, favorites, cartOpen, quickView,
    catalogError, session, profile, authLoading, isSupabaseConfigured,
    setCartOpen, setQuickView, addToCart, updateQuantity, removeFromCart, clearCart, toggleFavorite,
  }), [products, cart, cartCount, subtotal, favorites, cartOpen, quickView, catalogError, session, profile, authLoading]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
