import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useShop } from '../context/useShop';

const materialOptions = ['Wood', 'Bamboo', 'Rattan', 'Clay', 'Silk', 'Recycled glass'];
const provinceOptions = ['Siem Reap', 'Battambang', 'Takeo', 'Kampong Chhnang', 'Kampot', 'Phnom Penh'];

export default function Products() {
  const { products, favorites } = useShop();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || 'all');
  const [material, setMaterial] = useState('');
  const [province, setProvince] = useState('');
  const [maxPrice, setMaxPrice] = useState(100);
  const [sort, setSort] = useState('popular');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const onlyFavorites = params.get('favorites') === 'true';
  const updateSearch = (value) => {
    setQuery(value);
    setParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (value) nextParams.set('q', value);
      else nextParams.delete('q');
      return nextParams;
    });
  };
  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      const searchText = `${product.name} ${product.enName} ${product.material} ${product.province}`.toLocaleLowerCase();
      return (!query || searchText.includes(query.toLocaleLowerCase())) &&
        (category === 'all' || product.category === category) &&
        (!material || product.material.toLowerCase() === material.toLowerCase()) &&
        (!province || product.province === province) &&
        product.price <= maxPrice &&
        (!onlyFavorites || favorites.includes(product.id));
    });
    if (sort === 'price-low') return result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') return result.sort((a, b) => b.price - a.price);
    if (sort === 'newest') return result.reverse();
    return result.sort((a, b) => b.rating - a.rating);
  }, [products, query, category, material, province, maxPrice, onlyFavorites, favorites, sort]);
  const clearFilters = () => { setQuery(''); setCategory('all'); setMaterial(''); setProvince(''); setMaxPrice(100); setParams({}); };

  return (
    <div className="catalog-page"><div className="page-banner"><div className="wrap"><span className="eyebrow">A THOUGHTFUL WAY TO SHOP</span><h1>{onlyFavorites ? 'ផលិតផលដែលអ្នកស្រឡាញ់' : 'ស្នាដៃពីដៃសិប្បករ'}</h1><p>ស្វែងរករបស់ពិសេសសម្រាប់ខ្លួនអ្នក និងគេហដ្ឋាន។</p><div className="breadcrumb"><span>ទំព័រដើម</span><span>/</span><strong>ផលិតផល</strong></div></div></div>
      <div className="wrap catalog-layout">
        <aside className={`filter-sidebar ${filtersOpen ? 'filters-visible' : ''}`}><div className="filter-header"><h2><Filter size={16} /> តម្រងផលិតផល</h2><button onClick={clearFilters}>សម្អាតទាំងអស់</button><button className="filter-close" onClick={() => setFiltersOpen(false)} aria-label="បិទតម្រង"><X size={19} /></button></div><div className="filter-group"><label htmlFor="catalog-search">ស្វែងរក</label><div className="catalog-search"><Search size={16} /><input id="catalog-search" value={query} onChange={(event) => updateSearch(event.target.value)} placeholder="ឈ្មោះផលិតផល..." /></div></div><div className="filter-group"><h3>ប្រភេទស្នាដៃ</h3>{[['all', 'ផលិតផលទាំងអស់'], ['wood', 'ស្នាដៃឈើ'], ['bamboo', 'ឫស្សី និងផ្តៅ'], ['textile', 'ក្រណាត់ត្បាញ'], ['clay', 'គ្រឿងដីឥដ្ឋ'], ['recycled', 'សិល្បៈកែច្នៃ']].map(([value, label]) => <label className="radio-option" key={value}><input type="radio" name="category" checked={category === value} onChange={() => setCategory(value)} /> <span>{label}</span></label>)}</div><div className="filter-group"><label htmlFor="material-select">សម្ភារៈ</label><select id="material-select" value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">សម្ភារៈទាំងអស់</option>{materialOptions.map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter-group"><label htmlFor="province-select">ខេត្ត</label><select id="province-select" value={province} onChange={(event) => setProvince(event.target.value)}><option value="">គ្រប់ខេត្ត</option>{provinceOptions.map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter-group price-filter"><label htmlFor="price-range">តម្លៃអតិបរមា <strong>${maxPrice}</strong></label><input id="price-range" type="range" min="10" max="100" step="1" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /><div><span>$10</span><span>$100</span></div></div></aside>
        <section className="catalog-results"><div className="catalog-toolbar"><div><button className="filter-open" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /> តម្រង</button><strong>{filtered.length} <span>ស្នាដៃ</span></strong>{onlyFavorites && <span className="favorites-chip">ចំណូលចិត្ត</span>}</div><label className="sort-select">តម្រៀបតាម <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">ពេញនិយម</option><option value="price-low">តម្លៃ៖ ទាបទៅខ្ពស់</option><option value="price-high">តម្លៃ៖ ខ្ពស់ទៅទាប</option><option value="newest">ថ្មីបំផុត</option></select></label></div>{filtered.length ? <div className="product-grid catalog-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="no-results"><span>⌕</span><h2>រកមិនឃើញផលិតផលទេ</h2><p>សូមសាកល្បងស្វែងរកម្ដងទៀត ឬលុបតម្រងមួយចំនួន។</p><button className="button button-outline" onClick={clearFilters}>សម្អាតតម្រង</button></div>}</section>
      </div>
    </div>
  );
}
