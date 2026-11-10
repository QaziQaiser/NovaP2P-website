import React from 'react';
import { Users, TrendingUp, Sparkles, RefreshCw, UserPlus, ChevronRight } from 'lucide-react';

interface GenesisRewardsPreviewCardProps {
  onOpenDetails?: () => void;
}

export const GenesisRewardsPreviewCard: React.FC<GenesisRewardsPreviewCardProps> = ({
  onOpenDetails,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-6 sm:mt-8 animate-in fade-in duration-300">
      {/* Outer Card with royal navy-purple gradient and glowing border */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#0c0528] via-[#160c45] to-[#0c092e] border border-purple-500/40 p-5 sm:p-7 shadow-[0_0_35px_rgba(124,58,237,0.18)] overflow-hidden text-white">
        {/* Ambient background glows */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header: Trophy + Title & Subtitle + Mockup Callout */}
        <div className="relative z-10 flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Golden Trophy with Star Sparkles */}
            <div className="relative shrink-0 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16">
              <span className="text-4xl sm:text-5xl filter drop-shadow-[0_6px_14px_rgba(234,179,8,0.45)] select-none">
                🏆
              </span>
              <span className="absolute -top-1 -right-0.5 text-xs sm:text-sm text-yellow-300 animate-pulse">✦</span>
              <span className="absolute bottom-1 -left-1 text-[10px] sm:text-xs text-purple-300 animate-pulse delay-200">✦</span>
              <span className="absolute -bottom-1 right-2 text-[10px] text-amber-200 animate-pulse delay-500">✦</span>
            </div>

            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2 flex-wrap">
                <span>Genesis</span>
                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                  Rewards
                </span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
                Complete your swaps and earn amazing rewards!
              </p>
            </div>
          </div>

          {/* Detailed Progress Indicator (Mockup [4] Badge) */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-purple-900/50 border border-purple-500/40 text-purple-200 text-xs font-semibold shadow-inner">
            <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-[10px]">
              4
            </span>
            <span>Detailed Rewards and Progress (After Wallet Connect)</span>
          </div>
        </div>

        {/* 3 White Milestone Cards */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 my-4 sm:my-5">
          {/* Milestone 1: $10,000 Volume */}
          <div className="bg-white rounded-2xl p-4 text-center shadow-md border border-slate-100 flex flex-col items-center justify-center transition-transform hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
              <Users size={20} className="stroke-[2.5]" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-gray-900">$10,000 Volume</div>
            <div className="text-sm sm:text-base font-extrabold text-blue-600 mt-0.5">+$25 USDT Bonus</div>
          </div>

          {/* Milestone 2: $25,000 Volume */}
          <div className="bg-white rounded-2xl p-4 text-center shadow-md border border-slate-100 flex flex-col items-center justify-center transition-transform hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-2">
              <TrendingUp size={20} className="stroke-[2.5]" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-gray-900">$25,000 Volume</div>
            <div className="text-sm sm:text-base font-extrabold text-purple-600 mt-0.5">+$50 USDT Bonus</div>
          </div>

          {/* Milestone 3: $50,000 Volume */}
          <div className="bg-white rounded-2xl p-4 text-center shadow-md border border-slate-100 flex flex-col items-center justify-center transition-transform hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 mb-2">
              <Sparkles size={20} className="stroke-[2.5]" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-gray-900">$50,000 Volume</div>
            <div className="text-sm sm:text-base font-extrabold text-amber-500 mt-0.5">+$100 USDT Bonus</div>
          </div>
        </div>

        {/* Bottom Strip 1: 5% Cashback Pill */}
        <div className="relative z-10 max-w-xl mx-auto w-full">
          <div className="rounded-full bg-[#0d122e]/90 border border-indigo-500/30 px-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-200 shadow-inner text-center">
            <RefreshCw size={15} className="text-sky-400 shrink-0" />
            <span>
              Earn <strong className="text-yellow-400 font-bold">5% cashback</strong> on eligible Nova Swap fees.
            </span>
          </div>
        </div>

        {/* Bottom Strip 2: Referral Rewards Info */}
        <div className="relative z-10 flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-300 mt-3 text-center px-2">
          <UserPlus size={15} className="text-slate-400 shrink-0" />
          <span>
            Invite Friends: Earn <strong className="text-yellow-300 font-bold">$5 USDT</strong> when your referral completes <strong className="text-yellow-300 font-bold">$2,000 swap volume</strong>.
          </span>
        </div>

        {/* View Campaign Details Link */}
        {onOpenDetails && (
          <div className="relative z-10 mt-4 pt-3 border-t border-purple-500/20 text-center">
            <button
              onClick={onOpenDetails}
              className="text-xs text-purple-300 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer font-medium py-1"
            >
              <span>View Campaign Details & Rules</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
