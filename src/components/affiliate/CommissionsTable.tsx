import React, { useState } from 'react';
import { Copy, Check, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

export interface CommissionRow {
  id: string;
  date: string;
  referredUser: string;
  swapVolumeUSD: number;
  commissionRatePct: number;
  commissionAmountUSD: number;
  status: 'paid' | 'pending';
  subtitle?: string;
}

interface CommissionsTableProps {
  title?: string;
  commissions: CommissionRow[];
  onViewAll?: () => void;
}

export const CommissionsTable: React.FC<CommissionsTableProps> = ({
  title = 'Recent Commissions',
  commissions,
  onViewAll,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyWallet = (id: string, wallet: string) => {
    navigator.clipboard.writeText(wallet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatWallet = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 overflow-hidden shadow-xl shadow-black/25">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Live
          </span>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs sm:text-sm font-medium text-slate-400 hover:text-teal-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400 bg-[#080f18]/60">
              <th className="py-3.5 px-6">Date</th>
              <th className="py-3.5 px-6">Referred User</th>
              <th className="py-3.5 px-6">Swap Volume</th>
              <th className="py-3.5 px-6">Commission (Rate)</th>
              <th className="py-3.5 px-6 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {commissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                  No commissions recorded yet. Share your referral link to start earning lifetime rewards!
                </td>
              </tr>
            ) : (
              commissions.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-6 text-slate-300 whitespace-nowrap text-xs sm:text-sm">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200">{formatWallet(row.referredUser)}</span>
                      <button
                        onClick={() => handleCopyWallet(row.id, row.referredUser)}
                        className="text-slate-500 hover:text-teal-400 transition-colors cursor-pointer"
                        title="Copy wallet address"
                      >
                        {copiedId === row.id ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                    {row.subtitle && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{row.subtitle}</div>
                    )}
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="font-semibold text-white">
                      ${row.swapVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-500">USD Volume</div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="font-semibold text-teal-400">
                      +${row.commissionAmountUSD.toFixed(4)} USDT
                    </div>
                    <div className="text-[11px] text-teal-400/75">
                      {row.commissionRatePct}% of 0.5% fee
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    {row.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        <CheckCircle2 size={13} />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock size={13} />
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
