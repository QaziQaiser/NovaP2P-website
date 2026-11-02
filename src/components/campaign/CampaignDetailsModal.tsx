import React from 'react';
import { X, Gift, ShieldCheck, Users, CheckCircle, AlertCircle, Calendar, DollarSign, Award, ExternalLink } from 'lucide-react';
import { CampaignData, MilestoneItem } from '../../services/swapCampaignApi';

interface CampaignDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignData | null;
  milestones: MilestoneItem[];
}

export const CampaignDetailsModal: React.FC<CampaignDetailsModalProps> = ({
  isOpen,
  onClose,
  campaign,
  milestones,
}) => {
  if (!isOpen) return null;

  const minSwap = campaign?.minSwapUSD ?? 10.0;
  const refReward = campaign?.referralRewardUSD ?? 0.50;
  const refQualifyingVol = campaign?.referralQualifyingVolUSD ?? 100.0;

  const startDateFormatted = campaign?.startDate
    ? new Date(campaign.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Nov 1, 2026';
  const endDateFormatted = campaign?.endDate
    ? new Date(campaign.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Dec 31, 2026';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Box */}
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-2xl shadow-inner">
            🎁
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-800/60">
                Official Genesis Campaign
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              Nova Swap Genesis Campaign Details
            </h2>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6 text-sm text-slate-300">
          {/* 1. Overview */}
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-2">
              <Award className="text-primary" size={18} />
              1. Campaign Overview
            </h3>
            <p className="leading-relaxed text-slate-300">
              The <strong>Nova Swap Genesis Campaign</strong> is a community rewards program designed to reward active decentralized swappers across our supported multi-chain liquidity routes. Complete swap volume milestones, earn bonus rewards, and invite friends to build our decentralized trading ecosystem.
            </p>
          </div>

          {/* 2. Supported Networks & Minimum Swap */}
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <CheckCircle className="text-emerald-400" size={18} />
              2. Eligibility & Supported Networks
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { name: 'Ethereum', id: 1 },
                { name: 'BNB Smart Chain', id: 56 },
                { name: 'Polygon', id: 137 },
                { name: 'Arbitrum', id: 42161 },
                { name: 'Optimism', id: 10 },
                { name: 'Base', id: 8453 },
              ].map((chain) => (
                <div key={chain.id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
                  <span className="font-medium text-slate-200">{chain.name}</span>
                  <span className="text-xs text-slate-400 font-mono">ID: {chain.id}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
              <DollarSign size={14} className="text-emerald-400 shrink-0" />
              <span><strong>Minimum Eligible Swap:</strong> Only swaps with a verified value of at least <strong>${minSwap.toFixed(2)} USD</strong> count towards cumulative volume.</span>
            </div>
          </div>

          {/* 3. Milestone Thresholds & Rewards */}
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <Gift className="text-purple-400" size={18} />
              3. Configured Milestone Rewards
            </h3>
            <div className="space-y-2.5">
              {milestones.length > 0 ? (
                milestones.map((ms) => (
                  <div
                    key={ms.id}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/20 to-slate-800/60 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-white">{ms.title}: ${ms.targetVolumeUSD.toLocaleString()} Cumulative Volume</span>
                      <p className="text-xs text-slate-400 mt-0.5">{ms.rewardDescription}</p>
                    </div>
                    <div className="self-start sm:self-center px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs whitespace-nowrap">
                      +${ms.rewardAmountUSD.toFixed(2)} USD Bonus
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No milestones currently configured.</p>
              )}
            </div>
          </div>

          {/* 4. Referral Rules */}
          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-2">
              <Users className="text-blue-400" size={18} />
              4. Referral Rewards & Rules
            </h3>
            <p className="leading-relaxed text-slate-300">
              Every verified wallet is issued a unique referral code and referral link. Share your link with other crypto traders:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-slate-300">
              <li>Earn <strong>${refReward.toFixed(2)} USD</strong> for each referred wallet that reaches <strong>${refQualifyingVol.toFixed(2)} USD</strong> in cumulative verified swap volume.</li>
              <li>Referral attribution is securely registered upon the visitor&apos;s wallet verification.</li>
              <li>Self-referrals (referring your own secondary wallets or matching IP/funding patterns) are strictly prohibited and automatically flagged by fraud filters.</li>
            </ul>
          </div>

          {/* 5. Claim & Payout Procedure */}
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-2">
              <ShieldCheck className="text-amber-400" size={18} />
              5. Reward Request & Approval Procedure
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
              <li>When your cumulative verified swap volume reaches a milestone threshold, the milestone status switches to <strong>Unlocked</strong>.</li>
              <li>Click <strong>&quot;Request Reward&quot;</strong> on your rewards dashboard and specify your preferred payout network and token.</li>
              <li>Your claim enters <strong>Pending Review</strong> status.</li>
              <li>Nova Admins manually verify transaction authenticity and execute payment on-chain directly to your wallet.</li>
              <li>Upon payment completion, your dashboard displays the verifiable payout network, timestamp, and <strong>Transaction Hash</strong> with a direct block explorer link.</li>
            </ol>
          </div>

          {/* 6. Anti-Fraud & Anti-Sybil Policy */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex gap-2.5">
            <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block mb-1">Anti-Sybil & Anti-Fraud Policy</strong>
              Duplicate transaction hashes, wash-trading between self-owned wallets, circular routing, or exploiting referral links will result in claim rejection and wallet exclusion from future Nova campaigns.
            </div>
          </div>

          {/* 7. Dates & Timeline */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-purple-400" />
              <span><strong>Active Period:</strong> {startDateFormatted} – {endDateFormatted}</span>
            </div>
            <div className="text-purple-300 font-semibold">
              Campaign Budget: ${campaign?.totalBudgetUSD?.toLocaleString() || '10,000'} USD
            </div>
          </div>

          {/* 8. Terms and Conditions */}
          <div className="text-[11px] text-slate-500 leading-normal border-t border-slate-800 pt-3">
            Nova P2P reserves the right to modify milestone thresholds, pause or conclude the campaign, or disqualify bad-faith participants in accordance with platform security and integrity policies. All rewards are subject to manual compliance verification.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

