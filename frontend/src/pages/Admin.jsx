import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, ExternalLink, Inbox, Megaphone, Pause, Play, Plus, Search, X } from 'lucide-react';
import { api, rupee, timeAgo } from '../api';
import { ACTIONS, Empty, Modal, PageLoader, PLATFORMS, PlatformTile, Spinner, StatusBadge, useToast } from '../ui';

const TABS = [
  ['overview', 'Overview'], ['proofs', 'Proofs'], ['campaigns', 'Campaigns'],
  ['withdrawals', 'Withdrawals'], ['plans', 'Plan requests'], ['users', 'Users'],
];

function useList(path) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api(path).then(setRows).catch(() => setRows([])), [path]);
  useEffect(() => { setRows(null); load(); }, [load]);
  return [rows, load];
}

function useAction(after) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const run = async (id, path, body, msg) => {
    setBusyId(id);
    try { await api(path, { method: 'POST', body: body || {} }); toast(msg); after(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusyId(null); }
  };
  return [busyId, run];
}

function StatusFilter({ value, onChange, options }) {
  return (
    <div className="mb-4 inline-flex gap-1 rounded-2xl bg-white/5 p-1">
      {options.map((o) => <button key={o} className={`tab capitalize ${value === o ? 'tab-active' : ''}`} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ goto }) {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <PageLoader />;
  const margin = s.AdvertiserRevenue - s.UserPayouts;
  const cards = [
    ['Users', s.Users, `${s.PaidUsers} on paid plans`],
    ['Active campaigns', s.ActiveCampaigns, 'running now'],
    ['Advertiser revenue', rupee(s.AdvertiserRevenue), 'from approved actions'],
    ['User rewards', rupee(s.UserPayouts), 'credited to wallets'],
    ['Task margin', rupee(margin), s.AdvertiserRevenue ? `${Math.round((margin / s.AdvertiserRevenue) * 100)}% of revenue` : '—'],
    ['Plan revenue', rupee(s.PlanRevenue), 'approved purchases'],
    ['Withdrawn', rupee(s.Withdrawn), 'paid out to UPI'],
    ['Wallet liability', rupee(s.Liability), 'owed to users'],
  ];
  const queues = [
    ['proofs', 'Proofs to review', s.PendingSubmissions],
    ['withdrawals', 'Withdrawals to pay', s.PendingWithdrawals],
    ['plans', 'Plan payments to verify', s.PendingPlans],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {queues.map(([tab, label, n]) => (
          <button key={tab} onClick={() => goto(tab)} className={`card p-5 text-left transition hover:-translate-y-0.5 ${n ? 'border-amber-500/40' : ''}`}>
            <div className="text-sm text-slate-400">{label}</div>
            <div className={`mt-1 text-3xl font-extrabold ${n ? 'text-amber-300' : ''}`}>{n}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([label, value, sub]) => (
          <div key={label} className="card p-5">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-extrabold sm:text-2xl">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Proofs ---------------- */
function Proofs() {
  const [status, setStatus] = useState('pending');
  const [rows, load] = useList(`/admin/submissions?status=${status}`);
  const [busyId, run] = useAction(load);
  const [zoom, setZoom] = useState(null);
  return (
    <>
      <StatusFilter value={status} onChange={setStatus} options={['pending', 'approved', 'rejected']} />
      {rows === null ? <PageLoader /> : rows.length === 0 ? <Empty icon={Inbox} title="Nothing here" text="All caught up!" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.Id} className="card flex flex-col overflow-hidden">
              <button className="aspect-video bg-black/40" onClick={() => setZoom(r.ProofImage)}>
                {r.ProofImage && <img src={r.ProofImage} alt="Proof" className="h-full w-full object-contain" />}
              </button>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <PlatformTile platform={r.Platform} size="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.Title}</div>
                    <div className="text-xs text-slate-500">{ACTIONS[r.ActionType].label} · +{rupee(r.Reward)}</div>
                  </div>
                  <a href={r.TargetUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white" aria-label="Open target"><ExternalLink size={16} /></a>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  <b className="text-slate-200">{r.UserName}</b> ({r.UserEmail}){r.ProofHandle ? <> · @{r.ProofHandle}</> : null} · {timeAgo(r.CreatedAt)}
                </div>
                {r.Status === 'pending' ? (
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <button className="btn-danger" disabled={busyId === r.Id}
                      onClick={() => { const reason = prompt('Reason for rejection?', 'Screenshot does not show the action'); if (reason !== null) run(r.Id, `/admin/submissions/${r.Id}/reject`, { reason }, 'Rejected'); }}>
                      <X size={16} /> Reject
                    </button>
                    <button className="btn-success" disabled={busyId === r.Id} onClick={() => run(r.Id, `/admin/submissions/${r.Id}/approve`, null, 'Approved & credited')}>
                      {busyId === r.Id ? <Spinner /> : <><Check size={16} /> Approve</>}
                    </button>
                  </div>
                ) : <div className="mt-auto pt-4"><StatusBadge status={r.Status} /></div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Proof screenshot">
        {zoom && <img src={zoom} alt="Proof" className="max-h-[70vh] w-full rounded-lg object-contain" />}
      </Modal>
    </>
  );
}

/* ---------------- Campaigns ---------------- */
const EMPTY_CAMPAIGN = { title: '', description: '', platform: 'instagram', actionType: 'like', targetUrl: '', advertiserRate: '0.20', userReward: '', targetCount: '500' };

function Campaigns() {
  const toast = useToast();
  const [rows, load] = useList('/admin/campaigns');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_CAMPAIGN);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reward = f.userReward || (Number(f.advertiserRate) * 0.4).toFixed(4);
  const budget = Number(f.advertiserRate) * Number(f.targetCount);
  const payout = Number(reward) * Number(f.targetCount);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/admin/campaigns', { method: 'POST', body: f });
      toast('Campaign created'); setOpen(false); setF(EMPTY_CAMPAIGN); load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const setStatus = async (id, status) => {
    try { await api(`/admin/campaigns/${id}/status`, { method: 'PATCH', body: { status } }); load(); }
    catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New campaign</button></div>
      {rows === null ? <PageLoader /> : rows.length === 0 ? <Empty icon={Megaphone} title="No campaigns" text="Create one to give users tasks." /> : (
        <div className="card divide-y divide-white/5">
          {rows.map((c) => {
            const pct = Math.round((c.CompletedCount / c.TargetCount) * 100);
            return (
              <div key={c.Id} className="flex flex-wrap items-center gap-4 p-4">
                <PlatformTile platform={c.Platform} size="h-10 w-10" />
                <div className="min-w-[12rem] flex-1">
                  <div className="text-sm font-semibold">{c.Title}</div>
                  <div className="text-xs text-slate-500">
                    {ACTIONS[c.ActionType].label} · Advertiser {rupee(c.AdvertiserRate, 2)} · User {rupee(c.UserReward, 2)} · {c.PendingCount} pending
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${pct}%` }} /></div>
                    <span className="text-xs text-slate-400">{c.CompletedCount}/{c.TargetCount}</span>
                  </div>
                </div>
                <StatusBadge status={c.Status} />
                {c.Status === 'active' && <button className="btn-ghost" onClick={() => setStatus(c.Id, 'paused')}><Pause size={15} /> Pause</button>}
                {c.Status === 'paused' && <button className="btn-ghost" onClick={() => setStatus(c.Id, 'active')}><Play size={15} /> Resume</button>}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New campaign">
        <form onSubmit={create} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={set('title')} required /></div>
          <div><label className="label">Description</label><input className="input" value={f.description} onChange={set('description')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Platform</label>
              <select className="input" value={f.platform} onChange={set('platform')}>{Object.entries(PLATFORMS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></div>
            <div><label className="label">Action</label>
              <select className="input" value={f.actionType} onChange={set('actionType')}>{Object.entries(ACTIONS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}</select></div>
          </div>
          <div><label className="label">Target URL</label><input className="input" type="url" value={f.targetUrl} onChange={set('targetUrl')} required /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Adv. rate ₹</label><input className="input" type="number" step="0.0001" min="0.0001" value={f.advertiserRate} onChange={set('advertiserRate')} required /></div>
            <div><label className="label">User ₹</label><input className="input" type="number" step="0.0001" placeholder={reward} value={f.userReward} onChange={set('userReward')} /></div>
            <div><label className="label">Target</label><input className="input" type="number" min="1" value={f.targetCount} onChange={set('targetCount')} required /></div>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-xs text-slate-300">
            Advertiser pays <b>{rupee(budget)}</b> · Users get <b>{rupee(payout)}</b> · Your margin <b className="text-emerald-300">{rupee(budget - payout)}</b>
          </div>
          <button className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner /> : 'Create campaign'}</button>
        </form>
      </Modal>
    </>
  );
}

/* ---------------- Withdrawals ---------------- */
function Withdrawals() {
  const [status, setStatus] = useState('pending');
  const [rows, load] = useList(`/admin/withdrawals?status=${status}`);
  const [busyId, run] = useAction(load);
  return (
    <>
      <StatusFilter value={status} onChange={setStatus} options={['pending', 'paid', 'rejected']} />
      {rows === null ? <PageLoader /> : rows.length === 0 ? <Empty icon={Inbox} title="Nothing here" /> : (
        <div className="card divide-y divide-white/5">
          {rows.map((w) => (
            <div key={w.Id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[12rem] flex-1">
                <div className="font-bold">{rupee(w.Amount)} <span className="font-mono text-sm font-medium text-slate-300">→ {w.UpiId}</span></div>
                <div className="text-xs text-slate-500">{w.UserName} ({w.UserEmail}) · {timeAgo(w.CreatedAt)}</div>
              </div>
              {w.Status === 'pending' ? (
                <div className="flex gap-2">
                  <button className="btn-danger" disabled={busyId === w.Id}
                    onClick={() => { const note = prompt('Reason (amount is refunded to wallet)?', 'Invalid UPI ID'); if (note !== null) run(w.Id, `/admin/withdrawals/${w.Id}/reject`, { note }, 'Rejected & refunded'); }}>
                    <X size={16} /> Reject
                  </button>
                  <button className="btn-success" disabled={busyId === w.Id}
                    onClick={() => { const note = prompt('UPI transaction ref (optional)', ''); if (note !== null) run(w.Id, `/admin/withdrawals/${w.Id}/paid`, { note }, 'Marked as paid'); }}>
                    <Check size={16} /> Mark paid
                  </button>
                </div>
              ) : <StatusBadge status={w.Status} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Plan requests ---------------- */
function PlanRequests() {
  const [status, setStatus] = useState('pending');
  const [rows, load] = useList(`/admin/purchases?status=${status}`);
  const [busyId, run] = useAction(load);
  return (
    <>
      <StatusFilter value={status} onChange={setStatus} options={['pending', 'approved', 'rejected']} />
      {rows === null ? <PageLoader /> : rows.length === 0 ? <Empty icon={Inbox} title="Nothing here" /> : (
        <div className="card divide-y divide-white/5">
          {rows.map((p) => (
            <div key={p.Id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-[12rem] flex-1">
                <div className="font-bold">{p.PlanName} · {rupee(p.Amount, 0)}</div>
                <div className="text-xs text-slate-500">{p.UserName} ({p.UserEmail}) · UTR <span className="font-mono">{p.PaymentRef}</span> · {timeAgo(p.CreatedAt)}</div>
              </div>
              {p.Status === 'pending' ? (
                <div className="flex gap-2">
                  <button className="btn-danger" disabled={busyId === p.Id} onClick={() => run(p.Id, `/admin/purchases/${p.Id}/reject`, null, 'Rejected')}><X size={16} /> Reject</button>
                  <button className="btn-success" disabled={busyId === p.Id} onClick={() => run(p.Id, `/admin/purchases/${p.Id}/approve`, null, 'Plan activated')}><Check size={16} /> Approve</button>
                </div>
              ) : <StatusBadge status={p.Status} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Users ---------------- */
function Users() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [rows, load] = useList(`/admin/users?q=${encodeURIComponent(search)}`);
  const [busyId, run] = useAction(load);
  return (
    <>
      <form className="relative mb-4 max-w-sm" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input className="input pl-11" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {rows === null ? <PageLoader /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>{['User', 'Plan', 'Balance', 'Earned', 'Joined', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((u) => (
                <tr key={u.Id} className={u.IsBlocked ? 'opacity-50' : ''}>
                  <td className="px-4 py-3"><div className="font-semibold">{u.Name} {u.Role !== 'user' && <span className="ml-1 rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] uppercase text-fuchsia-300">{u.Role}</span>}</div><div className="text-xs text-slate-500">{u.Email}</div></td>
                  <td className="px-4 py-3">{u.PlanName}</td>
                  <td className="px-4 py-3 font-semibold">{rupee(u.Balance)}</td>
                  <td className="px-4 py-3">{rupee(u.TotalEarned)}</td>
                  <td className="px-4 py-3 text-slate-400">{timeAgo(u.CreatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.Role !== 'admin' && (
                      <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busyId === u.Id} onClick={() => run(u.Id, `/admin/users/${u.Id}/block`, null, u.IsBlocked ? 'Unblocked' : 'Blocked')}>
                        <Ban size={14} /> {u.IsBlocked ? 'Unblock' : 'Block'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Admin panel</h1>
        <p className="mt-1 text-sm text-slate-400">Review proofs, run campaigns and process payouts.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1">
        {TABS.map(([k, label]) => <button key={k} className={`tab ${tab === k ? 'tab-active' : ''}`} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'overview' && <Overview goto={setTab} />}
      {tab === 'proofs' && <Proofs />}
      {tab === 'campaigns' && <Campaigns />}
      {tab === 'withdrawals' && <Withdrawals />}
      {tab === 'plans' && <PlanRequests />}
      {tab === 'users' && <Users />}
    </div>
  );
}
