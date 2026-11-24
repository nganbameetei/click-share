import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, X, XCircle, Heart, Share2, UserPlus } from 'lucide-react';

/* ---------- Brand icons (inline SVG) ---------- */
export const FacebookIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z" />
  </svg>
);
export const InstagramIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const YoutubeIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
  </svg>
);

export const PLATFORMS = {
  facebook:  { label: 'Facebook',  Icon: FacebookIcon,  tile: 'bg-[#1877F2]', text: 'text-[#5b9dff]' },
  instagram: { label: 'Instagram', Icon: InstagramIcon, tile: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]', text: 'text-pink-400' },
  youtube:   { label: 'YouTube',   Icon: YoutubeIcon,   tile: 'bg-[#FF0000]', text: 'text-red-400' },
};

export const ACTIONS = {
  share:  { label: 'Share',  Icon: Share2 },
  like:   { label: 'Like',   Icon: Heart },
  follow: { label: 'Follow', Icon: UserPlus },
};

export function PlatformTile({ platform, size = 'h-11 w-11' }) {
  const p = PLATFORMS[platform];
  return (
    <div className={`${size} ${p.tile} grid shrink-0 place-items-center rounded-xl text-white shadow-lg`}>
      <p.Icon className="h-1/2 w-1/2" />
    </div>
  );
}

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-glow">
        <Share2 className="h-4.5 w-4.5 text-white" size={18} strokeWidth={2.5} />
      </div>
      <span className="text-lg font-extrabold tracking-tight">
        Click<span className="gradient-text">&amp;</span>Share
      </span>
    </div>
  );
}

const STATUS = {
  pending:   { cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', Icon: Clock },
  approved:  { cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', Icon: CheckCircle2 },
  paid:      { cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', Icon: CheckCircle2 },
  active:    { cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', Icon: CheckCircle2 },
  completed: { cls: 'bg-sky-500/15 text-sky-300 ring-sky-500/30', Icon: CheckCircle2 },
  paused:    { cls: 'bg-slate-500/15 text-slate-300 ring-slate-500/30', Icon: Clock },
  rejected:  { cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', Icon: XCircle },
};
export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${s.cls}`}>
      <s.Icon size={12} /> {status}
    </span>
  );
}

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin ${className}`} size={18} />;

export function PageLoader() {
  return <div className="grid place-items-center py-24 text-slate-400"><Spinner className="h-7 w-7" /></div>;
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-fuchsia-300"><Icon size={26} /></div>
      <h3 className="font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-md animate-rise rounded-b-none bg-ink-900 p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex animate-rise items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl ring-1
            ${t.type === 'error' ? 'bg-rose-950/95 text-rose-200 ring-rose-500/40' : 'bg-emerald-950/95 text-emerald-200 ring-emerald-500/40'}`}>
            {t.type === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />} {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
