import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, ShieldCheck, Users, CheckCircle, AlertCircle, Calendar, DollarSign, Award, Search } from 'lucide-react';
import { CampaignData, MilestoneItem } from '../../services/swapCampaignApi';

// Complete Universal Multi-Chain Coverage (70+ Supported Networks)
export const SUPPORTED_CAMPAIGN_NETWORKS = [
  // Top Popular Chains
  { name: 'Ethereum', id: 1 },
  { name: 'BNB Smart Chain', id: 56 },
  { name: 'Polygon', id: 137 },
  { name: 'Arbitrum One', id: 42161 },
  { name: 'Optimism', id: 10 },
  { name: 'Base', id: 8453 },
  { name: 'Solana', id: 1151111081099710 },
  { name: 'TRON', id: 728126428 },
  { name: 'Sui', id: 9270000000000000 },
  { name: 'Avalanche C-Chain', id: 43114 },
  { name: 'Fantom Opera', id: 250 },

  // Major Layer 2s & EVM Chains
  { name: 'Linea', id: 59144 },
  { name: 'Scroll', id: 534352 },
  { name: 'Blast', id: 81457 },
  { name: 'zkSync Era', id: 324 },
  { name: 'Polygon zkEVM', id: 1101 },
  { name: 'Mantle', id: 5000 },
  { name: 'Sei Network', id: 1329 },
  { name: 'Injective', id: 1776 },
  { name: 'Gnosis (xDai)', id: 100 },
  { name: 'Celo', id: 42220 },
  { name: 'Cronos', id: 25 },
  { name: 'Moonbeam', id: 1284 },
  { name: 'Moonriver', id: 1285 },
  { name: 'BOB (Build on Bitcoin)', id: 288 },
  { name: 'Rootstock (RSK)', id: 30 },
  { name: 'Metis Andromeda', id: 1088 },
  { name: 'Aurora', id: 1313161554 },
  { name: 'ApeChain', id: 33139 },
  { name: 'Ink', id: 57073 },
  { name: 'Sonic (Fantom 2.0)', id: 146 },
  { name: 'Unichain', id: 130 },
  { name: 'Mode Network', id: 34443 },
  { name: 'Boba Network', id: 288 },
  { name: 'Fuse', id: 122 },
  { name: 'Telos', id: 40 },
  { name: 'Velas', id: 106 },
  { name: 'Fraxtal', id: 252 },
  { name: 'Immutable zkEVM', id: 13371 },
  { name: 'Kaia (Klaytn)', id: 8217 },
  { name: 'opBNB', id: 204 },
  { name: 'Lisk', id: 1135 },
  { name: 'Abstract', id: 2741 },
  { name: 'Berachain', id: 80094 },
  { name: 'Taiko', id: 167000 },
  { name: 'Soneium', id: 1868 },
  { name: 'XDC Network', id: 50 },
  { name: 'Viction (TomoChain)', id: 88 },
  { name: 'Flare', id: 14 },
  { name: 'Ronin', id: 2020 },
  { name: 'Nibiru', id: 6900 },
  { name: '0G Newton', id: 16661 },
  { name: 'Somnia', id: 5031 },
  { name: 'Arbitrum Nova', id: 42170 },
  { name: 'Harmony ONE', id: 1666600000 },
  { name: 'Kava EVM', id: 2222 },
  { name: 'World Chain', id: 480 },
  { name: 'Gravity', id: 1625 },
  { name: 'Hyperliquid EVM', id: 999 },
  { name: 'Etherlink', id: 42793 },
  { name: 'LightLink', id: 1890 },
  { name: 'Oasys', id: 111971151099710 },
  { name: 'Beam', id: 4337 },
  { name: 'Fusion', id: 32659 },
  { name: 'Plume Network', id: 98866 },
  { name: 'Manta Pacific', id: 169 },

  // Non-EVM & UTXO Ecosystems
  { name: 'Bitcoin', id: 20000000000001 },
  { name: 'Dogecoin', id: 20000000000004 },
  { name: 'Litecoin', id: 20000000000003 },
  { name: 'Bitcoin Cash', id: 20000000000002 },
  { name: 'Zcash', id: 20000000000005 },
  { name: 'Stellar', id: 1201081091099710 },
];

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
  const [mounted, setMounted] = useState(false);
  const [networkSearch, setNetworkSearch] = useState('');

  const filteredNetworks = useMemo(() => {
    if (!networkSearch.trim()) return SUPPORTED_CAMPAIGN_NETWORKS;
    const q = networkSearch.toLowerCase().trim();
    return SUPPORTED_CAMPAIGN_NETWORKS.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.id).includes(q)
    );
  }, [networkSearch]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const minSwap = campaign?.minSwapUSD ?? 1.0;
  const refReward = campaign?.referralRewardUSD ?? 5.00;
  const refQualifyingVol = campaign?.referralQualifyingVolUSD ?? 2000.0;

  const startDateFormatted = campaign?.startDate
    ? new Date(campaign.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Nov 1, 2026';
  const endDateFormatted = campaign?.endDate
    ? new Date(campaign.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Dec 31, 2026';

  const modalContent = (
    <div 
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-3 sm:p-6 pt-16 sm:pt-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647 }}
    >
      {/* Modal Box */}
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl text-slate-100 p-5 sm:p-8 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer z-20 shadow-lg border border-slate-700"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <CheckCircle className="text-emerald-400" size={18} />
                2. Eligibility & Supported Networks ({SUPPORTED_CAMPAIGN_NETWORKS.length}+ Chains)
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold self-start sm:self-auto">
                Universal Multi-Chain DEX
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative mb-2.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search 70+ supported blockchains (e.g. Solana, TRON, Sui, Polygon, Base, Arbitrum)..."
                value={networkSearch}
                onChange={(e) => setNetworkSearch(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Scrollable Grid of All 70+ Networks */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 sm:max-h-72 overflow-y-auto pr-1">
              {filteredNetworks.map((chain) => (
                <div
                  key={`${chain.name}-${chain.id}`}
                  className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between hover:bg-slate-800/70 hover:border-slate-600/70 transition-all"
                >
                  <span className="font-medium text-slate-200 text-xs truncate pr-1" title={chain.name}>
                    {chain.name}
                  </span>
                  <span
                    className="text-[11px] text-slate-400 font-mono shrink-0"
                    title={`Chain ID: ${chain.id}`}
                  >
                    ID: {typeof chain.id === 'number' && chain.id > 10000000000 ? `${String(chain.id).slice(0, 4)}...` : chain.id}
                  </span>
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

  return createPortal(modalContent, document.body);
};
