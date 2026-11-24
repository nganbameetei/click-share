import { useEffect, useState } from 'react';
import { Check, Copy, Crown } from 'lucide-react';
import { api, rupee, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Modal, PageLoader, Spinner, StatusBadge, useToast } from '../ui';

export default function Plans() {
  const { user } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [requests, setRequests] = useState([]);
  const [cfg, setCfg] = useState({});
  const [buy, setBuy] = useState(null);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api('/plans').then(setPlans).catch(() => setPlans([]));
    api('/plans/purchases').then(setRequests).catch(() => {});
  };
  useEffect(() => { load(); api('/config').then(setCfg).catch(() => {}); }, []);

  if (!plans) return <PageLoader />;
  const hasPending = requests.some((r) => r.Status === 'pending');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/plans/${buy.Id}/purchase`, { method: 'POST', body: { paymentRef: utr } });
      toast('Request sent! Your plan activates once payment is verified.');
      setBuy(null); setUtr(''); load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(cfg.paymentUpiId); toast('UPI ID copied'); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Choose your plan</h1>
        <p className="mt-1 text-sm text-slate-400">More task slots every day. Rewards come from brand campaigns, so earnings depend on available tasks.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const current = p.Id === user.PlanId;
          return (
            <div key={p.Id} className={`card relative flex flex-col p-6 ${p.Badge ? 'border-fuchsia-500/50 shadow-glow' : ''} ${current ? 'ring-2 ring-emerald-500/60' : ''}`}>
              {p.Badge && <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-1 text-xs font-bold">{p.Badge}</span>}
              <div className="flex items-center gap-2 font-bold text-slate-300"><Crown size={16} className="text-fuchsia-300" /> {p.Name}</div>
              <div className="mt-3 text-4xl font-extrabold">{p.Price > 0 ? rupee(p.Price, 0) : 'Free'}</div>
              <div className="text-sm text-slate-400">{p.Price > 0 ? `for ${p.DurationDays} days` : 'forever'}</div>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> <b>{p.DailyTaskLimit}</b>&nbsp;tasks per day</li>
                {p.RewardBonusPct > 0 && (
                  <li className="flex gap-2 font-semibold text-amber-200"><Check size={16} className="text-amber-400" /> +{p.RewardBonusPct}% extra on every task reward</li>
                )}
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> All platforms</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> UPI withdrawals</li>
                {p.Price >= 249 && <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> Priority proof review</li>}
              </ul>
              <div className="mt-auto pt-6">
                {current ? (
                  <div className="btn w-full bg-emerald-500/15 text-emerald-300">
                    Current plan{user.PlanExpiresAt && p.Price > 0 ? ` · till ${new Date(user.PlanExpiresAt).toLocaleDateString('en-IN')}` : ''}
                  </div>
                ) : p.Price > 0 ? (
                  <button className={p.Badge ? 'btn-primary w-full' : 'btn-ghost w-full'} disabled={hasPending} onClick={() => setBuy(p)}>
                    {hasPending ? 'Request under review' : `Get ${p.Name}`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {requests.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold">Your plan requests</h2>
          <div className="card divide-y divide-white/5">
            {requests.map((r) => (
              <div key={r.Id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.PlanName} · {rupee(r.Amount, 0)}</div>
                  <div className="text-xs text-slate-500">
                    {r.PaymentRef === 'ADMIN' ? 'Activated by admin' : `UTR ${r.PaymentRef}`} · {timeAgo(r.CreatedAt)}
                    {r.ExpiresAt ? ` · until ${new Date(r.ExpiresAt).toLocaleDateString('en-IN')}` : ''}
                  </div>
                </div>
                <StatusBadge status={r.Status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!buy} onClose={() => setBuy(null)} title={`Activate ${buy?.Name} plan`}>
        {buy && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="text-sm text-slate-400">Pay exactly</div>
              <div className="text-3xl font-extrabold">{rupee(buy.Price, 0)}</div>
              <div className="mt-3 text-sm text-slate-400">to UPI ID</div>
              <button type="button" onClick={copy} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 font-mono text-sm font-semibold hover:bg-white/15">
                {cfg.paymentUpiId} <Copy size={14} />
              </button>
            </div>
            <div>
              <label className="label">UPI transaction ID / UTR</label>
              <input className="input font-mono" placeholder="e.g. 412345678901" value={utr} onChange={(e) => setUtr(e.target.value)} required />
            </div>
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Submit for verification'}</button>
            <p className="text-center text-xs text-slate-500">Plans activate after our team confirms the payment (usually within a few hours).</p>
          </form>
        )}
      </Modal>
    </div>
  );
}
