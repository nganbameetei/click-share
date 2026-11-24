import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutGrid, History as HistoryIcon, Wallet as WalletIcon, Crown, Shield, LogOut } from 'lucide-react';
import { useAuth } from './auth';
import { Logo, PageLoader } from './ui';
import { rupee } from './api';
import Landing from './pages/Landing';
import { Login, Signup } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Wallet from './pages/Wallet';
import Plans from './pages/Plans';
import Admin from './pages/Admin';

function Protected({ admin }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.Role !== 'admin') return <Navigate to="/app" replace />;
  return <AppShell />;
}

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = [
    { to: '/app', label: 'Earn', Icon: LayoutGrid, end: true },
    { to: '/app/history', label: 'My Tasks', Icon: HistoryIcon },
    { to: '/app/wallet', label: 'Wallet', Icon: WalletIcon },
    { to: '/app/plans', label: 'Plans', Icon: Crown },
    ...(user.Role === 'admin' ? [{ to: '/admin', label: 'Admin', Icon: Shield }] : []),
  ];
  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
      isActive ? 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/20 text-white ring-1 ring-fuchsia-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-ink-950/60 p-5 backdrop-blur-xl lg:flex">
        <Logo className="mb-8 px-1" />
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkCls}><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 font-bold">
              {user.Name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.Name}</div>
              <div className="text-xs text-fuchsia-300">{user.PlanName} plan</div>
            </div>
          </div>
          <button className="btn-ghost mt-3 w-full" onClick={() => { logout(); navigate('/'); }}><LogOut size={16} /> Log out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/30">{rupee(user.Balance)}</span>
            <button className="rounded-lg p-2 text-slate-400 hover:text-white" onClick={() => { logout(); navigate('/'); }} aria-label="Log out"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-white/10 bg-ink-950/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
             style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive ? 'text-fuchsia-300' : 'text-slate-500'}`}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/app" element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="history" element={<History />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="plans" element={<Plans />} />
      </Route>
      <Route path="/admin" element={<Protected admin />}>
        <Route index element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
