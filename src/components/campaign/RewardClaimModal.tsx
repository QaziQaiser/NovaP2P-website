import React, { useState } from 'react';
import { X, Gift, ShieldAlert, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
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
  const [payoutAddress, setPayoutAddress] = useState(reward?.walletAddress || '');
  const [preferredNetwork, setPreferredNetwork] = useState('BNB Smart Chain');
  const [preferredToken, setPreferredToken] = useState('USDT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  React.useEffect(() => {
    if (reward) {
      setPayoutAddress(reward.walletAddress);
      setError(null);
      setIsSuccess(false);
    }
  }, [reward]);

  if (!isOpen || !reward) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutAddress || !payoutAddress.startsWith('0x') || payoutAddress.length !== 42) {
      setError('Please provide a valid EVM wallet address (0x...)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await swapCampaignApi.requestRewardClaim({
        walletAddress: reward.walletAddress,
        rewardId: reward.id,
        payoutAddress: payoutAddress.trim(),
        preferredNetwork,
        preferredToken,
      });

      setIsSuccess(true);
      onClaimSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit reward claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-7 text-white my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
                <h3 className="text-xl font-bold text-white">Request Reward Payout</h3>
                <p className="text-xs text-purple-300 font-medium">
                  {reward.title} • <span className="text-emerald-400 font-bold">+${reward.amountUSD.toFixed(2)} USD</span>
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Receiving EVM Wallet Address
                </label>
                <input
                  type="text"
                  value={payoutAddress}
                  onChange={(e) => setPayoutAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="0x..."
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Ensure you control the private keys for this address.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Preferred Network
                  </label>
                  <select
                    value={preferredNetwork}
                    onChange={(e) => setPreferredNetwork(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="BNB Smart Chain">BNB Smart Chain (Fast & Low Gas)</option>
                    <option value="Polygon">Polygon (POS)</option>
                    <option value="Arbitrum">Arbitrum One</option>
                    <option value="Optimism">Optimism</option>
                    <option value="Base">Base</option>
                    <option value="Ethereum">Ethereum Mainnet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Preferred Token
                  </label>
                  <select
                    value={preferredToken}
                    onChange={(e) => setPreferredToken(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="USDT">USDT (Tether USD)</option>
                    <option value="USDC">USDC (USD Coin)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-400 space-y-1">
                <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Manual Approval & On-Chain Payout Policy
                </p>
                <p>
                  Nova administrators review eligible swap hashes to prevent Sybil attacks. Once approved, rewards are transferred on-chain directly to your address, and you will see the verifiable transaction hash on your dashboard.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-primary/30 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Request</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Request Submitted!</h3>
            <p className="text-sm text-slate-300 max-w-sm mx-auto mb-6">
              Your claim for <strong>${reward.amountUSD.toFixed(2)} USD</strong> is now <span className="text-amber-400 font-semibold">Under Review</span>. Nova admin will review your swap transactions and transfer the funds on-chain.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

