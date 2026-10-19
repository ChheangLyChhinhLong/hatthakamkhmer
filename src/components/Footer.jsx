import { ArrowUpRight, Camera, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-pattern" />
      <div className="wrap footer-grid">
        <div className="footer-brand"><Link to="/" className="footer-logo">ហត្ថកម្មខ្មែរ</Link><p>ស្នាដៃពិតពីដៃសិប្បករខ្មែរ។ យើងជឿថាការទិញដោយយកចិត្តទុកដាក់អាចជួយថែរក្សាវប្បធម៌ និងភពផែនដីរបស់យើង។</p><div className="social-links"><a href="https://www.facebook.com/" aria-label="Facebook"><MessageCircle size={17} /></a><a href="https://www.instagram.com/" aria-label="Instagram"><Camera size={17} /></a></div></div>
        <div><h3>តំណភ្ជាប់រហ័ស</h3><Link to="/products">ផលិតផលទាំងអស់</Link><Link to="/artisans">ជួបសិប្បករ</Link><Link to="/about">អំពីហត្ថកម្មខ្មែរ</Link><Link to="/contact">ទាក់ទងមកយើង</Link></div>
        <div><h3>សេវាកម្មអតិថិជន</h3><a href="/contact">សំណួរដែលសួរញឹកញាប់</a><a href="/contact">ការដឹកជញ្ជូន</a><a href="/contact">ការប្តូរ និងសងប្រាក់</a><a href="/contact">គោលការណ៍ឯកជនភាព</a></div>
        <div className="footer-contact"><h3>ទាក់ទងមកយើង</h3><p><MapPin size={16} /> ភ្នំពេញ ប្រទេសកម្ពុជា</p><p><Phone size={16} /> +855 12 345 678</p><p><Mail size={16} /> hello@hatthakamkhmer.com</p><Link to="/contact" className="footer-cta">ផ្ញើសារមកយើង <ArrowUpRight size={16} /></Link></div>
      </div>
      <div className="wrap footer-bottom"><span>© 2026 ហត្ថកម្មខ្មែរ · រក្សាសិទ្ធិគ្រប់យ៉ាង</span><span>ធ្វើឡើងដោយក្ដីស្រឡាញ់នៅកម្ពុជា <span className="footer-heart">♥</span></span></div>
    </footer>
  );
}
