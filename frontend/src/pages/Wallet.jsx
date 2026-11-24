import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, Receipt, Wallet as WalletIcon } from 'lucide-react';
import { api, rupee, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Empty, PageLoader, Spinner, StatusBadge, useToast } from '../ui';

export default function Wallet() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState({ minWithdrawal: 100 });
  const [tab, setTab] = useState('transactions');
  const [form, setForm] = useState({ amount: '', upiId: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const d = await api('/wallet');
    setData(d);
    setUser(d.me);
    setForm((f) => ({ ...f, upiId: f.upiId || d.me.UpiId || '' }));
  };
  useEffect(() => { load().catch(() => {}); api('/config').then(setCfg).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <PageLoader />;
  const { me, transactions, withdrawals } = data;
  const canWithdraw = me.Balance >= cfg.minWithdrawal;
  const progress = Math.min(100, (me.Balance / cfg.minWithdrawal) * 100);

  const withdraw = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/wallet/withdraw', { method: 'POST', body: { amount: Number(form.amount), upiId: form.upiId } });
      toast('Withdrawal requested! Usually paid within 24–48 hours.');
      setForm({ ...form, amount: '' });
      await load();
      setTab('withdrawals');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Wallet</h1>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Balance */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 lg:col-span-2">
          <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-sm text-white/80"><WalletIcon size={16} /> Available balance</div>
            <div className="mt-2 text-4xl font-extrabold">{rupee(me.Balance)}</div>
            <div className="mt-1 text-sm text-white/80">Lifetime earnings: {rupee(me.TotalEarned)}</div>
            {me.AdBalance > 0 && <div className="mt-1 text-sm text-white/80">Ad credits (for promotion): {rupee(me.AdBalance)}</div>}
            {!canWithdraw && (
              <div className="mt-6">
                <div className="flex justify-between text-xs font-semibold text-white/90">
                  <span>Until first withdrawal</span><span>{rupee(cfg.minWithdrawal - me.Balance)} to go</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Withdraw form */}
        <form onSubmit={withdraw} className="card space-y-4 p-6 lg:col-span-3">
          <div className="flex items-center gap-2 font-bold"><Banknote size={18} className="text-emerald-300" /> Withdraw to UPI</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">UPI ID</label>
              <input className="input" placeholder="yourname@okaxis" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} required />
            </div>
            <div>
              <label className="label">Amount (min {rupee(cfg.minWithdrawal, 0)})</label>
              <input className="input" type="number" min={cfg.minWithdrawal} max={me.Balance} step="0.01" placeholder={String(cfg.minWithdrawal)}
                     value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{cfg.withdrawalFee > 0 ? `Fee: ${rupee(cfg.withdrawalFee)} per withdrawal. ` : ''}Paid within 24–48 hours.</p>
            <button className="btn-success" disabled={!canWithdraw || busy}>{busy ? <Spinner /> : 'Request withdrawal'}</button>
          </div>
        </form>
      </div>

      {/* History */}
      <div>
        <div className="mb-4 inline-flex gap-1 rounded-2xl bg-white/5 p-1">
          {['transactions', 'withdrawals'].map((t) => (
            <button key={t} className={`tab capitalize ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {tab === 'transactions' ? (
          transactions.length === 0 ? <Empty icon={Receipt} title="No transactions yet" text="Approved task rewards will show up here." /> : (
            <div className="card divide-y divide-white/5">
              {transactions.map((t) => (
                <div key={t.Id} className="flex items-center gap-3 p-4">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.Type === 'credit' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {t.Type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t.Note}</div>
                    <div className="text-xs text-slate-500">{timeAgo(t.CreatedAt)}</div>
                  </div>
                  <div className={`font-bold ${t.Type === 'credit' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {t.Type === 'credit' ? '+' : '−'}{rupee(t.Amount)}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : withdrawals.length === 0 ? <Empty icon={Banknote} title="No withdrawals yet" text={`Reach ${rupee(cfg.minWithdrawal, 0)} to make your first withdrawal.`} /> : (
          <div className="card divide-y divide-white/5">
            {withdrawals.map((w) => (
              <div key={w.Id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{rupee(w.Amount)} → {w.UpiId}</div>
                  <div className="text-xs text-slate-500">{timeAgo(w.CreatedAt)}{w.AdminNote ? ` · ${w.AdminNote}` : ''}</div>
                </div>
                <StatusBadge status={w.Status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
