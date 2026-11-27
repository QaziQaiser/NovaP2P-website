import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wallet, ShieldCheck, AlertCircle, Loader2, CheckCircle2, Gift, Users, ArrowDownUp, Shuffle, Clock } from 'lucide-react';
import { LiFiSwapWidget } from './LiFiSwapWidget';
import { MarketChainSelector } from './MarketChainSelector';
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
import { affiliateApi } from '../../services/affiliateApi';

// Limit mode (CoW Protocol) is separate from the Market swap and only loaded when selected
const LimitOrderPanel = lazy(() => import('./limit/LimitOrderPanel').then((m) => ({ default: m.LimitOrderPanel })));

type SwapMode = 'market' | 'cross' | 'limit';

const SWAP_MODES: { id: SwapMode; label: string; icon: React.ElementType; caption: string }[] = [
  { id: 'market', label: 'Market', icon: ArrowDownUp, caption: 'Instant swaps on one network at the best price across DEXs.' },
  { id: 'cross', label: 'Cross Chain', icon: Shuffle, caption: 'Move assets between networks. Every bridge and DEX route compared.' },
  { id: 'limit', label: 'Limit', icon: Clock, caption: 'Set your price. Fills on CoW Protocol when the market reaches it.' },
];

interface NovaSwapSectionProps {
  /** Show the "Multi-Chain DEX / NovaP2P Swap" header above the swap box (hidden on the homepage) */
  showHeader?: boolean;
}

