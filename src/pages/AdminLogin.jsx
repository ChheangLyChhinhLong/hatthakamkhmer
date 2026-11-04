import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

export default function AdminLogin() {
  const [telegramId, setTelegramId] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/admin-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.retryAfter) {
          setCooldown(result.retryAfter);
          setCodeSent(true);
        }
        throw new Error(result.error || 'Could not request an admin sign-in code.');
      }
      setCodeSent(true);
      setCooldown(60);
      setMessage(result.message);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/admin-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The admin sign-in code could not be verified.');
      if (!supabase) throw new Error('Supabase browser configuration is missing.');
      const { error: sessionError } = await supabase.auth.setSession(result.session);
      if (sessionError) throw new Error(sessionError.message);
      navigate('/admin', { replace: true });
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-card admin-login-card">
        <Link to="/" className="login-back"><ArrowLeft size={15} /> ត្រឡប់ទៅហាង</Link>
        <div className="login-emblem"><LockKeyhole size={27} /></div>
        <span className="eyebrow">ADMIN · TELEGRAM OTP</span>
        <h1>ចូលផ្ទាំងគ្រប់គ្រង</h1>
        <p className="login-description">បញ្ចូល Telegram ID របស់ Admin ដើម្បីទទួលលេខកូដសម្ងាត់តាម Bot។ លេខកូដមានសុពលភាព 5 នាទី និងអាចប្រើបានតែម្តង។</p>

        {botUsername && <a className="admin-bot-link" href={`https://t.me/${botUsername}?start=admin_login`} target="_blank" rel="noreferrer">បើក Bot ហើយចុច Start <ArrowRight size={14} /></a>}

        <form className="admin-login-form" onSubmit={requestCode}>
          <label htmlFor="admin-telegram-id">Telegram ID</label>
          <input
            id="admin-telegram-id"
            autoComplete="username"
            inputMode="numeric"
            pattern="[0-9]{1,20}"
            value={telegramId}
            onChange={(event) => setTelegramId(event.target.value)}
            required
            placeholder="ឧ. 123456789"
            disabled={loading || codeSent}
          />
          <button className="button button-primary button-full" type="submit" disabled={loading || (codeSent && cooldown > 0)}>
            {loading ? 'កំពុងផ្ញើ…' : codeSent ? cooldown > 0 ? `ផ្ញើម្ដងទៀតក្នុង ${cooldown} វិនាទី` : 'ផ្ញើលេខកូដម្ដងទៀត' : 'ផ្ញើ OTP តាម Telegram'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {codeSent && <form className="admin-login-form admin-otp-form" onSubmit={verifyCode}>
          <label htmlFor="admin-otp-code">លេខកូដ 6 ខ្ទង់</label>
          <input
            id="admin-otp-code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            placeholder="000000"
            disabled={loading}
          />
          <button className="button button-primary button-full" type="submit" disabled={loading || code.length !== 6}>
            {loading ? 'កំពុងផ្ទៀងផ្ទាត់…' : 'ផ្ទៀងផ្ទាត់ និងចូល'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>}

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status"><CheckCircle2 size={16} /> {message}</p>}
        <div className="admin-login-security"><Clock3 size={15} /><span>ផុតកំណត់ក្នុង 5 នាទី · កំណត់ការសាកល្បងខុសត្រឹម 5 ដង</span></div>
        <div className="login-security"><ShieldCheck size={16} /><span>អនុញ្ញាតតែគណនីដែលមានតួនាទី Admin ក្នុង Supabase ប៉ុណ្ណោះ។</span></div>
      </section>
    </div>
  );
}
