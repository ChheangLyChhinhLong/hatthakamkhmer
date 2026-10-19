import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Heart, LogOut, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useShop } from '../context/useShop';
import { supabase } from '../lib/supabase';

const links = [
  ['/', 'ទំព័រដើម'],
  ['/products', 'ផលិតផល'],
  ['/artisans', 'សិប្បករ'],
  ['/about', 'អំពីយើង'],
  ['/contact', 'ទំនាក់ទំនង'],
];

export default function Navbar() {
  const { cartCount, favorites, setCartOpen, session, profile } = useShop();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Could not sign out:', error.message);
  }

  function submitSearch(event) {
    event.preventDefault();
    navigate(`/products?q=${encodeURIComponent(search)}`);
    setSearchOpen(false);
    setMobileOpen(false);
  }

  return (
    <header className="site-header">
      <div className="announcement"><span>✦</span> រីករាយគាំទ្រស្នាដៃក្នុងស្រុក — ដឹកជញ្ជូនឥតគិតថ្លៃសម្រាប់ការកម្មង់លើស $50 <span>✦</span></div>
      <nav className="navbar wrap">
        <Link to="/" className="brand" aria-label="ហត្ថកម្មខ្មែរ ទំព័រដើម">
          <span className="brand-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 34c8-2 8-13 13-21 3 8 5 14 13 15-6 1-10 4-13 10-2-5-6-8-13-4Z" /><path d="M18 28c4-3 6-7 6-13M24 31c3-3 6-4 10-4" /><text x="17" y="33">ហ</text></svg></span>
          <span className="brand-copy"><strong>ហត្ថកម្មខ្មែរ</strong><small>KHMER ARTISAN GOODS</small></span>
        </Link>
        <div className={`nav-links ${mobileOpen ? 'mobile-open' : ''}`}>
          {links.map(([path, label]) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
        </div>
        <div className="nav-actions">
          {searchOpen && <form className="nav-search" onSubmit={submitSearch}><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ស្វែងរកផលិតផល..." aria-label="ស្វែងរកផលិតផល" /><button aria-label="ស្វែងរក"><Search size={17} /></button></form>}
          <button className="icon-button search-toggle" onClick={() => setSearchOpen(!searchOpen)} aria-label="បើកស្វែងរក"><Search size={19} /></button>
          <Link className="icon-button favorite-link" to="/products?favorites=true" aria-label="ផលិតផលដែលចូលចិត្ត"><Heart size={19} /><span className="count-badge">{favorites.length}</span></Link>
          <button className="icon-button cart-trigger" onClick={() => setCartOpen(true)} aria-label="បើកកន្ត្រក"><ShoppingBag size={19} /><span className="count-badge">{cartCount}</span></button>
          {session ? <><Link className="icon-button account-link" to={profile?.role === 'admin' ? '/admin' : '/login'} aria-label={profile?.role === 'admin' ? 'បើកផ្ទាំងគ្រប់គ្រង' : 'គណនីរបស់ខ្ញុំ'}><UserRound size={18} /></Link><button className="icon-button sign-out-button" onClick={signOut} aria-label="ចាកចេញ"><LogOut size={17} /></button></> : <Link className="icon-button account-link" to="/login" aria-label="ចូលដោយ Telegram"><UserRound size={18} /></Link>}
          <button className="icon-button mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'បិទម៉ឺនុយ' : 'បើកម៉ឺនុយ'}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </nav>
    </header>
  );
}
