import React, { useState } from 'react';
import {
  CheckCircle,
  Copy,
  Check,
  ExternalLink,
  Gift,
  Users,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Zap,
  Info,
  ChevronRight,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { UserDashboardData } from '../../services/swapCampaignApi';

interface GenesisRewardsDashboardProps {
  dashboardData: UserDashboardData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenClaimModal: (reward: { id: string; title: string; amountUSD: number; walletAddress: string }) => void;
  onDisconnectWallet: () => void;
}

export const GenesisRewardsDashboard: React.FC<GenesisRewardsDashboardProps> = ({
  dashboardData,
  isLoading,
  onRefresh,
  onOpenClaimModal,
  onDisconnectWallet,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  if (!dashboardData) return null;

  const { user, progress, milestones, referralStats } = dashboardData;

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(user.referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Calculate overall milestone progress percentage towards next milestone
  const nextTarget = progress.nextMilestone?.targetVolumeUSD || 100;
  const progressPercent = Math.min(100, Math.round((progress.totalVolumeUSD / nextTarget) * 100));

  // Total bonus rewards earned
  const totalBonusEarned = milestones
    .filter((m) => m.isCompleted)
    .reduce((sum, m) => sum + m.rewardAmountUSD, 0) + referralStats.earnedRewardsUSD;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-8 mb-12 animate-in fade-in duration-300">
      {/* 3-Card Grid Matching Nova Design Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* CARD 1: WALLET STATUS & CAMPAIGN PROGRESS (4 Cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-gradient-to-b from-[#131B2E] via-[#0F1626] to-[#0A0E1A] border border-blue-500/20 p-5 sm:p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          {/* Ambient light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Connected Badge Header */}
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Connected
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                    <span>{shortenAddress(user.walletAddress)}</span>
                    <button
                      onClick={handleCopyAddress}
                      className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy Address"
                    >
                      {copiedAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Dashboard"
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={onDisconnectWallet}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700/50 hover:border-red-500/30 transition-colors cursor-pointer"
                  title="Disconnect Wallet"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>

            {/* Your Campaign Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  Your Campaign Progress <Info size={12} className="text-slate-500" />
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {progressPercent}%
                </span>
              </div>

              {/* Big Volume Counter */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  ${user.totalVolumeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  / ${nextTarget.toLocaleString()}
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-700 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Eligible Swaps: <strong className="text-white">{user.eligibleSwapsCount}</strong></span>
                <span>Milestones: <strong className="text-emerald-400">{progress.completedMilestonesCount}/{progress.totalMilestonesCount}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Tip Footer */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed flex items-center gap-2">
            <Zap size={14} className="text-amber-400 shrink-0" />
            <span>Cumulative verified volume across Ethereum, BNB Chain, Polygon, Arbitrum, Optimism & Base.</span>
          </div>
        </div>

        {/* CARD 2: NOVA SWAP GENESIS REWARDS & MILESTONES (5 Cols) */}
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-b from-[#131B2E] via-[#0F1626] to-[#0A0E1A] border border-purple-500/20 p-5 sm:p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/3 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎁</span>
              <h4 className="text-base font-bold text-white tracking-tight">
                Nova Swap Genesis Rewards
              </h4>
            </div>

            {/* Quick Metrics Columns */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-5 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Volume
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                  ${user.totalVolumeUSD.toFixed(2)}
                </div>
              </div>
              <div className="border-x border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Bonus Rewards
                </div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">
                  ${totalBonusEarned.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Referred Users
                </div>
                <div className="text-sm sm:text-base font-extrabold text-primary mt-0.5">
                  {referralStats.referredUsersCount}
                </div>
              </div>
            </div>

            {/* Milestones Progress List */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  Milestone Progress <Info size={12} className="text-slate-500" />
                </span>
                <span className="text-[11px] text-purple-300">
                  Manual On-Chain Payout
                </span>
              </div>

              {milestones.map((ms) => {
                const isReached = ms.isCompleted;
                const remaining = Math.max(0, ms.targetVolumeUSD - user.totalVolumeUSD);
                const subProgress = Math.min(100, Math.round((user.totalVolumeUSD / ms.targetVolumeUSD) * 100));

                return (
                  <div
                    key={ms.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isReached
                        ? 'bg-purple-950/20 border-purple-500/30'
                        : 'bg-slate-900/40 border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            isReached
                              ? 'bg-emerald-500 text-slate-950'
                              : 'border border-slate-600 text-slate-400'
                          }`}
                        >
                          {isReached ? '✓' : ms.milestoneNumber}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-white">
                          ${ms.targetVolumeUSD.toLocaleString()} Volume
                        </span>
                      </div>

                      {/* Status Badges & Claim Actions */}
                      <div>
                        {ms.status === 'paid' ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                            <span>Paid</span>
                            {ms.rewardRecord?.payoutTxHash && (
                              <a
                                href={`https://bscscan.com/tx/${ms.rewardRecord.payoutTxHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:underline"
                                title="View Payout Tx Hash"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        ) : ms.status === 'approved' ? (
                          <span className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-[11px] font-bold text-blue-300">
                            Approved (Processing)
                          </span>
                        ) : ms.status === 'requested' || ms.status === 'under_review' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300">
                            Pending Review
                          </span>
                        ) : isReached ? (
                          <button
                            onClick={() =>
                              onOpenClaimModal({
                                id: ms.rewardRecord?.id || ms.id,
                                title: ms.title,
                                amountUSD: ms.rewardAmountUSD,
                                walletAddress: user.walletAddress,
                              })
                            }
                            className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-[11px] shadow-sm transition-all cursor-pointer"
                          >
                            Request ${ms.rewardAmountUSD.toFixed(2)}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            ${remaining.toFixed(0)} left
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar for Milestone */}
                    {!isReached && (
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${subProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>One transaction can reach multiple milestones.</span>
            <span className="text-emerald-400 font-semibold">100% On-Chain Verified</span>
          </div>
        </div>

        {/* CARD 3: REFERRAL DASHBOARD (3 Cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-gradient-to-b from-[#131B2E] via-[#0F1626] to-[#0A0E1A] border border-blue-500/20 p-5 sm:p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Users size={14} className="text-indigo-400" />
                Your Referral Link
              </span>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-[11px] font-bold text-primary transition-colors cursor-pointer"
              >
                {copiedLink ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Referral Link Box */}
            <div 
              onClick={handleCopyLink}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 break-all cursor-pointer transition-colors mb-4 flex items-center justify-between gap-1 group"
            >
              <span className="truncate">{user.referralLink}</span>
              <Copy size={13} className="shrink-0 text-slate-500 group-hover:text-white" />
            </div>

            {/* Referral Rewards Explanation */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 mb-4">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
                <Gift size={13} className="text-amber-300" />
                Referral Bonuses
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Earn <strong className="text-emerald-400">$0.50 USD</strong> when your friends connect and complete $100 swap volume.
              </p>
            </div>

            {/* Referral Statistics Counters */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-slate-400">Referred Friends:</span>
                <span className="font-bold text-white">{referralStats.referredUsersCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-slate-400">Qualified Swappers:</span>
                <span className="font-bold text-emerald-400">{referralStats.qualifiedReferralsCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-slate-400">Referral Earnings:</span>
                <span className="font-bold text-emerald-400">${referralStats.earnedRewardsUSD.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            Anti-Sybil protected: self-referrals are automatically excluded.
          </div>
        </div>
      </div>

      {/* BOTTOM FEATURE BADGES STRIP (As in Reference Mockup) */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Zap size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">Milestone Rewards</div>
            <div className="text-[11px] text-slate-400 truncate">$100, $500, $2,000</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">Referral Bonus</div>
            <div className="text-[11px] text-slate-400 truncate">$0.50 per qualified user</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">Secure & Reliable</div>
            <div className="text-[11px] text-slate-400 truncate">LI.FI & On-Chain Audit</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <TrendingUp size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">6 EVM Networks</div>
            <div className="text-[11px] text-slate-400 truncate">ETH, BNB, MATIC, ARB, OP, BASE</div>
          </div>
        </div>
      </div>
    </div>
  );
};

