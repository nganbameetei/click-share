import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { api, rupee, timeAgo } from '../api';
import { ACTIONS, Empty, PageLoader, PLATFORMS, PlatformTile, StatusBadge } from '../ui';

export default function History() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/submissions').then(setRows).catch(() => setRows([])); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">My tasks</h1>
        <p className="mt-1 text-sm text-slate-400">Track every task you've done and its review status.</p>
      </div>
      {rows === null ? <PageLoader /> : rows.length === 0 ? (
        <Empty icon={ListChecks} title="No tasks yet" text="Complete your first task to see it here."
               action={<Link to="/app" className="btn-primary">Find tasks</Link>} />
      ) : (
        <div className="card divide-y divide-white/5">
          {rows.map((r) => (
            <div key={r.Id} className="flex items-center gap-3 p-4">
              <PlatformTile platform={r.Platform} size="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.Title}</div>
                <div className="text-xs text-slate-500">
                  {ACTIONS[r.ActionType].label} · {PLATFORMS[r.Platform].label} · {timeAgo(r.CreatedAt)}
                </div>
                {r.Status === 'rejected' && r.RejectReason && <div className="mt-1 text-xs text-rose-300">{r.RejectReason}</div>}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-sm font-bold ${r.Status === 'rejected' ? 'text-slate-500 line-through' : 'text-emerald-300'}`}>+{rupee(r.Reward)}</span>
                <StatusBadge status={r.Status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
