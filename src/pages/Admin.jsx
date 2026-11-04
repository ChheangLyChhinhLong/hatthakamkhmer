import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BadgeDollarSign, Boxes, Check, CircleAlert, ImagePlus, LoaderCircle, PackageCheck, RefreshCw, Save, ShoppingBag, Trash2, UploadCloud, X } from 'lucide-react';
import { useShop } from '../context/useShop';

const emptyProduct = {
  id: '', name_km: '', name_en: '', description_km: '', category: 'wood', material: 'Wood',
  province: 'Siem Reap', price_usd: '', compare_at_usd: '', badge: 'ធ្វើដោយដៃ',
  image_url: '', gallery: [], artisan_km: '', artisan_province: '', stock: 10, is_active: true,
};

async function requestApi(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The admin request could not be completed.');
  return result;
}

export default function Admin() {
  const { session, profile, authLoading } = useShop();
  const [otpAccess, setOtpAccess] = useState('checking');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const accessToken = session?.access_token;
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!accessToken || !isAdmin) return undefined;
    let active = true;
    fetch('/api/admin/session', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          if (active) setOtpAccess(result.code === 'ADMIN_OTP_REQUIRED' ? 'required' : 'denied');
          return;
        }
        if (active) setOtpAccess('verified');
      })
      .catch((caught) => {
        if (active) {
          setError(caught.message);
          setOtpAccess('error');
        }
      });
    return () => { active = false; };
  }, [accessToken, isAdmin]);

  const loadOverview = useCallback(async () => {
    if (!accessToken || !isAdmin || otpAccess !== 'verified') return;
    setLoading(true);
    setError('');
    try {
      setOverview(await requestApi('/api/admin/overview', accessToken));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, isAdmin, otpAccess]);

  useEffect(() => {
    if (!accessToken || !isAdmin || otpAccess !== 'verified') return undefined;
    let active = true;
    requestApi('/api/admin/overview', accessToken)
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((caught) => {
        if (active) setError(caught.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [accessToken, isAdmin, otpAccess]);

  function startEdit(product) {
    setEditing(product.id);
    setProductForm({
      id: product.id,
      name_km: product.name_km,
      name_en: product.name_en,
      description_km: product.description_km || '',
      category: product.category,
      material: product.material,
      province: product.province,
      price_usd: product.price_usd,
      compare_at_usd: product.compare_at_usd ?? '',
      badge: product.badge || '',
      image_url: product.image_url,
      gallery: product.gallery || [],
      artisan_km: product.artisan_km || '',
      artisan_province: product.artisan_province || '',
      stock: product.stock,
      is_active: product.is_active,
    });
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      setError('Choose an image file smaller than 8 MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const signed = await requestApi('/api/cloudinary/sign', session.access_token, { method: 'POST' });
      const data = new FormData();
      data.append('file', file);
      data.append('api_key', signed.apiKey);
      data.append('timestamp', String(signed.timestamp));
      data.append('folder', signed.folder);
      data.append('signature', signed.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'Cloudinary could not upload this image.');
      setProductForm((form) => ({ ...form, image_url: result.secure_url }));
      setNotice('Product photo uploaded securely to Cloudinary.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...productForm, price_usd: Number(productForm.price_usd), stock: Number(productForm.stock) };
      if (body.compare_at_usd !== '') body.compare_at_usd = Number(body.compare_at_usd);
      else body.compare_at_usd = null;
      const result = await requestApi(
        editing ? `/api/admin/products/${encodeURIComponent(editing)}` : '/api/admin/products',
        session.access_token,
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(editing ? body : { ...body, id: body.id.trim().toLowerCase() }) },
      );
      setNotice(`Saved ${result.product.name_km}.`);
      setEditing(null);
      setProductForm(emptyProduct);
      await loadOverview();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Archive “${product.name_km}”?`)) return;
    try {
      await requestApi(`/api/admin/products/${encodeURIComponent(product.id)}`, session.access_token, { method: 'DELETE' });
      setNotice('Product archived. Existing order records are unchanged.');
      await loadOverview();
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function updateOrder(order, status) {
    setError('');
    try {
      await requestApi(`/api/admin/orders/${encodeURIComponent(order.id)}`, session.access_token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Order #${order.id.slice(0, 8)} updated.`);
      await loadOverview();
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function retryNotifications() {
    try {
      const result = await requestApi('/api/admin/notifications/retry', session.access_token, { method: 'POST' });
      setNotice(`Telegram notifications retried: ${result.delivered} sent, ${result.failed} failed.`);
      await loadOverview();
    } catch (caught) {
      setError(caught.message);
    }
  }

  if (authLoading) return <div className="admin-gate"><LoaderCircle className="payment-spinner" /> Checking your sign-in…</div>;
  if (!session) return <div className="admin-gate"><CircleAlert /><span className="eyebrow">ADMIN ACCESS</span><h1>សូមផ្ទៀងផ្ទាត់ Admin</h1><p>ផ្ទាំងគ្រប់គ្រងប្រើលេខកូដ OTP តាម Telegram Bot។</p><Link className="button button-primary" to="/admin/login">ចូលដោយ Telegram OTP <ArrowRight size={16} /></Link></div>;
  if (profile?.role !== 'admin') return <div className="admin-gate"><CircleAlert /><span className="eyebrow">RESTRICTED AREA</span><h1>គណនីនេះមិនមានសិទ្ធិ Admin ទេ</h1><p>តួនាទីត្រូវបានអានពី Supabase និងមិនអាចកំណត់តាម browser បានទេ។</p><Link className="button button-outline" to="/">ត្រឡប់ទៅហាង</Link></div>;
  if (otpAccess === 'checking') return <div className="admin-gate"><LoaderCircle className="payment-spinner" /> កំពុងពិនិត្យការផ្ទៀងផ្ទាត់ OTP…</div>;
  if (otpAccess === 'required') return <div className="admin-gate"><CircleAlert /><span className="eyebrow">ADMIN OTP REQUIRED</span><h1>ត្រូវផ្ទៀងផ្ទាត់ OTP</h1><p>សូមចូលដោយលេខកូដ OTP តាម Telegram ដើម្បីបន្ត។</p><Link className="button button-primary" to="/admin/login">ចូលដោយ Telegram OTP <ArrowRight size={16} /></Link></div>;
  if (otpAccess !== 'verified') return <div className="admin-gate"><CircleAlert /><span className="eyebrow">ADMIN ACCESS</span><h1>មិនអាចផ្ទៀងផ្ទាត់បានទេ</h1><p>{error || 'សូមផ្ទុកទំព័រឡើងវិញ ឬសាកល្បងម្តងទៀត។'}</p><Link className="button button-primary" to="/admin/login">សាកល្បងចូលម្ដងទៀត <ArrowRight size={16} /></Link></div>;

  return <div className="admin-page"><header className="admin-header"><div className="wrap admin-header-inner"><div><span className="eyebrow">HATTHAKAM · OPERATIONS</span><h1>ផ្ទាំងគ្រប់គ្រង</h1></div><div><button onClick={loadOverview} className="admin-refresh" disabled={loading}><RefreshCw size={15} /> ធ្វើបច្ចុប្បន្នភាព</button><Link to="/" className="admin-back">ត្រឡប់ទៅហាង <ArrowRight size={15} /></Link></div></div></header><div className="wrap admin-content">{error && <div className="admin-alert error-alert" role="alert"><CircleAlert size={17} /> {error}</div>}{notice && <div className="admin-alert success-alert" role="status"><Check size={17} /> {notice}<button onClick={() => setNotice('')} aria-label="បិទ"><X size={15} /></button></div>}{loading && !overview ? <div className="admin-loading"><LoaderCircle className="payment-spinner" /> Loading dashboard data…</div> : overview && <><section className="admin-stats"><article><span><BadgeDollarSign /></span><div><small>PAID SALES · 30 DAYS</small><strong>${overview.stats.paidSales30d.toFixed(2)}</strong></div></article><article><span><ShoppingBag /></span><div><small>TOTAL ORDERS</small><strong>{overview.stats.totalOrders}</strong></div></article><article><span><Activity /></span><div><small>AWAITING ACTION</small><strong>{overview.stats.pendingOrders}</strong></div></article><article><span><Boxes /></span><div><small>PRODUCTS</small><strong>{overview.stats.products}</strong></div></article></section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">FULFILMENT</span><h2>ការបញ្ជាទិញថ្មីៗ</h2></div><span className="admin-count">{overview.orders.length} recent</span></div>{overview.orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>លេខបញ្ជាទិញ</th><th>អតិថិជន</th><th>ថ្ងៃខែ</th><th>ទូទាត់</th><th>សរុប</th><th>ស្ថានភាព</th><th>គ្រប់គ្រង</th></tr></thead><tbody>{overview.orders.map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8)}</td><td>{order.customer_name}<small>{order.phone}</small></td><td>{new Date(order.created_at).toLocaleDateString()}</td><td>{order.payment_method.toUpperCase()}</td><td>${Number(order.total_usd).toFixed(2)}</td><td><span className={`status-pill status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span></td><td><select aria-label={`Update order ${order.id.slice(0, 8)}`} value="" onChange={(event) => event.target.value && updateOrder(order, event.target.value)}><option value="">Choose…</option>{({ pending_cod: ['processing', 'cancelled'], paid: ['processing'], processing: ['shipped', 'cancelled'], shipped: ['delivered'] }[order.status] || []).map((status) => <option value={status} key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div> : <p className="admin-empty">មិនទាន់មានការបញ្ជាទិញនៅឡើយទេ។</p>}</section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">CATALOG MANAGEMENT</span><h2>គ្រប់គ្រងផលិតផល</h2></div><button className="button button-primary admin-add" onClick={() => { setEditing(null); setProductForm(emptyProduct); document.getElementById('product-editor')?.scrollIntoView({ behavior: 'smooth' }); }}>បន្ថែមផលិតផល <ImagePlus size={16} /></button></div><div className="admin-product-list">{overview.products.map((product) => <article key={product.id}><img src={product.image_url} alt="" /><div><strong>{product.name_km}</strong><small>{product.name_en} · ${Number(product.price_usd).toFixed(2)} · Stock {product.stock}</small></div><span className={`status-pill ${product.is_active ? 'status-paid' : 'status-cancelled'}`}>{product.is_active ? 'active' : 'archived'}</span><button onClick={() => { startEdit(product); document.getElementById('product-editor')?.scrollIntoView({ behavior: 'smooth' }); }} aria-label={`កែប្រែ ${product.name_km}`}>កែប្រែ</button><button className="admin-delete" onClick={() => archiveProduct(product)} aria-label={`លាក់ ${product.name_km}`}><Trash2 size={16} /></button></article>)}</div></section>
      <section className="admin-panel" id="product-editor"><div className="admin-panel-heading"><div><span className="eyebrow">CLOUDINARY · SUPABASE</span><h2>{editing ? 'កែប្រែផលិតផល' : 'បង្កើតផលិតផលថ្មី'}</h2></div>{editing && <button className="admin-cancel" onClick={() => { setEditing(null); setProductForm(emptyProduct); }}>បោះបង់</button>}</div><form className="product-editor-form" onSubmit={saveProduct}><label>Product ID<input value={productForm.id} disabled={Boolean(editing)} onChange={(event) => setProductForm({ ...productForm, id: event.target.value })} required pattern="[a-z0-9-]+" placeholder="handwoven-basket" /></label><label>ឈ្មោះខ្មែរ<input value={productForm.name_km} onChange={(event) => setProductForm({ ...productForm, name_km: event.target.value })} required /></label><label>English name<input value={productForm.name_en} onChange={(event) => setProductForm({ ...productForm, name_en: event.target.value })} required /></label><label>Category<input value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} required /></label><label>Material<input value={productForm.material} onChange={(event) => setProductForm({ ...productForm, material: event.target.value })} required /></label><label>Province<input value={productForm.province} onChange={(event) => setProductForm({ ...productForm, province: event.target.value })} required /></label><label>Price USD<input type="number" min="0.01" step="0.01" value={productForm.price_usd} onChange={(event) => setProductForm({ ...productForm, price_usd: event.target.value })} required /></label><label>Compare at USD<input type="number" min="0.01" step="0.01" value={productForm.compare_at_usd} onChange={(event) => setProductForm({ ...productForm, compare_at_usd: event.target.value })} /></label><label>Stock<input type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} required /></label><label>Artisan name<input value={productForm.artisan_km} onChange={(event) => setProductForm({ ...productForm, artisan_km: event.target.value })} required /></label><label>Artisan province<input value={productForm.artisan_province} onChange={(event) => setProductForm({ ...productForm, artisan_province: event.target.value })} required /></label><label>Badge<input value={productForm.badge} onChange={(event) => setProductForm({ ...productForm, badge: event.target.value })} required /></label><label className="editor-description">Description (Khmer)<textarea rows="3" value={productForm.description_km} onChange={(event) => setProductForm({ ...productForm, description_km: event.target.value })} required /></label><div className="editor-image"><label className="upload-button"><UploadCloud size={16} /> {uploading ? 'កំពុងផ្ទុក...' : 'ផ្ទុករូបភាពទៅ Cloudinary'}<input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} /></label>{productForm.image_url && <img src={productForm.image_url} alt="Product preview" />}<small>{productForm.image_url || 'Upload an image to create a signed Cloudinary URL.'}</small></div><button className="button button-primary editor-submit" disabled={saving || uploading}>{saving ? <LoaderCircle className="payment-spinner" size={16} /> : <Save size={16} />} {saving ? 'កំពុងរក្សាទុក…' : 'រក្សាទុកផលិតផល'}</button></form></section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">PAYMENT RECONCILIATION</span><h2>ប្រតិបត្តិការទូទាត់</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Transaction</th><th>Order</th><th>Gateway</th><th>Amount</th><th>Status</th><th>Date</th><th>Provider</th></tr></thead><tbody>{overview.transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.provider_transaction_id}</td><td>#{transaction.order_id.slice(0, 8)} · {transaction.order?.customer_name}</td><td>{transaction.gateway.toUpperCase()}</td><td>${Number(transaction.amount_usd).toFixed(2)} {transaction.currency}</td><td><span className={`status-pill status-${transaction.status}`}>{transaction.status}</span></td><td>{new Date(transaction.created_at).toLocaleString()}</td><td><details><summary>Response</summary><pre>{JSON.stringify(transaction.provider_response, null, 2)}</pre></details></td></tr>)}</tbody></table></div></section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">DELIVERY LOG</span><h2>Telegram notifications</h2></div><button className="admin-refresh" onClick={retryNotifications}><PackageCheck size={15} /> Retry pending</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Notification</th><th>Chat</th><th>Attempts</th><th>Status</th><th>Last error</th><th>Sent at</th></tr></thead><tbody>{overview.notifications.map((notification) => <tr key={notification.id}><td>{notification.dedupe_key}</td><td>{notification.chat_id}</td><td>{notification.attempts}</td><td><span className={`status-pill status-${notification.status}`}>{notification.status}</span></td><td>{notification.last_error || '—'}</td><td>{notification.sent_at ? new Date(notification.sent_at).toLocaleString() : '—'}</td></tr>)}</tbody></table></div></section></>}{!overview && !loading && <div className="admin-empty"><Activity /> No dashboard data is available yet.</div>}</div></div>;
}
