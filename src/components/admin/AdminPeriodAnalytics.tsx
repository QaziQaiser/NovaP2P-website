import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Layers, RefreshCw } from 'lucide-react';
import { swapCampaignApi, type AdminPeriodAnalytics as PeriodData } from '../../services/swapCampaignApi';

type Period = 'current' | 'last6' | 'month' | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'current', label: 'This Month' },
  { id: 'last6', label: 'Last 6 Months' },
  { id: 'month', label: 'Pick Month' },
  { id: 'all', label: 'All Time' },
];

const usd = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thisMonthKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export const AdminPeriodAnalytics: React.FC<{ adminKey: string; refreshKey?: number }> = ({ adminKey, refreshKey }) => {
  const [period, setPeriod] = useState<Period>('current');
  const [month, setMonth] = useState(thisMonthKey);
  const [data, setData] = useState<PeriodData | null>(null);
  const [months, setMonths] = useState<string[]>([thisMonthKey()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await swapCampaignApi.getAdminAnalytics(adminKey, period, period === 'month' ? month : undefined);
      setData(res);
      if (res.availableMonths?.length) setMonths(res.availableMonths);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [adminKey, period, month]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const t = data?.totals;
  const maxChain = Math.max(1, ...(data?.byChain || []).map((c) => c.volumeUSD));
  const totalVolume = t?.volumeUSD || 0;
  const showMonths = (period === 'last6' || period === 'all') && (data?.months?.length || 0) > 0;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
      {/* Header + period filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" /> Period Analytics
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {data?.label || '…'} · Market swaps and filled limit orders, all campaign rounds (not affected by resets). Months in UTC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Period" className="inline-flex flex-wrap p-1 rounded-2xl bg-slate-950 border border-slate-800">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  period === p.id ? 'bg-primary text-white shadow shadow-primary/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'month' && (
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Month"
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-primary cursor-pointer"
            >
              {[...months].reverse().map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={load}
            aria-label="Refresh period analytics"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">{error}</div>}

      {/* Period totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Volume</span>
          <div className="text-xl font-extrabold text-white mt-1">{usd(t?.volumeUSD || 0)}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Swaps</span>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{(t?.swaps || 0).toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Wallets</span>
          <div className="text-xl font-extrabold text-blue-400 mt-1">{(t?.connectedWallets || 0).toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            New in this period · {(t?.swappingWallets || 0).toLocaleString()} wallets swapped
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${showMonths ? 'lg:grid-cols-2' : ''}`}>
        {/* Chain-wise volume */}
        <div className="rounded-2xl bg-slate-950/40 border border-slate-800 p-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Layers size={15} className="text-purple-400" /> Volume by Chain
          </h4>
          {data && data.byChain.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-6">No swaps in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                    <th className="pb-2 font-bold">Chain</th>
                    <th className="pb-2 font-bold text-right">Swaps</th>
                    <th className="pb-2 font-bold text-right">Volume</th>
                    <th className="pb-2 font-bold text-right hidden sm:table-cell">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {(data?.byChain || []).map((c) => (
                    <tr key={c.chainId}>
                      <td className="py-2 pr-2">
                        <div className="font-semibold text-slate-200">{c.chainName}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(c.volumeUSD / maxChain) * 100}%` }} />
                        </div>
                      </td>
                      <td className="py-2 text-right text-slate-300 tabular-nums">{c.swaps.toLocaleString()}</td>
                      <td className="py-2 text-right text-white font-semibold tabular-nums whitespace-nowrap">{usd(c.volumeUSD)}</td>
                      <td className="py-2 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                        {totalVolume > 0 ? `${((c.volumeUSD / totalVolume) * 100).toFixed(1)}%` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Month by month */}
        {showMonths && (
          <div className="rounded-2xl bg-slate-950/40 border border-slate-800 p-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <CalendarDays size={15} className="text-emerald-400" /> Month by Month
            </h4>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 text-left">
                    <th className="pb-2 font-bold">Month</th>
                    <th className="pb-2 font-bold text-right">Volume</th>
                    <th className="pb-2 font-bold text-right">Swaps</th>
                    <th className="pb-2 font-bold text-right">New wallets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {[...(data?.months || [])].reverse().map((m) => (
                    <tr key={m.month}>
                      <td className="py-2 text-slate-200 font-semibold whitespace-nowrap">{m.label}</td>
                      <td className="py-2 text-right text-white tabular-nums whitespace-nowrap">{usd(m.volumeUSD)}</td>
                      <td className="py-2 text-right text-slate-300 tabular-nums">{m.swaps.toLocaleString()}</td>
                      <td className="py-2 text-right text-slate-300 tabular-nums">{m.newWallets.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