export const NovaSwapSection: React.FC<NovaSwapSectionProps> = ({ showHeader = true }) => {
  const { account, chainId, isConnected, connectWallet, disconnectWallet, syncExternalWallet, signMessage } = useWallet();
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);

  const handleWidgetWalletChange = (addr: string | null) => {
    setDetectedWallet(addr);
    syncExternalWallet(addr);
  };

  // The rewards cards follow the wallet connected inside the swap widget, so both always show the same state.
  // (A wallet only authorized for the site, e.g. from another page, is not the widget's wallet.)
  const effectiveAccount = detectedWallet;
  const isWalletConnected = !!effectiveAccount;

  // Market (LI.FI, same-chain only), Cross Chain (LI.FI, full cross-chain routing) or Limit (CoW Protocol).
  // Market and Cross Chain share one LI.FI widget, so the wallet session carries across all three tabs.
  const [swapMode, setSwapMode] = useState<SwapMode>('market');
  const [marketChainId, setMarketChainId] = useState<number>(1);
  // The LI.FI widget keeps the last of Market / Cross Chain while the Limit tab is open
  const [widgetMode, setWidgetMode] = useState<'market' | 'cross'>('market');
  const selectMode = useCallback((mode: SwapMode) => {
    setSwapMode(mode);
    if (mode !== 'limit') setWidgetMode(mode);
  }, []);

  // Limit mode uses the wallet connected in the Market swap widget (one shared session). "Connect Wallet"
  // in Limit mode opens the widget's own wallet picker and returns to Limit once an EVM wallet is connected.
  const marketRef = useRef<HTMLDivElement>(null);
  const [returnToLimit, setReturnToLimit] = useState(false);
  const openSwapWalletConnect = useCallback(() => {
    setReturnToLimit(true);
    setSwapMode(widgetMode);
    let tries = 0;
    const clickConnect = () => {
      const root = marketRef.current;
      let btn: HTMLButtonElement | null = null;
      root?.querySelectorAll<HTMLButtonElement>('button').forEach((b: HTMLButtonElement) => {
        if (!btn && /connect wallet/i.test(b.textContent || '') && b.offsetParent !== null) btn = b;
      });
      if (btn) (btn as HTMLButtonElement).click();
      else if (++tries < 20) setTimeout(clickConnect, 100);
    };
    setTimeout(clickConnect, 50);
  }, [widgetMode]);
  useEffect(() => {
    if (returnToLimit && detectedWallet && /^0x[a-fA-F0-9]{40}$/.test(detectedWallet)) {
      setReturnToLimit(false);
      setSwapMode('limit');
    }
  }, [returnToLimit, detectedWallet]);

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
        localStorage.setItem('nova_affiliate_ref_wallet', ref.trim().toLowerCase());
        swapCampaignApi.trackReferral(cleanRef);
        affiliateApi.trackReferral(ref.trim().toLowerCase());
      }

      // Track campaign page impression
      swapCampaignApi.trackEvent('campaign_page_view', null, {
        referrer: document.referrer,
        url: window.location.href,
      });
    }

  }, []);

  // Load active campaign settings, and re-check every 30s (and when the tab regains focus)
  // so changes saved in the admin panel appear on the live site without a reload.
  useEffect(() => {
    let cancelled = false;
    const loadCampaign = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      swapCampaignApi
        .getCampaign()
        .then((data) => {
          if (cancelled) return;
          setCampaign(data.campaign);
          setMilestones(data.milestones);
        })
        .catch((err) => {
          console.error('Failed to load campaign settings:', err);
        });
    };
    loadCampaign();
    const interval = setInterval(loadCampaign, 30000);
    document.addEventListener('visibilitychange', loadCampaign);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', loadCampaign);
    };
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

  // Bind stored affiliate ?ref=WALLET attribution when wallet connects
  useEffect(() => {
    if (!effectiveAccount || typeof window === 'undefined') return;
    const savedAffRef = localStorage.getItem('nova_affiliate_ref_wallet');
    if (savedAffRef && savedAffRef !== effectiveAccount.toLowerCase()) {
      affiliateApi.trackReferral(savedAffRef, effectiveAccount);
    }
  }, [effectiveAccount]);

  // Periodic polling to keep volume, cashback & milestones up to date (paused while the tab is hidden)
  useEffect(() => {
    if (!effectiveAccount) return;
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshUserDashboard();
    }, 8000);
    return () => clearInterval(pollInterval);
  }, [effectiveAccount, refreshUserDashboard]);

  // Auto-sync completed swaps from LI.FI widget localStorage storage
  useEffect(() => {
    if (!effectiveAccount) return;

    const syncWidgetSwaps = async () => {
      try {
        if (typeof window === 'undefined') return;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('widget-routes') || key.includes('routes'))) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const routesObj = parsed?.state?.routes || parsed?.routes || parsed;
            if (routesObj && typeof routesObj === 'object') {
              for (const rId of Object.keys(routesObj)) {
                const item = routesObj[rId];
                const route = item?.route || item;
                const status = item?.status;
                const isDone =
                  status === 4 ||
                  (route?.steps && route.steps.every((s: any) => s.execution?.status === 'DONE'));
                if (isDone && route) {
                  const syncedKey = `nova_synced_tx_${rId}`;
                  if (localStorage.getItem(syncedKey)) continue;

                  let txHash = '';
                  if (route.steps) {
                    for (const step of route.steps) {
                      if (step.execution?.actions) {
                        for (const act of step.execution.actions) {
                          if (act.txHash) {
                            txHash = act.txHash;
                            break;
                          }
                          if (act.taskId) {
                            txHash = act.taskId;
                            break;
                          }
                        }
                      }
                      if (txHash) break;
                    }
                  }
                  // Only real on-chain hashes can be verified; others are credited by the server-side LI.FI sync
                  if (!/^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{43,100})$/.test(txHash)) txHash = '';

                  const rawVol =
                    route.fromAmountUSD ||
                    route.toAmountUSD ||
                    route.steps?.[0]?.fromAmountUSD ||
                    route.steps?.[0]?.estimate?.fromAmountUSD;
                  const volumeUSD = rawVol ? parseFloat(String(rawVol)) : 0;

                  if (volumeUSD >= 1 && txHash) {
                    try {
                      const res = await swapCampaignApi.submitTransaction({
                        walletAddress: effectiveAccount,
                        chainId: route.fromChainId || route.steps?.[0]?.action?.fromChainId || 1,
                        txHash,
                        volumeUSD,
                        lifiRouteId: route.id,
                      });
                      // Still confirming on LI.FI: retry on a later sync instead of marking it done
                      if (!res?.pending) {
                        localStorage.setItem(syncedKey, 'true');
                      }
                      await refreshUserDashboard();
                    } catch {
                      // Rejected (duplicate / not eligible): don't retry it on every page load
                      localStorage.setItem(syncedKey, 'true');
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Auto-sync widget swaps error:', err);
      }
    };

    syncWidgetSwaps();
  }, [effectiveAccount, refreshUserDashboard]);

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
      const activeAccount = effectiveAccount || account || detectedWallet || txData.walletAddress;
      if (!activeAccount) {
        console.warn('Swap completed but no active account detected');
        return;
      }

      const res = await swapCampaignApi.submitTransaction({
        ...txData,
        walletAddress: activeAccount,
      });

      // LI.FI has not finalized the swap yet; the dashboard sync credits it automatically once final
      if (res?.pending) {
        try {
          const cacheKey = `nova_swaps_${activeAccount.toLowerCase()}`;
          const prev = JSON.parse(localStorage.getItem(cacheKey) || '[]');
          prev.push({ ...txData, date: new Date().toISOString() });
          localStorage.setItem(cacheKey, JSON.stringify(prev));
        } catch {}
        setSwapSuccessNotice('⏳ Swap completed! Your Genesis Campaign volume will update as soon as LI.FI confirms it.');
        setTimeout(() => setSwapSuccessNotice(null), 8000);
        setTimeout(() => refreshUserDashboard(), 25000);
        return;
      }

      // Save to localStorage as immediate local cache
      try {
        const cacheKey = `nova_swaps_${activeAccount.toLowerCase()}`;
        const prev = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        prev.push({
          ...txData,
          verifiedVolume: res.verifiedVolume,
          date: new Date().toISOString(),
        });
        localStorage.setItem(cacheKey, JSON.stringify(prev));
      } catch {}

      // Refresh dashboard with new volume and unlocked milestones
      await refreshUserDashboard();

      setSwapSuccessNotice(
        `🎉 Verified Swap! +$${res.verifiedVolume.toFixed(2)} USD added to your Genesis Campaign cumulative volume.`
      );
      setTimeout(() => setSwapSuccessNotice(null), 8000);

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
      {showHeader && (
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
      )}

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

      {/* MARKET | CROSS CHAIN | LIMIT */}
      <div className="flex justify-center mb-2 px-4">
        <div role="tablist" aria-label="Swap type" className="inline-flex p-1 rounded-full bg-white border border-gray-200 shadow-sm max-w-full">
          {SWAP_MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={swapMode === id}
              onClick={() => {
                setReturnToLimit(false);
                selectMode(id);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                swapMode === id ? 'bg-primary text-white shadow' : 'text-gray-600 hover:text-primary'
              }`}
            >
              <Icon size={15} className="hidden sm:block shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mb-4 px-4">{SWAP_MODES.find((m) => m.id === swapMode)?.caption}</p>

      {/* MARKET NETWORK (same-chain swaps: both tokens stay on this network) */}
      {swapMode === 'market' && (
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 mb-4 px-4 relative z-30">
          <span className="text-xs font-semibold text-gray-500">Network</span>
          <MarketChainSelector value={marketChainId} onChange={setMarketChainId} />
          <span className="text-[11px] text-gray-400 basis-full sm:basis-auto text-center">Both tokens stay on this network</span>
        </div>
      )}

      {/* LIMIT ORDERS (same chain, CoW Protocol) */}
      {swapMode === 'limit' && (
        <Suspense
          fallback={
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          }
        >
          <LimitOrderPanel
            account={detectedWallet}
            onConnectWallet={openSwapWalletConnect}
            onUseMarket={() => {
              setReturnToLimit(false);
              selectMode('market');
            }}
          />
        </Suspense>
      )}

      {/* LI.FI SWAP WIDGET (Market and Cross Chain; stays mounted and is only hidden in Limit mode) */}
      <motion.div
        ref={marketRef}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`relative ${swapMode !== 'limit' ? 'flex' : 'hidden'} justify-center items-center max-w-5xl mx-auto px-0 sm:px-2 w-full`}
      >
        {/* Subtle ambient gradient glow in background */}
        <div className="absolute w-full max-w-[600px] h-[400px] sm:h-[550px] bg-gradient-to-tr from-blue-200/40 via-purple-100/30 to-orange-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <LiFiSwapWidget
          onSwapSuccess={handleSwapSuccess}
          onWalletChange={handleWidgetWalletChange}
          isWalletConnected={isWalletConnected}
          mode={widgetMode}
          marketChainId={marketChainId}
        />
      </motion.div>

      {/* 3. BELOW WIDGET: REWARDS AREA */}
      {/* State A (Disconnected): Show Genesis Rewards Showcase Card */}
      {!isWalletConnected ? (
        <GenesisRewardsPreviewCard
          campaign={campaign}
          milestones={milestones}
          onOpenDetails={() => setIsDetailsModalOpen(true)}
        />
      ) : (
        /* State B (Connected): Show Detailed Dashboard with 3 Cards */
        <div id="rewards" className="w-full scroll-mt-24">
          <GenesisRewardsDashboard
            dashboardData={userDashboard}
            campaign={campaign}
            milestones={milestones}
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

