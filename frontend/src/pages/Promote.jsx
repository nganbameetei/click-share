import { useEffect, useState } from 'react';
import { Copy, Megaphone, Pause, Play, Plus, Rocket, Square, Wallet as WalletIcon } from 'lucide-react';
import { api, rupee, timeAgo } from '../api';
import { useAuth } from '../auth';
import { ACTIONS, Empty, Modal, PageLoader, PLATFORMS, PlatformTile, Spinner, StatusBadge, useToast } from '../ui';
import { MediaPreview } from '../media';

const isUrl = (v) => { try { return /^https?:/.test(new URL(v).protocol); } catch { return false; } };

const EMPTY = { title: '', description: '', platform: 'instagram', actionType: 'like', targetUrl: '', targetCount: 50 };
const PLACEHOLDER = {
  facebook: 'https://www.facebook.com/yourpage/posts/…',
  instagram: 'https://www.instagram.com/p/…',
  youtube: 'https://www.youtube.com/watch?v=…',
};

/** What to show as the task's status */
const shownStatus = (c) => (c.ReviewStatus === 'pending' ? 'review' : c.ReviewStatus === 'rejected' ? 'rejected' : c.Status);

function NewTaskForm({ pricing, balance, onCreated, onAddFunds }) {
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const price = pricing.prices[f.actionType];
  const count = Math.max(0, Math.floor(Number(f.targetCount) || 0));
  const cost = Math.round(price * count * 100) / 100;
  const short = cost > balance;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/promote/campaigns', { method: 'POST', body: { ...f, targetCount: count } });
      toast(pricing.autoApprove ? 'Task posted and live! Users can see it now.' : 'Task posted! Other users will see it after admin approval.');
      setF(EMPTY);
      onCreated();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
      <div className="flex items-center gap-2 font-bold"><Rocket size={18} className="text-fuchsia-300" /> Post a new task</div>

      {/* Platform picker */}
      <div>
        <label className="label">Platform</label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(PLATFORMS).map(([key, p]) => (
            <button type="button" key={key} onClick={() => setF({ ...f, platform: key })}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-semibold transition ${f.platform === key ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5'}`}>
              <PlatformTile platform={key} size="h-8 w-8" />
              <span className="w-full truncate text-center">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action picker with price */}
      <div>
        <label className="label">What should people do?</label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACTIONS).map(([key, a]) => (
            <button type="button" key={key} onClick={() => setF({ ...f, actionType: key })}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-3 text-center transition ${f.actionType === key ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5'}`}>
              <a.Icon size={18} className="text-fuchsia-300" />
              <div className="text-xs font-semibold">{a.label}</div>
              <div className="text-[11px] text-slate-400">{rupee(pricing.prices[key])} each</div>
            </button>
          ))}
        </div>
      </div>

      <div><label className="label">Link to your post / page / channel</label>
        <input className="input" type="url" placeholder={PLACEHOLDER[f.platform]} value={f.targetUrl} onChange={set('targetUrl')} required />
        {isUrl(f.targetUrl) && (
          <div className="mt-2">
            <div className="mb-1 text-[11px] text-slate-500">Preview: this is what users will see</div>
            <MediaPreview platform={f.platform} url={f.targetUrl} compact />
          </div>
        )}</div>
      <div><label className="label">Title shown to users</label>
        <input className="input" placeholder="e.g. Like my new cooking reel" maxLength={120} value={f.title} onChange={set('title')} required /></div>
      <div><label className="label">Note for users (optional)</label>
        <input className="input" placeholder="e.g. Watch till the end before liking" maxLength={300} value={f.description} onChange={set('description')} /></div>
      <div>
        <label className="label">How many people? (min {pricing.minTarget})</label>
        <input className="input" type="number" min={pricing.minTarget} max={pricing.maxTarget} value={f.targetCount} onChange={set('targetCount')} required />
        <div className="mt-2 flex flex-wrap gap-2">
          {[25, 50, 100, 500].map((n) => (
            <button type="button" key={n} className={`rounded-lg px-3 py-1 text-xs font-semibold ${count === n ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              onClick={() => setF({ ...f, targetCount: n })}>{n}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-4">
        <div>
          <div className="text-xs text-slate-400">Total cost</div>
          <div className="text-2xl font-extrabold">{rupee(cost)}</div>
          <div className="text-xs text-slate-500">{count} × {rupee(price)} · paid from ad credits first, then earnings</div>
        </div>
        {short ? (
          <button type="button" className="btn-primary" onClick={onAddFunds}><Plus size={16} /> Add {rupee(Math.ceil(cost - balance), 0)}+</button>
        ) : (
          <button className="btn-primary" disabled={busy || count < pricing.minTarget}>{busy ? <Spinner /> : <><Rocket size={16} /> Post task</>}</button>
        )}
      </div>
    </form>
  );
}

function AddFundsModal({ open, onClose, pricing, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/promote/deposits', { method: 'POST', body: { amount: Number(amount), paymentRef: utr } });
      toast('Request sent! Credits are added after we verify the payment.');
      setAmount(''); setUtr(''); onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(pricing.paymentUpiId); toast('UPI ID copied'); } catch { /* ignore */ } };
  return (
    <Modal open={open} onClose={onClose} title="Add funds for promotion">
      {!pricing.paymentUpiId ? (
        <p className="text-sm text-slate-300">Adding funds isn't available yet. Please check back soon.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <div className="text-sm text-slate-400">Pay any amount (min {rupee(pricing.minDeposit, 0)}) to UPI ID</div>
            <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 font-mono text-sm font-semibold hover:bg-white/15">
              {pricing.paymentUpiId} <Copy size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount paid (₹)</label>
              <input className="input" type="number" min={pricing.minDeposit} value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div><label className="label">UTR number</label>
              <input className="input font-mono" placeholder="412345678901" value={utr} onChange={(e) => setUtr(e.target.value)} required /></div>
          </div>
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Submit for verification'}</button>
          <p className="text-center text-xs text-slate-500">Ad credits can only be used to promote posts. They can't be withdrawn.</p>
        </form>
      )}
    </Modal>
  );
}

export default function Promote() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [pricing, setPricing] = useState(null);
  const [me, setMe] = useState(null);
  const [mine, setMine] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [fundsOpen, setFundsOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const [p, m, c, d] = await Promise.all([api('/promote/pricing'), api('/me'), api('/promote/campaigns'), api('/promote/deposits')]);
    setPricing(p); setMe(m); setUser(m); setMine(c); setDeposits(d);
  };
  useEffect(() => { load().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pricing || !me || !mine) return <PageLoader />;
  const balance = me.AdBalance + me.Balance;
  const pendingDeposits = deposits.filter((d) => d.Status === 'pending');

  const act = async (c, action) => {
    if (action === 'cancel' && !confirmStop(c)) return;
    setBusyId(c.Id);
    try {
      const r = await api(`/promote/campaigns/${c.Id}/${action}`, { method: 'POST' });
      toast(action === 'cancel' ? `Stopped. ${rupee(r.refund)} returned to ad credits.` : action === 'pause' ? 'Paused' : 'Resumed');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Promote your posts</h1>
        <p className="mt-1 text-sm text-slate-400">Get real likes, follows and shares from Click&amp;Share users. You only pay for the people you ask for.</p>
      </div>

      {/* Balances */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs text-slate-400">Ad credits</div>
          <div className="mt-1 text-2xl font-extrabold text-fuchsia-200">{rupee(me.AdBalance)}</div>
          <div className="text-xs text-slate-500">For promotion only</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-slate-400">Earnings you can use</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-300">{rupee(me.Balance)}</div>
          <div className="text-xs text-slate-500">From tasks you did</div>
        </div>
        <button onClick={() => setFundsOpen(true)} className="card flex flex-col items-start justify-center p-5 text-left transition hover:-translate-y-0.5 hover:border-fuchsia-500/40">
          <div className="flex items-center gap-2 font-bold"><WalletIcon size={18} className="text-fuchsia-300" /> Add funds</div>
          <div className="mt-1 text-xs text-slate-400">
            {pendingDeposits.length ? `${pendingDeposits.length} payment${pendingDeposits.length > 1 ? 's' : ''} being verified` : 'Pay by UPI to get ad credits'}
          </div>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <NewTaskForm pricing={pricing} balance={balance} onCreated={load} onAddFunds={() => setFundsOpen(true)} />
        </div>

        <div className="space-y-3 xl:col-span-3">
          <h2 className="flex items-center gap-2 font-bold"><Megaphone size={18} className="text-fuchsia-300" /> My posted tasks</h2>
          {mine.length === 0 ? (
            <Empty icon={Megaphone} title="No tasks posted yet" text="Post your first task and real users will start liking, following or sharing." />
          ) : mine.map((c) => {
            const pct = Math.round((c.CompletedCount / c.TargetCount) * 100);
            const st = shownStatus(c);
            return (
              <div key={c.Id} className="card p-4">
                <div className="flex items-start gap-3">
                  <PlatformTile platform={c.Platform} size="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{c.Title}</span>
                      <StatusBadge status={st} />
                    </div>
                    <div className="text-xs text-slate-500">{ACTIONS[c.ActionType].label} · {rupee(c.Price)} each · paid {rupee(c.Budget)} · {timeAgo(c.CreatedAt)}</div>
                    {c.RejectReason && <div className="mt-1 text-xs text-rose-300">{c.RejectReason}</div>}
                    {st === 'review' && <div className="mt-1.5 rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-xs text-violet-200">⏳ Waiting for admin approval. Other users will see this task once it's approved.</div>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">{c.CompletedCount}/{c.TargetCount} done{c.PendingCount ? ` · ${c.PendingCount} checking` : ''}</span>
                </div>
                {st !== 'completed' && st !== 'rejected' && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {st === 'active' && <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busyId === c.Id} onClick={() => act(c, 'pause')}><Pause size={14} /> Pause</button>}
                    {st === 'paused' && <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busyId === c.Id} onClick={() => act(c, 'resume')}><Play size={14} /> Resume</button>}
                    <button className="btn-ghost px-3 py-1.5 text-xs text-rose-300" disabled={busyId === c.Id} onClick={() => act(c, 'cancel')}><Square size={14} /> Stop &amp; refund</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AddFundsModal open={fundsOpen} onClose={() => setFundsOpen(false)} pricing={pricing}
        onDone={() => { setFundsOpen(false); load(); }} />
    </div>
  );
}

function confirmStop(c) {
  const left = c.TargetCount - c.CompletedCount - c.PendingCount;
  return window.confirm(`Stop "${c.Title}"? Unused slots (${Math.max(0, left)}) are refunded to your ad credits.`);
}
