import React from 'react';
import { Calendar, Gift, ArrowRight, Sparkles } from 'lucide-react';
import { CampaignData } from '../../services/swapCampaignApi';

interface GenesisCampaignBannerProps {
  campaign: CampaignData | null;
  onOpenDetails: () => void;
}

export const GenesisCampaignBanner: React.FC<GenesisCampaignBannerProps> = ({
  campaign,
  onOpenDetails,
}) => {
  const daysText = campaign?.daysRemaining ? `${campaign.daysRemaining} Days` : '30 Days';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#170E3D] via-[#2A176B] to-[#120B30] border border-purple-500/30 shadow-[0_10px_35px_-5px_rgba(110,60,250,0.3)] p-4 sm:p-5 text-white transition-all hover:border-purple-500/50">
        {/* Ambient Glowing Blobs in Background */}
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-0 -bottom-10 w-48 h-48 bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: 3D Gift Box / Coins Graphic & Headline */}
          <div className="flex items-center gap-3.5 sm:gap-4 w-full md:w-auto">
            {/* Visual 3D Gift Icon Badge */}
            <div className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-purple-500/20 via-indigo-600/30 to-purple-800/40 border border-purple-400/40 flex items-center justify-center shadow-inner group">
              <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)] transform group-hover:scale-110 transition-transform duration-300">
                🎁
              </span>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] text-gray-900 font-extrabold animate-bounce">
                ✨
              </div>
            </div>

            {/* Campaign Title & Subtitle */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase text-amber-300/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <Sparkles size={11} /> Genesis Phase
                </span>
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight text-white mt-0.5 truncate">
                NOVA SWAP <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-purple-200 to-white">GENESIS CAMPAIGN</span>
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/80 font-medium truncate">
                Swap. Complete Milestones. Unlock Rewards.
              </p>
            </div>
          </div>

          {/* Right: Dynamic Badges & VIEW DETAILS Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full md:w-auto shrink-0">
            {/* Duration Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-purple-100">
              <Calendar size={14} className="text-amber-300" />
              <span>{daysText}</span>
            </div>

            {/* Rewards Highlights Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 backdrop-blur-md border border-purple-400/30 text-xs font-semibold text-purple-100">
              <Gift size={14} className="text-purple-300" />
              <span>Milestone Bonuses</span>
            </div>

            {/* VIEW DETAILS CTA Button */}
            <button
              onClick={onOpenDetails}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              <span>VIEW DETAILS</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

