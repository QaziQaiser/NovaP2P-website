import React, { useState } from 'react';
import { X, Wallet, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { affiliateApi } from '../../services/affiliateApi';

interface PayoutRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  availableBalanceUSD: number;
  minWithdrawalUSD?: number;
  onSuccess: () => void;
}

const MAJOR_NETWORKS = [
  'BNB Smart Chain (BEP20)',
  'Ethereum (ERC20)',
  'Arbitrum One',
  'Optimism',
  'Base',
  'Polygon',
  'Solana',
  'TRON (TRC20)',
];

export const PayoutRequestModal: React.FC<PayoutRequestModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  availableBalanceUSD,
  minWithdrawalUSD = 100,
  onSuccess,
}) => {
  const [payoutAddress, setPayoutAddress] = useState(walletAddress);
  const [preferredNetwork, setPreferredNetwork] = useState(MAJOR_NETWORKS[0]);
  const [preferredToken, setPreferredToken] = useState('USDT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEligible = availableBalanceUSD >= minWithdrawalUSD;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEligible) {
      setError(`Minimum withdrawal amount is $${minWithdrawalUSD}.00 USDT.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await affiliateApi.requestPayout({
        walletAddress,
        payoutAddress,
        preferredNetwork,
        preferredToken,
      });
      setSuccessMsg(res.message);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit payout request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#0c1420] border border-slate-700/80 text-white p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
            <Wallet size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Request Affiliate Payout</h3>
            <p className="text-xs text-slate-400">Minimum payout: ${minWithdrawalUSD} | Processed within 24 hours</p>
          </div>
        </div>

        <div className="bg-[#080f18] border border-slate-800 rounded-xl p-4 mb-5 flex items-center justify-between">
          <span className="text-sm text-slate-400">Available Pending Balance</span>
          <span className="text-xl font-bold text-teal-400">${availableBalanceUSD.toFixed(2)} USDT</span>
        </div>

        {successMsg ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 size={42} className="text-teal-400 mx-auto" />
            <p className="text-base font-semibold text-white">{successMsg}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm hover:bg-teal-400 cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl flex items-start gap-2 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!isEligible && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl text-xs leading-relaxed">
                You need at least <strong>${minWithdrawalUSD}.00</strong> in pending commissions to request a payout. Currently you have <strong>${availableBalanceUSD.toFixed(2)}</strong>.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Payout Destination Address *</label>
              <input
                type="text"
                required
                value={payoutAddress}
                onChange={(e) => setPayoutAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#080f18] border border-slate-700 text-sm font-mono text-white focus:border-teal-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Preferred Network *</label>
                <select
                  value={preferredNetwork}
                  onChange={(e) => setPreferredNetwork(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#080f18] border border-slate-700 text-sm text-white focus:border-teal-500 outline-none"
                >
                  {MAJOR_NETWORKS.map((net) => (
                    <option key={net} value={net}>
                      {net}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Payout Token *</label>
                <select
                  value={preferredToken}
                  onChange={(e) => setPreferredToken(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#080f18] border border-slate-700 text-sm text-white focus:border-teal-500 outline-none"
                >
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
              <ShieldCheck size={14} className="text-teal-400 shrink-0" />
              <span>Payouts are processed within 24 hours across all major supported networks.</span>
            </div>

            <button
              type="submit"
              disabled={!isEligible || isSubmitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting Request...
                </>
              ) : (
                `Request $${availableBalanceUSD.toFixed(2)} Payout`
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
