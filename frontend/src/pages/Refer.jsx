import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Gift, Percent, Share2, UserPlus, Users } from 'lucide-react';
import { api, rupee, timeAgo } from '../api';
import { Empty, PageLoader, useToast } from '../ui';

export default function Refer() {
  const toast = useToast();
  const [d, setD] = useState(null);
  useEffect(() => { api('/referrals').then(setD).catch(() => setD(false)); }, []);
  if (d === null) return <PageLoader />;
  if (!d) return <Empty icon={Gift} title="Couldn't load referrals" text="Please try again." />;

  const s = d.settings;
  const link = `${window.location.origin}/signup?ref=${d.code}`;
  const message = `Join me on Click&Share and earn money by liking, following and sharing posts! Sign up free with my code ${d.code}: ${link}`;
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Copy failed', 'error'); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Click&Share', text: message, url: link }); return; } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };
  const qualified = d.friends.filter((f) => f.Qualified).length;

  const perks = [
    { Icon: Percent, title: `${s.taskPct}% of their task rewards`, text: `For ${s.taskDays} days after they join. Paid by us, your friend still gets 100% of their reward.` },
    { Icon: Gift, title: `${rupee(s.inviterBonus, 0)} bonus for you`, text: `When your friend completes ${s.minTasks} approved tasks.` },
    { Icon: UserPlus, title: `${rupee(s.friendBonus, 0)} welcome bonus for them`, text: `Your friend also gets a bonus after their first ${s.minTasks} approved tasks.` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Refer &amp; Earn</h1>
        <p className="mt-1 text-sm text-slate-400">Invite friends to Click&amp;Share. You earn every time they complete tasks.</p>
      </div>

      {/* Code card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid gap-5 md:grid-cols-2 md:items-center">
          <div>
            <div className="text-sm font-medium text-white/80">Your referral code</div>
            <button onClick={() => copy(d.code, 'Code')} className="mt-1 inline-flex items-center gap-3 rounded-xl bg-black/20 px-4 py-2 font-mono text-3xl font-extrabold tracking-widest hover:bg-black/30">
              {d.code} <Copy size={20} />
            </button>
            <div className="mt-3 truncate text-xs text-white/70">{link}</div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <button className="btn bg-white text-violet-700 hover:bg-white/90" onClick={share}><Share2 size={16} /> Share invite</button>
            <button className="btn bg-black/20 text-white hover:bg-black/30" onClick={() => copy(link, 'Link')}><Copy size={16} /> Copy link</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ['Friends joined', d.friends.length, Users],
          ['Qualified', qualified, CheckCircle2],
          ['You earned', rupee(d.earned.total), Gift],
        ].map(([label, value, Icon]) => (
          <div key={label} className="card p-4">
            <Icon size={18} className="text-fuchsia-300" />
            <div className="mt-2 text-xs text-slate-400">{label}</div>
            <div className="text-lg font-extrabold sm:text-2xl">{value}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="grid gap-3 md:grid-cols-3">
        {perks.map(({ Icon, title, text }) => (
          <div key={title} className="card p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300"><Icon size={20} /></div>
            <div className="mt-3 font-bold">{title}</div>
            <p className="mt-1 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>

      {/* Friends */}
      <div>
        <h2 className="mb-3 font-bold">Your friends</h2>
        {d.friends.length === 0 ? (
          <Empty icon={UserPlus} title="No friends yet" text="Share your code. Friends who sign up with it appear here." />
        ) : (
          <div className="card divide-y divide-white/5">
            {d.friends.map((f) => (
              <div key={f.Id} className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 font-bold">{f.Name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{f.Name}</div>
                  <div className="text-xs text-slate-500">Joined {timeAgo(f.CreatedAt)} · {f.Approved} tasks done</div>
                  {!f.Qualified && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" style={{ width: `${Math.min(100, (f.Approved / s.minTasks) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-500">{Math.min(f.Approved, s.minTasks)}/{s.minTasks} for bonus</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-300">+{rupee(f.Earned)}</div>
                  {f.Qualified && <div className="text-[11px] font-semibold text-emerald-400">Bonus paid</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-xs text-slate-500">Referral rewards are paid only for real task activity. Fake or duplicate accounts are blocked and their rewards removed.</p>
    </div>
  );
}
