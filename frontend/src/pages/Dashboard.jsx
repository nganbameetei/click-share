import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Crown, ExternalLink, ImagePlus, Inbox, Sparkles, TrendingUp, Upload, Wallet, CheckCircle2 } from 'lucide-react';
import { api, rupee } from '../api';
import { useAuth } from '../auth';
import { ACTIONS, Empty, Modal, PageLoader, PLATFORMS, PlatformTile, Spinner, useToast } from '../ui';
import { MediaPreview } from '../media';

const FILTERS = [{ key: '', label: 'All' }, ...Object.entries(PLATFORMS).map(([key, p]) => ({ key, label: p.label }))];

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${accent}`}><Icon size={18} /></div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold sm:text-2xl">{value}</div>
    </div>
  );
}

function TaskCard({ task, onStart }) {
  const p = PLATFORMS[task.Platform];
  const a = ACTIONS[task.ActionType];
  const left = task.TargetCount - task.Taken;
  return (
    <div className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-white/20">
      <button type="button" onClick={() => onStart(task)} className="-mx-1 -mt-1 mb-4 block text-left" aria-label={`Preview ${task.Title}`}>
        <MediaPreview platform={task.Platform} url={task.TargetUrl} compact />
      </button>
      <div className="flex items-start gap-3">
        <PlatformTile platform={task.Platform} />
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${p.text}`}><a.Icon size={13} /> {a.label} on {p.label}</div>
          <h3 className="mt-1 font-bold leading-snug">{task.Title}</h3>
        </div>
      </div>
      {task.Description && <p className="mt-3 line-clamp-2 text-sm text-slate-400">{task.Description}</p>}
      <div className="mt-auto flex items-end justify-between pt-5">
        <div>
          {task.Reward > task.BaseReward && (
            <div className="mb-0.5 flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 line-through">{rupee(task.BaseReward)}</span>
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 font-bold text-ink-950">+{task.BonusPct}% bonus</span>
            </div>
          )}
          <div className="text-2xl font-extrabold text-emerald-300">+{rupee(task.Reward)}</div>
          <div className="text-xs text-slate-500">{left} slots left</div>
        </div>
        <button className="btn-primary" onClick={() => onStart(task)}>Start <ExternalLink size={15} /></button>
      </div>
    </div>
  );
}

function SubmitModal({ task, onClose, onDone }) {
  const toast = useToast();
  const [opened, setOpened] = useState(false);
  const [file, setFile] = useState(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const p = PLATFORMS[task.Platform];
  const a = ACTIONS[task.ActionType];

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast('Please add a screenshot', 'error');
    const form = new FormData();
    form.append('proof', file);
    form.append('handle', handle);
    setBusy(true);
    try {
      const { me } = await api(`/tasks/${task.Id}/submit`, { method: 'POST', form });
      toast('Submitted! Reward is pending review.');
      onDone(me);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={task.Title}>
      <div className="-mr-2 max-h-[78vh] overflow-y-auto pr-2">
      <MediaPreview platform={task.Platform} url={task.TargetUrl} className="mb-5" />
      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${opened ? 'bg-emerald-500 text-white' : 'bg-white/10'}`}>
            {opened ? <CheckCircle2 size={15} /> : 1}
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">{a.label} the post on {p.label}</div>
            <a href={task.TargetUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}
               className="btn-ghost mt-2 w-full">Open {p.label} <ExternalLink size={15} /></a>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">2</span>
          <form className="flex-1 space-y-3" onSubmit={submit}>
            <div className="text-sm font-semibold">Upload a screenshot as proof</div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-slate-400 transition hover:border-fuchsia-500/50">
              {preview
                ? <img src={preview} alt="Proof preview" className="max-h-40 rounded-lg object-contain" />
                : <><ImagePlus size={26} className="text-fuchsia-300" /> Tap to choose image (PNG/JPG, max 5MB)</>}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <input className="input" placeholder={`Your ${p.label} username`} value={handle} onChange={(e) => setHandle(e.target.value)} />
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Spinner /> : <><Upload size={16} /> Submit &amp; earn {rupee(task.Reward)}</>}
            </button>
          </form>
        </li>
      </ol>
      </div>
    </Modal>
  );
}

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(null);

  const load = () => api(`/tasks${filter ? `?platform=${filter}` : ''}`).then(setTasks).catch(() => setTasks([]));
  useEffect(() => { setTasks(null); load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const used = user.TodayCount, limit = user.DailyTaskLimit;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const limitHit = used >= limit;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Hello, {user.Name.split(' ')[0]} 👋</p>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Ready to earn today?</h1>
        </div>
        {user.RewardBonusPct > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400/20 to-orange-500/20 px-4 py-2.5 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/40">
            <Crown size={16} /> {user.PlanName}: +{user.RewardBonusPct}% on every task
          </span>
        ) : (
          <Link to="/app/plans" className="btn-ghost border-fuchsia-500/30 text-fuchsia-200"><Crown size={16} /> Earn up to 25% more per task</Link>
        )}
      </div>

      {/* Balance + stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 shadow-glow lg:row-span-2">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80"><Wallet size={16} /> Wallet balance</div>
            <div className="mt-2 text-4xl font-extrabold sm:text-5xl">{rupee(user.Balance)}</div>
            <div className="mt-1 text-sm text-white/80">+ {rupee(user.PendingEarning)} pending review</div>
            <div className="mt-6">
              <div className="flex justify-between text-xs font-semibold text-white/90">
                <span>Today's tasks</span><span>{used} / {limit}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/25">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <Link to="/app/wallet" className="btn mt-6 w-full bg-white/95 text-violet-700 hover:bg-white">Withdraw to UPI</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <Stat icon={TrendingUp} label="Total earned" value={rupee(user.TotalEarned)} accent="bg-emerald-500/15 text-emerald-300" />
          <Stat icon={CheckCircle2} label="Tasks approved" value={user.ApprovedCount} accent="bg-sky-500/15 text-sky-300" />
          <Stat icon={Clock} label="Pending reward" value={rupee(user.PendingEarning)} accent="bg-amber-500/15 text-amber-300" />
          <Stat icon={Crown} label="Your plan" value={user.PlanName} accent="bg-fuchsia-500/15 text-fuchsia-300" />
        </div>
      </div>

      {/* Tasks */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Sparkles size={20} className="text-fuchsia-300" /> Available tasks</h2>
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1">
            {FILTERS.map((f) => (
              <button key={f.key} className={`tab ${filter === f.key ? 'tab-active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>

        {limitHit && (
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-sm"><b>Daily limit reached.</b> Come back tomorrow or upgrade to do more tasks today.</div>
            <Link to="/app/plans" className="btn-primary">See plans</Link>
          </div>
        )}

        {tasks === null ? <PageLoader /> : tasks.length === 0 ? (
          <Empty icon={Inbox} title="No tasks right now" text="New campaigns are added every day. Check back soon!" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.map((t) => <TaskCard key={t.Id} task={t} onStart={limitHit ? () => {} : setActive} />)}
          </div>
        )}
      </section>

      {active && (
        <SubmitModal task={active} onClose={() => setActive(null)}
          onDone={(me) => { setUser(me); setActive(null); load(); }} />
      )}
    </div>
  );
}
