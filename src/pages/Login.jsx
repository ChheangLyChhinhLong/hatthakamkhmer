import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useShop } from '../context/useShop';
import { supabase } from '../lib/supabase';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

export default function Login() {
  const { isSupabaseConfigured } = useShop();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !botUsername) return undefined;
    let script;
    window.onTelegramAuth = async (telegramUser) => {
      setLoading(true);
      setMessage('');
      setError('');
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telegramUser),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Telegram sign-in could not be completed.');
        if (!supabase) throw new Error('Supabase browser configuration is missing.');
        const { error: authError } = await supabase.auth.verifyOtp({
          token_hash: result.tokenHash,
          type: 'magiclink',
        });
        if (authError) throw new Error(authError.message);
        const returnTo = searchParams.get('returnTo') || '/';
        navigate(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/', { replace: true });
      } catch (caught) {
        setError(caught.message);
      } finally {
        setLoading(false);
      }
    };
    script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = 'large';
    script.dataset.radius = '3';
    script.dataset.requestAccess = 'write';
    script.dataset.onauth = 'onTelegramAuth(user)';
    const host = document.getElementById('telegram-login-widget');
    host?.appendChild(script);
    return () => {
      script?.remove();
      delete window.onTelegramAuth;
    };
  }, [isSupabaseConfigured, navigate, searchParams]);

  return <div className="login-page"><div className="login-card"><Link to="/" className="login-back"><ArrowLeft size={15} /> ត្រឡប់ទៅហាង</Link><div className="login-emblem"><LockKeyhole size={27} /></div><span className="eyebrow">A SAFER WAY TO CHECK OUT</span><h1>សូមស្វាគមន៍មកវិញ</h1><p className="login-description">ចូលដោយប្រើ Telegram ដើម្បីបញ្ជាក់អត្តសញ្ញាណ និងតាមដានការបញ្ជាទិញរបស់អ្នក។ បន្ទាប់ពីចុចប៊ូតុង សូមបើក Telegram ហើយចុច Confirm ដើម្បីអនុញ្ញាតការចូល។</p>{!isSupabaseConfigured && <div className="integration-notice">Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables to enable sign-in.</div>}{isSupabaseConfigured && !botUsername && <div className="integration-notice">Telegram sign-in is not configured. Set VITE_TELEGRAM_BOT_USERNAME to your bot username.</div>}<div id="telegram-login-widget" className="telegram-widget">{loading && <span>កំពុងផ្ទៀងផ្ទាត់គណនី Telegram...</span>}</div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status"><CheckCircle2 size={16} /> {message}</p>}<div className="login-security"><ShieldCheck size={16} /><span>ការផ្ទៀងផ្ទាត់ដោយសុវត្ថិភាព។ ហត្ថកម្មខ្មែរមិនទទួលបានលេខសម្ងាត់ Telegram របស់អ្នកទេ។</span></div><p className="login-terms">ការចូលបង្ហាញថាអ្នកយល់ព្រមជាមួយគោលការណ៍ឯកជនភាព និងលក្ខខណ្ឌប្រើប្រាស់របស់ហាង។</p></div></div>;
}
