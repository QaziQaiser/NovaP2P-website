import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, CheckCircle, AlertCircle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { swapCampaignApi } from '../../services/swapCampaignApi';

interface RewardClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  reward: {
    id: string;
    title: string;
    amountUSD: number;
    walletAddress: string;
  } | null;
  onClaimSuccess: () => void;
}

export const RewardClaimModal: React.FC<RewardClaimModalProps> = ({
  isOpen,
  onClose,
  reward,
  onClaimSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [preferredNetwork, setPreferredNetwork] = useState('BNB Smart Chain (BEP-20)');
  const [preferredToken, setPreferredToken] = useState('USDT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!isOpen || !reward || !mounted) return null;

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      await swapCampaignApi.requestRewardClaim({
        walletAddress: reward.walletAddress,
        rewardId: reward.id,
        payoutAddress: reward.walletAddress,
        preferredNetwork,
        preferredToken,
      });

      setIsSuccess(true);
      setTimeout(() => {
        onClaimSuccess();
        setIsSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit reward request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 pt-16 sm:pt-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647 }}
    >
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-7 text-white my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors z-20 cursor-pointer"
        >
          <X size={18} />
        </button>

        {!isSuccess ? (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl">
                🎁
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Request Reward Payout
                </h3>
                <p className="text-xs text-slate-400">
                  {reward.title}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                  Reward Value
                </div>
                <div className="text-2xl font-extrabold text-white mt-0.5">
                  ${reward.amountUSD.toFixed(2)} USD
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800">
                100% Eligible
              </span>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Receiving Wallet Address
                </label>
                <input
                  type="text"
                  disabled
                  value={reward.walletAddress}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 font-mono text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preferred Payout Network
                </label>
                <select
                  value={preferredNetwork}
                  onChange={(e) => setPreferredNetwork(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-primary"
                >
                  <option value="BNB Smart Chain (BEP-20)">BNB Smart Chain (BEP-20) – Fast & Low Gas</option>
                  <option value="Polygon (PoS)">Polygon (PoS) – Fast</option>
                  <option value="Arbitrum One">Arbitrum One</option>
                  <option value="Base">Base</option>
                  <option value="Ethereum Mainnet (ERC-20)">Ethereum Mainnet (ERC-20)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preferred Reward Token
                </label>
                <select
                  value={preferredToken}
                  onChange={(e) => setPreferredToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-primary"
                >
                  <option value="USDT">USDT (Tether USD)</option>
                  <option value="USDC">USDC (USD Coin)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck size={14} className="text-amber-400 shrink-0" />
                <span>Nova admins manually verify on-chain swaps before broadcasting payout.</span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Claim</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-4 animate-in zoom-in-50">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              Reward Request Submitted!
            </h3>
            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              Your claim for <strong>${reward.amountUSD.toFixed(2)} USD</strong> has entered pending review. Your dashboard will update once on-chain payment is confirmed.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
