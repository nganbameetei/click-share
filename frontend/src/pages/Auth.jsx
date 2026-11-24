import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Gift, Lock, Mail, Phone, User } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Logo, Spinner, useToast } from '../ui';

function Field({ icon: Icon, className = 'input pl-11', ...props }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
      <input className={className} {...props} />
    </div>
  );
}

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-rise">
        <Link to="/" className="mb-8 flex justify-center"><Logo /></Link>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-400">{footer}</p>
      </div>
    </div>
  );
}

function useSubmit(path, form) {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(path, form);
      navigate(u.Role === 'admin' ? '/admin' : '/app');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { busy, submit } = useSubmit('/auth/login', form);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <AuthCard title="Welcome back 👋" subtitle="Log in to continue earning."
      footer={<>New here? <Link to="/signup" className="font-semibold text-fuchsia-300 hover:underline">Create a free account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={set('email')} required autoComplete="email" />
        <Field icon={Lock} type="password" placeholder="Password" value={form.password} onChange={set('password')} required autoComplete="current-password" />
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Log in'}</button>
      </form>
    </AuthCard>
  );
}

export function Signup() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', ref: (params.get('ref') || '').toUpperCase() });
  const [inviter, setInviter] = useState(null);
  const { busy, submit } = useSubmit('/auth/signup', form);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Show who invited them for a valid code
  useEffect(() => {
    const code = form.ref.trim();
    setInviter(null);
    if (code.length < 6) return;
    const t = setTimeout(() => {
      api(`/referral/${encodeURIComponent(code)}`).then(setInviter).catch(() => setInviter(false));
    }, 300);
    return () => clearTimeout(t);
  }, [form.ref]);
  return (
    <AuthCard title="Start earning today ✨" subtitle="Free forever. 10 tasks a day on the free plan."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-fuchsia-300 hover:underline">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={User} placeholder="Full name" value={form.name} onChange={set('name')} required autoComplete="name" />
        <Field icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={set('email')} required autoComplete="email" />
        <Field icon={Phone} type="tel" placeholder="Mobile number (optional)" value={form.phone} onChange={set('phone')} autoComplete="tel" />
        <Field icon={Lock} type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" />
        <div>
          <Field icon={Gift} placeholder="Referral code (optional)" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value.toUpperCase() })} className="input pl-11 font-mono uppercase" />
          {inviter && <p className="mt-1.5 text-xs font-semibold text-emerald-300">🎉 Invited by {inviter.name}. Get a ₹{inviter.friendBonus} bonus after {inviter.minTasks} tasks!</p>}
          {inviter === false && <p className="mt-1.5 text-xs text-rose-300">This referral code isn't valid.</p>}
        </div>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Create free account'}</button>
        <p className="text-center text-xs text-slate-500">By signing up you agree to our terms. One account per person.</p>
      </form>
    </AuthCard>
  );
}
