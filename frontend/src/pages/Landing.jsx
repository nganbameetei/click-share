import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Heart, IndianRupee, MousePointerClick, Share2, ShieldCheck, Sparkles, UserPlus, Zap } from 'lucide-react';
import { Logo, PLATFORMS, PlatformTile } from '../ui';
import { api, rupee } from '../api';
import { useAuth } from '../auth';

const RATES = [
  { Icon: Share2, label: 'Share a post', amount: '₹0.02', note: 'per share' },
  { Icon: Heart, label: 'Like a post or video', amount: '₹0.08', note: 'per like' },
  { Icon: UserPlus, label: 'Follow / Subscribe', amount: '₹0.20', note: 'per follow' },
];

const STEPS = [
  { Icon: UserPlus, title: 'Sign up free', text: 'Create your account in 30 seconds. No card needed.' },
  { Icon: MousePointerClick, title: 'Pick a task', text: 'Like, follow or share posts from brands on Facebook, Instagram & YouTube.' },
  { Icon: BadgeCheck, title: 'Upload proof', text: 'Send a quick screenshot. Our team verifies it.' },
  { Icon: IndianRupee, title: 'Withdraw to UPI', text: 'Your earnings land in your wallet. Cash out from ₹100.' },
];

export default function Landing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  useEffect(() => { api('/plans').then(setPlans).catch(() => {}); }, []);
  const cta = user ? '/app' : '/signup';

  return (
    <div className="overflow-x-hidden">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/app" className="btn-primary">Dashboard <ArrowRight size={16} /></Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
              <Link to="/signup" className="btn-primary">Join free</Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-2 lg:pt-16">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-200">
            <Sparkles size={14} /> Earn from your social media time
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            Share. Like. Follow.<br /><span className="gradient-text">Get paid.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-slate-300">
            Brands pay for real engagement. You do simple tasks on Facebook, Instagram and YouTube,
            and the money goes straight to your wallet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={cta} className="btn-primary px-6 py-3.5 text-base">Start earning free <ArrowRight size={18} /></Link>
            <a href="#how" className="btn-ghost px-6 py-3.5 text-base">How it works</a>
          </div>
          <div className="mt-8 flex items-center gap-4 text-sm text-slate-400">
            <div className="flex -space-x-2">
              {Object.keys(PLATFORMS).map((p) => <PlatformTile key={p} platform={p} size="h-9 w-9 ring-2 ring-ink-950" />)}
            </div>
            Works with the apps you already use
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-violet-600/30 via-fuchsia-600/20 to-pink-500/30 blur-3xl" />
          <div className="relative card animate-float p-5">
            <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-5 shadow-glow">
              <div className="text-sm font-medium text-white/80">Wallet balance</div>
              <div className="mt-1 text-4xl font-extrabold">₹248.60</div>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/90">
                <Zap size={14} /> +₹12.40 today
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ['instagram', 'Follow @StyleStreet', '+₹0.20'],
                ['youtube', 'Like "Top 10 Phones"', '+₹0.08'],
                ['facebook', 'Share Monsoon Sale', '+₹0.02'],
              ].map(([p, t, r]) => (
                <div key={t} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                  <PlatformTile platform={p} size="h-10 w-10" />
                  <div className="flex-1 text-sm font-semibold">{t}</div>
                  <div className="text-sm font-bold text-emerald-300">{r}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rates */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {RATES.map(({ Icon, label, amount, note }) => (
            <div key={label} className="card group p-6 transition hover:-translate-y-1 hover:border-fuchsia-500/40">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300 transition group-hover:scale-110"><Icon size={22} /></div>
              <div className="mt-4 text-sm text-slate-400">{label}</div>
              <div className="mt-1 text-3xl font-extrabold">{amount} <span className="text-sm font-medium text-slate-400">{note}</span></div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">Rates vary by campaign. Brands set the budget; you see the exact reward before you start.</p>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-10 px-4 pb-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">How it <span className="gradient-text">works</span></h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text }, i) => (
            <div key={title} className="card relative p-6">
              <div className="absolute right-5 top-4 text-5xl font-extrabold text-white/5">{i + 1}</div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500"><Icon size={20} /></div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      {plans.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Do <span className="gradient-text">more tasks</span> every day</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">Start free with {plans[0]?.DailyTaskLimit} tasks a day. Upgrade for more task slots, and earn extra on every task with Standard and Pro.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.Id} className={`card relative p-6 ${p.Badge ? 'border-fuchsia-500/50 shadow-glow' : ''}`}>
                {p.Badge && <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-1 text-xs font-bold">{p.Badge}</span>}
                <div className="font-bold text-slate-300">{p.Name}</div>
                <div className="mt-2 text-3xl font-extrabold">{p.Price > 0 ? rupee(p.Price, 0) : 'Free'}<span className="text-sm font-medium text-slate-400">{p.Price > 0 ? ' / month' : ''}</span></div>
                <div className="mt-4 text-sm text-slate-300"><span className="font-bold text-white">{p.DailyTaskLimit}</span> tasks per day</div>
                {p.RewardBonusPct > 0 && (
                  <div className="mt-2 inline-flex rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-xs font-bold text-ink-950">+{p.RewardBonusPct}% on every reward</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust + CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="card relative overflow-hidden p-8 text-center sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-pink-500/20" />
          <div className="relative">
            <ShieldCheck className="mx-auto text-fuchsia-300" size={36} />
            <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">Real brands. Real rewards. Paid to UPI.</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-300">Every reward is funded by an advertiser's campaign budget, so earnings are backed by real money.</p>
            <Link to={cta} className="btn-primary mt-6 px-6 py-3.5 text-base">Create free account <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Click&amp;Share. Not affiliated with Meta or Google.
      </footer>
    </div>
  );
}
