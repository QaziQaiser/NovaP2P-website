import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wallet, ShieldCheck, AlertCircle, Loader2, CheckCircle2, Gift, Users } from 'lucide-react';
import { LiFiSwapWidget } from './LiFiSwapWidget';
import { GenesisCampaignBanner } from '../campaign/GenesisCampaignBanner';
import { GenesisRewardsPreviewCard } from '../campaign/GenesisRewardsPreviewCard';
import { CampaignDetailsModal } from '../campaign/CampaignDetailsModal';
import { GenesisRewardsDashboard } from '../campaign/GenesisRewardsDashboard';
import { RewardClaimModal } from '../campaign/RewardClaimModal';
import { useWallet } from '../../context/WalletContext';
import {
  swapCampaignApi,
  CampaignData,
  MilestoneItem,
  UserDashboardData,
} from '../../services/swapCampaignApi';

export const NovaSwapSection: React.FC = () => {
  const { account, chainId, isConnected, connectWallet, disconnectWallet, signMessage } = useWallet();
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);

  // Sync wallet from either WalletContext or direct LI.FI injected provider
  const effectiveAccount = account || detectedWallet;
  const isWalletConnected = isConnected || !!effectiveAccount;

  // Campaign state
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // User rewards dashboard state
  const [userDashboard, setUserDashboard] = useState<UserDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Claim modal state
  const [claimModalReward, setClaimModalReward] = useState<{
    id: string;
    title: string;
    amountUSD: number;
    walletAddress: string;
  } | null>(null);

  // Notifications
  const [swapSuccessNotice, setSwapSuccessNotice] = useState<string | null>(null);

  // 1. Initial Campaign Load & Referral Capture
  useEffect(() => {
    // Capture referral from URL if present
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        const cleanRef = ref.trim().toUpperCase();
        localStorage.setItem('nova_swap_ref_code', cleanRef);
        swapCampaignApi.trackReferral(cleanRef);
      }

      // Track campaign page impression
      swapCampaignApi.trackEvent('campaign_page_view', null, {
        referrer: document.referrer,
        url: window.location.href,
      });
    }

    // Load active campaign
    swapCampaignApi
      .getCampaign()
      .then((data) => {
        setCampaign(data.campaign);
        setMilestones(data.milestones);
      })
      .catch((err) => {
        console.error('Failed to load campaign settings:', err);
      });
  }, []);

  // 2. Fetch User Dashboard whenever connected account changes
  const refreshUserDashboard = useCallback(async () => {
    if (!effectiveAccount) {
      setUserDashboard(null);
      return;
    }

    try {
      setIsLoadingDashboard(true);
      const data = await swapCampaignApi.getUserDashboard(effectiveAccount);
      setUserDashboard(data);
    } catch {
      // 404 indicates user has not verified wallet ownership yet
      setUserDashboard(null);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [effectiveAccount]);

  useEffect(() => {
    refreshUserDashboard();
  }, [refreshUserDashboard]);

  // 3. Handle Wallet Verification (Sign gasless message)
  const handleVerifyWalletOwnership = async () => {
    if (!account) return;

    try {
      setIsVerifying(true);
      setVerificationError(null);

      const { nonce, message } = await swapCampaignApi.getNonce(account);
      const signature = await signMessage(message);
      const savedRef = localStorage.getItem('nova_swap_ref_code') || null;

      await swapCampaignApi.verifyWallet(account, signature, message, chainId, savedRef);
      await refreshUserDashboard();
    } catch (err: any) {
      setVerificationError(err.message || 'Signature verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // 4. Handle Swap Completed from LI.FI Widget
  const handleSwapSuccess = async (txData: any) => {
    try {
      const activeAccount = account || txData.walletAddress;
      if (!activeAccount) return;

      const res = await swapCampaignApi.submitTransaction({
        ...txData,
        walletAddress: activeAccount,
      });

      // Refresh dashboard with new volume and unlocked milestones
      await refreshUserDashboard();

      setSwapSuccessNotice(
        `🎉 Verified Swap! +$${res.verifiedVolume.toFixed(2)} USD added to your Genesis Campaign cumulative volume.`
      );
      setTimeout(() => setSwapSuccessNotice(null), 6000);

      // Track swap_completed event
      swapCampaignApi.trackEvent('swap_completed', activeAccount, {
        txHash: txData.txHash,
        volumeUSD: res.verifiedVolume,
      });
    } catch (err: any) {
      console.error('Failed to record swap transaction:', err);
    }
  };

  return (
    <div id="swap" className="mt-16 scroll-mt-28 w-full">
      {/* Swap Header */}
      <div className="text-center mb-6 px-4">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
          <Sparkles size={14} /> Multi-Chain DEX
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
          NovaP2P Swap
        </h2>
        <p className="text-sm md:text-base text-gray-500 mt-1 max-w-md mx-auto">
          Swap crypto assets seamlessly across multiple blockchains.
        </p>
      </div>

      {/* Floating Success Notice */}
      {swapSuccessNotice && (
        <div className="max-w-2xl mx-auto mb-4 px-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{swapSuccessNotice}</span>
            </div>
            <button
              onClick={() => setSwapSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 1. GENESIS CAMPAIGN MARKETING BANNER */}
      {/* Must remain VISUALLY IDENTICAL and in the same location before and after wallet connection */}
      <GenesisCampaignBanner
        campaign={campaign}
        onOpenDetails={() => setIsDetailsModalOpen(true)}
      />

      {/* 2. LI.FI SWAP WIDGET */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative flex justify-center items-center max-w-5xl mx-auto px-0 sm:px-2 w-full"
      >
        {/* Subtle ambient gradient glow in background */}
        <div className="absolute w-full max-w-[600px] h-[400px] sm:h-[550px] bg-gradient-to-tr from-blue-200/40 via-purple-100/30 to-orange-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <LiFiSwapWidget onSwapSuccess={handleSwapSuccess} onWalletChange={setDetectedWallet} />
      </motion.div>

      {/* 3. BELOW WIDGET: REWARDS AREA */}
      {/* State A (Disconnected): Show Genesis Rewards Showcase Card */}
      {!isWalletConnected ? (
        <GenesisRewardsPreviewCard
          onOpenDetails={() => setIsDetailsModalOpen(true)}
          onConnectWallet={connectWallet}
        />
      ) : (
        /* State B (Connected): Show Detailed Dashboard with 3 Cards */
        <div id="rewards" className="w-full scroll-mt-24">
          <GenesisRewardsDashboard
            dashboardData={userDashboard}
            walletAddress={effectiveAccount}
            isLoading={isLoadingDashboard}
            onRefresh={refreshUserDashboard}
            onOpenClaimModal={(reward) => setClaimModalReward(reward)}
            onDisconnectWallet={() => {
              setDetectedWallet(null);
              disconnectWallet();
            }}
            onOpenDetails={() => setIsDetailsModalOpen(true)}
          />
        </div>
      )}

      {/* 4. CAMPAIGN DETAILS MODAL */}
      <CampaignDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        campaign={campaign}
        milestones={milestones}
      />

      {/* 5. REWARD CLAIM REQUEST MODAL */}
      <RewardClaimModal
        isOpen={!!claimModalReward}
        onClose={() => setClaimModalReward(null)}
        reward={claimModalReward}
        onClaimSuccess={refreshUserDashboard}
      />
    </div>
  );
};

