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
    <div className="w-full max-w-[480px] sm:max-w-[500px] mx-auto px-3 sm:px-0 mb-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#170E3D]/95 via-[#29176B]/95 to-[#130B2E]/95 border border-purple-500/30 shadow-[0_8px_30px_rgba(110,60,250,0.25)] p-3.5 sm:p-4 text-white transition-all hover:border-purple-500/50">
        {/* Ambient Glowing Blobs in Background */}
        <div className="absolute -left-10 -top-10 w-36 h-36 bg-purple-600/30 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-0 -bottom-8 w-36 h-36 bg-indigo-600/25 rounded-full blur-2xl pointer-events-none" />

        {/* Top Row: 3D Gift Box + Title + View Details Button */}
        <div className="relative z-10 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Visual 3D Gift Icon Badge */}
            <div className="relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500/30 via-indigo-600/30 to-purple-800/40 border border-purple-400/40 flex items-center justify-center shadow-inner group">
              <span className="text-2xl sm:text-3xl filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                🎁
              </span>
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center text-[8px] text-gray-900 font-extrabold animate-pulse">
                ✨
              </div>
            </div>

            {/* Campaign Title & Subtitle */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-amber-300/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  <Sparkles size={9} /> Genesis
                </span>
                <span className="text-[11px] font-semibold text-purple-200/90 hidden sm:inline">
                  Phase
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white mt-0.5 truncate">
                Nova Swap <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-purple-200 to-white">Genesis Campaign</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-purple-200/80 font-medium truncate">
                Swap. Complete Milestones. Unlock Rewards.
              </p>
            </div>
          </div>

          {/* VIEW DETAILS CTA Button */}
          <button
            onClick={onOpenDetails}
            type="button"
            className="shrink-0 inline-flex items-center gap-1 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-[11px] sm:text-xs shadow-md shadow-purple-600/30 transition-all cursor-pointer whitespace-nowrap active:scale-95"
          >
            <span>View Details</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Bottom Row: Badges */}
        <div className="relative z-10 flex items-center gap-2 mt-2.5 pt-2 border-t border-purple-500/20 text-[11px]">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 font-medium text-purple-100">
            <Calendar size={12} className="text-amber-300" />
            <span>{daysText}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/30 font-medium text-purple-100">
            <Gift size={12} className="text-purple-300" />
            <span>Milestone Rewards</span>
          </div>
        </div>
      </div>
    </div>
  );
};
