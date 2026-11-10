import React, { useState } from 'react';
import {
  Check,
  Copy,
  Info,
  Gift,
  Users,
  RefreshCw,
  Trophy,
  ChevronRight,
  Share2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { UserDashboardData } from '../../services/swapCampaignApi';

interface GenesisRewardsDashboardProps {
  dashboardData: UserDashboardData | null;
  walletAddress?: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenClaimModal: (reward: { id: string; title: string; amountUSD: number; walletAddress: string }) => void;
  onDisconnectWallet: () => void;
  onOpenDetails?: () => void;
}

export const GenesisRewardsDashboard: React.FC<GenesisRewardsDashboardProps> = ({
  dashboardData,
  walletAddress,
  isLoading,
  onRefresh,
  onOpenClaimModal,
  onDisconnectWallet,
  onOpenDetails,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [shared, setShared] = useState(false);

  // Active address resolution
  const activeAddress = walletAddress || dashboardData?.user?.walletAddress || '';
  const shortenAddress = (addr: string) => {
    if (!addr) return '0x000...0000';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Real data extraction from backend with local cache fallback
  let cachedVolume = 0;
  try {
    if (typeof window !== 'undefined' && activeAddress) {
      const cacheKey = `nova_swaps_${activeAddress.toLowerCase()}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(cached)) {
        cachedVolume = cached.reduce(
          (sum: number, tx: any) => sum + (Number(tx.verifiedVolume) || Number(tx.volumeUSD) || 0),
          0
        );
      }
    }
  } catch {}

  const userVolume = Math.max(dashboardData?.user?.totalVolumeUSD ?? 0.0, cachedVolume);
  
  // Real Cashback from backend ledger (or estimated on cached volume if syncing)
  const serverCashback = dashboardData?.cashbackStats?.totalCashbackUSD ?? 0.0;
  const estimatedCashback = cachedVolume > 0 ? Number((cachedVolume * 0.005 * 0.05).toFixed(2)) : 0.0;
  const cashbackEarned = Math.max(serverCashback, estimatedCashback);
  
  // Real Bonus rewards (milestone bonuses + referral bonuses)
  const milestoneBonus = dashboardData?.bonusStats?.milestoneBonusUSD ?? 0.0;
  const referralBonus = dashboardData?.bonusStats?.referralBonusUSD ?? 
    (dashboardData?.referralStats?.earnedRewardsUSD ?? 0.0);
  const totalBonusEarned = milestoneBonus + referralBonus;

  // Real Referral stats
  const referredUsersCount = dashboardData?.referralStats?.referredUsersCount ?? 0;
  const qualifiedReferralsCount = dashboardData?.referralStats?.qualifiedReferralsCount ?? 0;

  // Total accumulated eligible rewards towards $500 claim activation threshold
  const claimThreshold = dashboardData?.claimStats?.claimThresholdUSD ?? 500.0;
  const accumulatedRewards = dashboardData?.claimStats?.totalAccumulatedRewardsUSD ?? 
    (cashbackEarned + totalBonusEarned);
  const progressPercent = Math.min(100, Math.round((accumulatedRewards / claimThreshold) * 100));
  const isClaimEligible = accumulatedRewards >= claimThreshold;
  const remainingToClaim = Math.max(0, claimThreshold - accumulatedRewards);

  // Active Claim from backend if any
  const activeClaim = dashboardData?.claimStats?.activeClaim;

  // Referral URL
  const referralCode = dashboardData?.user?.referralCode || 'NOVA';
  const referralLink = dashboardData?.user?.referralLink || `https://novap2p.com/?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(activeAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'NovaP2P Genesis Rewards',
          text: 'Trade on NovaP2P DEX and earn cashback plus bonus rewards!',
          url: referralLink,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        // Fallback to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Official 3 Milestones: $10,000 ($25), $25,000 ($50), $50,000 ($100)
  const officialMilestones = [
    {
      id: 'ms_genesis_1',
      title: '$10,000 Volume',
      target: 10000,
      reward: 25.0,
      rewardText: '$25 USDT',
      isCompleted: userVolume >= 10000,
      color: 'blue',
    },
    {
      id: 'ms_genesis_2',
      title: '$25,000 Volume',
      target: 25000,
      reward: 50.0,
      rewardText: '$50 USDT',
      isCompleted: userVolume >= 25000,
      color: 'blue',
    },
    {
      id: 'ms_genesis_3',
      title: '$50,000 Volume',
      target: 50000,
      reward: 100.0,
      rewardText: '$100 USDT',
      isCompleted: userVolume >= 50000,
      color: 'purple',
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-6 sm:mt-8 mb-10 animate-in fade-in duration-300">
      {/* 3-Card Grid Matching Reference Mockup Exactly */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        
        {/* CARD 1: CONNECTED & CAMPAIGN PROGRESS ($0 / $500 CLAIM ACTIVATION) */}
        <div className="rounded-3xl bg-[#0c0f2a] border border-blue-500/40 p-5 sm:p-6 text-white shadow-[0_0_25px_rgba(59,130,246,0.18)] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle ambient light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Header: Connected Status Badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-500/40 shrink-0">
                  <Check size={22} className="stroke-[3]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-400 leading-tight">
                    Connected
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300 mt-0.5">
                    <span>{shortenAddress(activeAddress)}</span>
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

              {/* Refresh / Disconnect */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Dashboard"
                >
                  <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Campaign Progress Counter ($0 / $500 Claim Threshold) */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <span>Your Campaign Progress</span>
                  <span
                    className="w-4 h-4 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] cursor-help"
                    title="Accumulate $500 in eligible rewards from cashback and bonuses to activate reward claim payout"
                  >
                    i
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Goal: $500
                </span>
              </div>

              {/* Big Stats Counter ($0 / $500) */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  ${accumulatedRewards >= 10 ? Math.round(accumulatedRewards) : accumulatedRewards.toFixed(2)}
                </span>
                <span className="text-base font-semibold text-slate-400">
                  / $500
                </span>
              </div>

              {/* Progress Bar with Percentage */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-3 rounded-full bg-slate-800/90 overflow-hidden p-0.5 border border-slate-700/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 shadow-sm shadow-emerald-500/50"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-emerald-400 shrink-0 font-mono">
                  {progressPercent}%
                </span>
              </div>

              {/* Claim Eligibility / Action Notice */}
              <div className="pt-2">
                {isClaimEligible ? (
                  <button
                    onClick={() => onOpenClaimModal({
                      id: 'threshold_500',
                      title: 'Genesis Rewards $500 Activation Claim',
                      amountUSD: accumulatedRewards,
                      walletAddress: activeAddress,
                    })}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                  >
                    <Sparkles size={14} />
                    <span>Claim ${accumulatedRewards.toFixed(2)} USDT Now</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
                    <span>Claim unlocks at $500:</span>
                    <strong className="text-amber-300">${remainingToClaim.toFixed(2)} left</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Cumulative Swap Vol: <strong className="text-white">${userVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </div>

        {/* CARD 2: NOVA SWAP GENESIS REWARDS & MILESTONE TREE */}
        <div className="rounded-3xl bg-[#0c0f2a] border border-blue-500/40 p-5 sm:p-6 text-white shadow-[0_0_25px_rgba(59,130,246,0.18)] flex flex-col justify-between relative overflow-hidden">
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

            {/* 3 Metric Columns Row (Cashback, Bonus, Referred Users) */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 mb-4 text-center">
              <div>
                <div className="text-sky-400 flex justify-center mb-0.5">
                  <RefreshCw size={14} />
                </div>
                <div className="text-[10px] text-slate-400">Cashback Earned</div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">
                  ${cashbackEarned.toFixed(2)}
                </div>
              </div>

              <div className="border-x border-slate-800">
                <div className="text-yellow-400 flex justify-center mb-0.5">
                  <Trophy size={14} />
                </div>
                <div className="text-[10px] text-slate-400">Bonus Rewards</div>
                <div className="text-sm sm:text-base font-extrabold text-sky-400 mt-0.5">
                  ${totalBonusEarned.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-purple-400 flex justify-center mb-0.5">
                  <Users size={14} />
                </div>
                <div className="text-[10px] text-slate-400">Referred Users</div>
                <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                  {referredUsersCount}
                </div>
              </div>
            </div>

            {/* Milestone Progress Section with Tree Track Line */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <span>Milestone Progress</span>
                  <span
                    className="w-4 h-4 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] cursor-help"
                    title="Complete cumulative volume milestones to earn one-time USDT bonuses"
                  >
                    i
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  5% Active Cashback
                </span>
              </div>

              {/* Tree Roadmap */}
              <div className="relative pl-6 space-y-3.5 pt-1">
                {/* Vertical connecting line */}
                <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-slate-700" />

                {officialMilestones.map((ms) => {
                  const remaining = Math.max(0, ms.target - userVolume);
                  const subProgress = Math.min(100, Math.round((userVolume / ms.target) * 100));

                  return (
                    <div key={ms.id} className="relative flex items-center justify-between gap-2 text-xs">
                      {/* Node Icon */}
                      {ms.isCompleted ? (
                        <div className="absolute -left-6 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shadow-sm shadow-emerald-500/50 z-10">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      ) : (
                        <div className="absolute -left-6 w-5 h-5 rounded-full border-2 border-slate-400 bg-[#0c0f2a] flex items-center justify-center z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        </div>
                      )}

                      <span className={`font-semibold ml-2 ${ms.isCompleted ? 'text-white' : 'text-slate-300'}`}>
                        {ms.title}
                      </span>

                      {/* Status / Progress */}
                      {ms.isCompleted ? (
                        <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold text-[11px] shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0">
                          Completed ✓ {ms.rewardText}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 sm:w-20 h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${ms.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'}`}
                              style={{ width: `${subProgress}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono w-16 text-right">
                            ${remaining >= 1000 ? `${Math.round(remaining / 1000)}k` : Math.round(remaining)} left
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            One transaction can unlock multiple volume milestones.
          </div>
        </div>

        {/* CARD 3: YOUR REFERRAL LINK & REWARDS */}
        <div className="rounded-3xl bg-[#0c0f2a] border border-blue-500/40 p-5 sm:p-6 text-white shadow-[0_0_25px_rgba(59,130,246,0.18)] flex flex-col justify-between relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <span className="text-purple-400">🔗</span>
                Your Referral Link
              </span>
              <div className="flex items-center gap-1.5">
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    onClick={handleShare}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Share Link"
                  >
                    <Share2 size={13} />
                  </button>
                )}
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-blue-500/30"
                >
                  <Copy size={13} />
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Referral Link Box */}
            <div
              onClick={handleCopyLink}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 text-xs font-mono text-slate-200 break-all cursor-pointer transition-colors mb-4 flex items-center justify-between gap-1 group"
              title="Click to copy referral link"
            >
              <span className="truncate">{referralLink}</span>
              <Copy size={13} className="shrink-0 text-slate-400 group-hover:text-white" />
            </div>

            {/* Referral Rewards Section */}
            <div className="space-y-2 mb-4">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users size={14} className="text-purple-400" />
                Referral Rewards
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn <strong className="text-emerald-400">$0.10 USDT</strong> when your referred friends complete at least <strong className="text-emerald-400">$100 in eligible swap volume</strong>.
              </p>

              {/* Referral Live Stats */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="text-slate-400">Eligible Referrals</div>
                  <div className="text-white font-bold text-xs mt-0.5">{qualifiedReferralsCount} / {referredUsersCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="text-slate-400">Referral Earned</div>
                  <div className="text-emerald-400 font-bold text-xs mt-0.5">${referralBonus.toFixed(2)} USDT</div>
                </div>
              </div>
            </div>

            {/* Active Claim Display if any */}
            {activeClaim && (
              <div className="mb-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Latest Claim</span>
                  <span className="font-bold text-white">${activeClaim.requestedAmountUSD.toFixed(2)} USDT</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeClaim.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  activeClaim.status === 'approved' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                  activeClaim.status === 'rejected' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                  'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {activeClaim.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Action Button: View Full Details or Claim Reward */}
          <div>
            {isClaimEligible ? (
              <button
                onClick={() => onOpenClaimModal({
                  id: 'threshold_500',
                  title: 'Genesis Rewards $500 Activation Claim',
                  amountUSD: accumulatedRewards,
                  walletAddress: activeAddress,
                })}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <span>Claim $500 Reward</span>
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={onOpenDetails}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <span>View Full Details</span>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
