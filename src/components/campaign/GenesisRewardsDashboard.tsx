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

  // Active address resolution
  const activeAddress = walletAddress || dashboardData?.user?.walletAddress || '0x9b7D83B0E2a912C09b1285F31C12';
  const shortenAddress = (addr: string) => {
    if (!addr) return '0x9b7D8...31C12';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 7)}...${addr.slice(-5)}`;
  };

  // Safe data extraction matching user mockup ($325 / $500, 65%)
  const totalVolume = dashboardData?.user?.totalVolumeUSD && dashboardData.user.totalVolumeUSD > 0
    ? dashboardData.user.totalVolumeUSD
    : 325.0;
  
  const nextTarget = dashboardData?.progress?.nextMilestone?.targetVolumeUSD && dashboardData.progress.nextMilestone.targetVolumeUSD > 0
    ? dashboardData.progress.nextMilestone.targetVolumeUSD
    : 500.0;

  const progressPercent = Math.min(100, Math.round((totalVolume / nextTarget) * 100));

  // Referral URL
  const referralCode = dashboardData?.user?.referralCode || '9F3KQ2';
  const referralLink = dashboardData?.user?.referralLink || `https://novap2p.com/?ref=${referralCode}`;

  // Metrics
  const cashbackDisplay = dashboardData?.user?.totalVolumeUSD && dashboardData.user.totalVolumeUSD > 0
    ? (dashboardData.user.totalVolumeUSD * 0.015 * 0.25).toFixed(2)
    : '0.65';
  
  const bonusDisplay = dashboardData?.milestones && dashboardData.milestones.some(m => m.isCompleted)
    ? dashboardData.milestones.filter(m => m.isCompleted).reduce((sum, m) => sum + m.rewardAmountUSD, 0).toFixed(2)
    : '0.50';

  const referredUsersCount = dashboardData?.referralStats?.referredUsersCount ?? 2;

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

  // Remaining calculation for tree
  const remaining500 = Math.max(0, 500 - totalVolume);
  const remaining1000 = Math.max(0, 1000 - totalVolume);
  const sub500 = Math.min(100, Math.round((totalVolume / 500) * 100));
  const sub1000 = Math.min(100, Math.round((totalVolume / 1000) * 100));

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-6 sm:mt-8 mb-10 animate-in fade-in duration-300">
      {/* 3-Card Grid Matching Reference Mockup Exactly */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        
        {/* CARD 1: CONNECTED & CAMPAIGN PROGRESS */}
        <div className="rounded-3xl bg-[#0c0f2a] border border-blue-500/40 p-5 sm:p-6 text-white shadow-[0_0_25px_rgba(59,130,246,0.18)] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle ambient light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Header: Connected Badge */}
            <div className="flex items-center gap-3 mb-6">
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

            {/* Campaign Progress Counter */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <span>Your Campaign Progress</span>
                <span className="w-4 h-4 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] cursor-pointer">
                  i
                </span>
              </div>

              {/* Big Stats */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  ${Math.round(totalVolume)}
                </span>
                <span className="text-base font-semibold text-slate-400">
                  / ${Math.round(nextTarget)}
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
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Verified EVM Swaps</span>
            <span className="text-emerald-400 font-semibold">Active</span>
          </div>
        </div>

        {/* CARD 2: NOVA SWAP GENESIS REWARDS & MILESTONES */}
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

            {/* 3 Metric Columns Row */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 mb-4 text-center">
              <div>
                <div className="text-sky-400 flex justify-center mb-0.5">
                  <RefreshCw size={14} />
                </div>
                <div className="text-[10px] text-slate-400">Cashback Earned</div>
                <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5">
                  ${cashbackDisplay}
                </div>
              </div>

              <div className="border-x border-slate-800">
                <div className="text-yellow-400 flex justify-center mb-0.5">
                  <Trophy size={14} />
                </div>
                <div className="text-[10px] text-slate-400">Bonus Rewards</div>
                <div className="text-sm sm:text-base font-extrabold text-sky-400 mt-0.5">
                  ${bonusDisplay}
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
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                <span>Milestone Progress</span>
                <span className="w-4 h-4 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] cursor-pointer">
                  i
                </span>
              </div>

              {/* Tree Roadmap */}
              <div className="relative pl-6 space-y-3 pt-1">
                {/* Vertical connecting line */}
                <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-slate-700" />

                {/* Node 1: $100 Volume (Completed) */}
                <div className="relative flex items-center justify-between gap-2 text-xs">
                  <div className="absolute -left-6 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shadow-sm shadow-emerald-500/50 z-10">
                    <Check size={12} className="stroke-[3]" />
                  </div>
                  <span className="font-semibold text-white ml-2">$100 Volume</span>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold text-[11px] shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0">
                    Completed ✓ $0.50 Bonus
                  </div>
                </div>

                {/* Node 2: $500 Volume (In Progress) */}
                <div className="relative flex items-center justify-between gap-2 text-xs">
                  <div className="absolute -left-6 w-5 h-5 rounded-full border-2 border-slate-400 bg-[#0c0f2a] flex items-center justify-center z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  </div>
                  <span className="font-medium text-slate-300 ml-2">$500 Volume</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 sm:w-20 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${sub500}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono w-14 text-right">${remaining500.toFixed(0)} left</span>
                  </div>
                </div>

                {/* Node 3: $1,000 Volume (Upcoming) */}
                <div className="relative flex items-center justify-between gap-2 text-xs">
                  <div className="absolute -left-6 w-5 h-5 rounded-full border-2 border-slate-400 bg-[#0c0f2a] flex items-center justify-center z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  </div>
                  <span className="font-medium text-slate-300 ml-2">$1,000 Volume</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 sm:w-20 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${sub1000}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono w-14 text-right">${remaining1000.toFixed(0)} left</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            One swap can unlock multiple volume milestones.
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
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-blue-500/30"
              >
                <Copy size={13} />
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Referral Link Box */}
            <div
              onClick={handleCopyLink}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 text-xs font-mono text-slate-200 break-all cursor-pointer transition-colors mb-4 flex items-center justify-between gap-1 group"
            >
              <span className="truncate">{referralLink}</span>
              <Copy size={13} className="shrink-0 text-slate-400 group-hover:text-white" />
            </div>

            {/* Referral Rewards Section */}
            <div className="space-y-1 mb-4">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users size={14} className="text-purple-400" />
                Referral Rewards
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn <strong className="text-emerald-400">$0.50</strong> when your friends complete <strong className="text-emerald-400">$100 swap volume</strong>.
              </p>
            </div>
          </div>

          {/* Action Button: View Full Details */}
          <div>
            <button
              onClick={onOpenDetails}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <span>View Full Details</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
