import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, HandHeart, Leaf, MoveRight, Recycle, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { categories, products } from '../data/products';

const slides = [
  { kicker: 'ROOTED IN CAMBODIAN CRAFT', title: 'រក្សាស្មារតីសិប្បកម្មខ្មែរ\nថែរក្សាធម្មជាតិយើង', copy: 'ស្នាដៃដ៏មានតម្លៃ បង្កើតដោយដៃសិប្បករខ្មែរ និងបំផុសគំនិតពីធម្មជាតិ។', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2000&q=90' },
  { kicker: 'MADE SLOW, MADE TO LAST', title: 'ស្នាដៃឆ្លាក់ឈើ និងឫស្សី\nពីសហគមន៍', copy: 'វត្ថុប្រើប្រាស់ប្រចាំថ្ងៃ ដែលមានរឿងរ៉ាវពិសេសនៅពីក្រោយ។', image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=2000&q=90' },
  { kicker: 'A PURCHASE WITH PURPOSE', title: 'គាំទ្រប្រាក់ចំណូល\nសិប្បករក្នុងស្រុក', copy: 'រាល់ការទិញមួយ ជួយបន្តសិល្បៈប្រពៃណី និងជីវភាពសហគមន៍។', image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=2000&q=90' },
];

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  const slide = slides[activeSlide];

  return (
    <div className="home-page">
      <section className="hero" style={{ '--hero-image': `url("${slide.image}")` }}>
        <div className="hero-grain" />
        <div className="wrap hero-inner"><div className="hero-content" key={activeSlide}><div className="hero-kicker"><span /> {slide.kicker}</div><h1>{slide.title}</h1><p>{slide.copy}</p><div className="hero-actions"><Link className="button button-gold" to="/products">ស្វែងរកស្នាដៃ <ArrowRight size={17} /></Link><Link className="hero-secondary" to="/artisans">ជួបសិប្បកររបស់យើង <ArrowUpRight size={16} /></Link></div></div><div className="hero-caption"><span>01 / 03</span><span className="caption-line" /><span>HANDMADE IN CAMBODIA</span></div><div className="hero-controls" aria-label="ប្ដូររូបភាព"><button onClick={() => setActiveSlide((activeSlide + slides.length - 1) % slides.length)} aria-label="រូបមុន">‹</button>{slides.map((item, index) => <button key={item.kicker} className={index === activeSlide ? 'selected' : ''} onClick={() => setActiveSlide(index)} aria-label={`រូបទី ${index + 1}`} />)}<button onClick={() => setActiveSlide((activeSlide + 1) % slides.length)} aria-label="រូបបន្ទាប់">›</button></div></div>
      </section>

      <section className="trust-strip"><div className="wrap trust-inner"><div><HandHeart /><span>ស្នាដៃផលិតដោយដៃ<small>100% HANDCRAFTED</small></span></div><div><Leaf /><span>សម្ភារៈមិត្តភាពបរិស្ថាន<small>MADE WITH NATURE</small></span></div><div><ShieldCheck /><span>តម្លៃសមរម្យដល់សិប្បករ<small>FAIR TO OUR MAKERS</small></span></div><div><Truck /><span>ដឹកជញ្ជូនទូទាំងប្រទេស<small>DELIVERED WITH CARE</small></span></div></div></section>

      <section className="section-wrap category-section"><div className="section-heading"><div><span className="eyebrow">MADE OF CAMBODIA</span><h2>រឿងរ៉ាវនៅគ្រប់ស្នាដៃ</h2><p>ស្វែងរកប្រភេទដែលបង្ហាញពីភាពច្នៃប្រឌិតរបស់សហគមន៍យើង។</p></div><Link className="text-link" to="/products">មើលប្រភេទទាំងអស់ <MoveRight size={17} /></Link></div><div className="category-grid">{categories.map((category, index) => <Link to={`/products?category=${category.id}`} className="category-card" key={category.id}><img src={category.image} alt={category.en} loading="lazy" /><div className="category-overlay"><span className="category-number">0{index + 1}</span><span className="category-icon">{category.icon}</span><div><h3>{category.name}</h3><p>{category.en}</p></div><ArrowUpRight size={19} className="category-arrow" /></div></Link>)}</div></section>

      <section className="featured-section"><div className="section-wrap"><div className="section-heading"><div><span className="eyebrow">THE CONSIDERED COLLECTION</span><h2>ស្នាដៃដែលយើងស្រឡាញ់</h2><p>ផលិតផលដែលស្រស់ស្អាត ប្រើប្រាស់បានយូរ និងបង្កើតដោយចេតនា។</p></div><Link className="text-link" to="/products">មើលផលិតផលទាំងអស់ <MoveRight size={17} /></Link></div><div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div></div></section>

      <section className="maker-feature"><div className="maker-image"><img src="https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=85" alt="សិប្បករកំពុងបង្កើតស្នាដៃដោយដៃ" loading="lazy" /><span className="maker-stamp"><Sparkles size={17} /> CRAFTED WITH CARE</span></div><div className="maker-copy"><span className="eyebrow">PEOPLE BEHIND THE PIECES</span><h2>ស្នាដៃមួយៗ<br />ចាប់ផ្ដើមពីដៃមនុស្ស</h2><p>នៅពីក្រោយរាល់សរសៃឫស្សី និងលំនាំត្បាញ មានជំនាញដែលបានបន្តពីមួយជំនាន់ទៅមួយជំនាន់។ សូមស្គាល់អ្នកបង្កើតស្នាដៃ និងសហគមន៍របស់ពួកគេ។</p><Link className="button button-outline" to="/artisans">ជួបសិប្បកររបស់យើង <ArrowRight size={17} /></Link><div className="maker-stat"><strong>120+</strong><span>សិប្បករក្នុងសហគមន៍<br /><small>LOCAL MAKERS, ONE COMMUNITY</small></span></div></div></section>

      <section className="eco-banner"><div className="eco-pattern" /><div className="eco-banner-copy"><span className="eyebrow">BETTER CHOICES, ROOTED IN NATURE</span><h2>ទិញដោយចិត្តស្រឡាញ់<br />រស់នៅដោយគិតគូរ</h2><p>ជ្រើសរើសរបស់ដែលមានន័យ និងជួយថែរក្សាភពផែនដី។</p><Link to="/about" className="button button-gold">ស្វែងយល់ពីបេសកកម្មយើង <ArrowRight size={17} /></Link></div><div className="eco-icon"><Recycle size={104} strokeWidth={1} /><span>GENTLER ON<br />OUR PLANET</span></div></section>
      <div className="home-end-note"><ArrowDown size={15} /> MADE SLOWLY. LOVED FOR LONGER.</div>
    </div>
  );
}
