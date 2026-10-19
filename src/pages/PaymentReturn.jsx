import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import { useShop } from '../context/useShop';

export default function PaymentReturn() {
  const { session } = useShop();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.access_token || !orderId) return undefined;
    let active = true;
    let timer;
    let attempts = 0;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not verify this payment.');
        if (!active) return;
        setStatus(result.status);
        setError('');
        if (['paid', 'expired', 'failed', 'cancelled'].includes(result.status)) {
          try {
            const storageKey = sessionStorage.getItem(`hatthakam-order-checkout:${orderId}`);
            if (storageKey) sessionStorage.removeItem(storageKey);
            sessionStorage.removeItem(`hatthakam-order-checkout:${orderId}`);
          } catch (storageError) {
            console.error('Unable to clear the completed checkout session.', storageError);
          }
          return;
        }
        attempts += 1;
        if (attempts < 100) timer = window.setTimeout(checkStatus, 3000);
        else setError('Payment status is still pending. Your order remains saved; please check again shortly.');
      } catch (caught) {
        if (!active) return;
        setError(caught.message);
        timer = window.setTimeout(checkStatus, 5000);
      }
    };
    checkStatus();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [session?.access_token, orderId]);

  if (!orderId) return <div className="payment-result wrap"><CircleAlert /><h1>រកមិនឃើញលេខបញ្ជាទិញទេ</h1><Link to="/products" className="button button-primary">ត្រឡប់ទៅហាង</Link></div>;
  if (!session) return <div className="payment-result wrap"><CircleAlert /><h1>សូមចូលដើម្បីផ្ទៀងផ្ទាត់ការទូទាត់</h1><Link to={`/login?returnTo=${encodeURIComponent(`/payment/return?order=${orderId}`)}`} className="button button-primary">ចូលដោយ Telegram</Link></div>;
  if (status === 'paid') return <div className="payment-result wrap"><CheckCircle2 /><span className="eyebrow">PAYMENT CONFIRMED</span><h1>ការទូទាត់បានជោគជ័យ!</h1><p>ការទូទាត់ត្រូវបានផ្ទៀងផ្ទាត់ដោយសុវត្ថិភាព។ លេខបញ្ជាទិញរបស់អ្នកគឺ <strong>#{orderId.slice(0, 8)}</strong>។</p><Link to="/products" className="button button-primary">បន្តស្វែងរកស្នាដៃ <ArrowRight size={17} /></Link></div>;
  if (['expired', 'failed', 'cancelled'].includes(status)) return <div className="payment-result wrap"><CircleAlert /><span className="eyebrow">PAYMENT NOT COMPLETED</span><h1>ការទូទាត់មិនទាន់បានសម្រេចទេ</h1><p>ស្ថានភាព៖ {status}. ការបញ្ជាទិញរបស់អ្នកមិនត្រូវបានបញ្ជាក់ថាបានបង់ប្រាក់ទេ។</p><Link to="/contact" className="button button-outline">ទាក់ទងផ្នែកជំនួយ</Link></div>;
  return <div className="payment-result wrap"><LoaderCircle className="payment-spinner" /><span className="eyebrow">VERIFYING YOUR PAYMENT</span><h1>កំពុងផ្ទៀងផ្ទាត់ការទូទាត់</h1><p>សូមរង់ចាំ ខណៈពេលយើងបញ្ជាក់ស្ថានភាពពីធនាគារដោយសុវត្ថិភាព។ សូមកុំបង់ម្ដងទៀត។</p>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
