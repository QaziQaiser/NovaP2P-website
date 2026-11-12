import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock, ShieldCheck, ArrowRight, Loader2, LogOut, Sparkles } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { affiliateApi, AffiliateStatusResponse } from '../../services/affiliateApi';
import { WalletConnectGate } from '../../components/affiliate/WalletConnectGate';
import { PartnerApplicationForm } from '../../components/affiliate/PartnerApplicationForm';

export const BecomePartnerPage: React.FC = () => {
  const { account, isConnected, disconnectWallet } = useWallet();
  const navigate = useNavigate();

  const [statusData, setStatusData] = useState<AffiliateStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!account) {
      setStatusData(null);
      return;
    }
    try {
      setIsLoading(true);
      const data = await affiliateApi.getWalletStatus(account);
      setStatusData(data);
      if (data.isApproved) {
        if (data.role === 'partner') {
          navigate('/partner-dashboard', { replace: true });
        } else if (data.role === 'bdm') {
          navigate('/bdm-dashboard', { replace: true });
        }
      }
    } catch (err) {
      console.error('Failed to check affiliate status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [account, navigate]);

  useEffect(() => {
    document.title = 'Become a Partner — Nova Swap Affiliate Program | NovaP2P';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (isConnected && account) {
      checkStatus();
    } else {
      setStatusData(null);
    }
  }, [isConnected, account, checkStatus]);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-xs sm:text-sm mb-4">
            <Sparkles size={15} />
            <span>Nova Swap Partner Program • 20% Lifetime Commission</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Become a Nova Swap Partner
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Earn <strong>20% of platform trading fees (0.1% of volume)</strong> for life on every user who trades through your referral link. Your referrals also receive 5% cashback on their swaps.
          </p>
        </div>

        {/* Connected Wallet Header */}
        {isConnected && account && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl px-4 sm:px-5 py-3.5 mb-6 shadow-sm">
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-gray-500 shrink-0">Connected Wallet:</span>
              <span className="font-mono font-semibold text-gray-900 break-all">{account}</span>
            </div>
            <button
              onClick={disconnectWallet}
              className="text-xs font-medium text-gray-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
            >
              <LogOut size={14} /> Disconnect
            </button>
          </div>
        )}

        {/* Main Content */}
        {!isConnected || !account ? (
          <WalletConnectGate
            title="Connect Your Wallet to Apply"
            subtitle="Connect your Web3 wallet first to check if you are already an approved Partner or to submit your Partner application."
          />
        ) : isLoading ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center shadow-lg">
            <Loader2 size={36} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Checking wallet approval status...</p>
          </div>
        ) : statusData?.status === 'pending' ? (
          <div className="bg-white border border-amber-200 rounded-3xl p-8 md:p-10 text-center shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-5">
              <Clock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Pending Review</h2>
            <p className="text-gray-600 max-w-lg mx-auto mb-6">
              Your {statusData.role === 'bdm' ? 'BDM' : 'Partner'} application for wallet{' '}
              <span className="font-mono font-semibold text-gray-900 break-all">{account}</span> is currently under review. Applications are processed within 24 hours.
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl">
              <ShieldCheck size={15} className="text-primary" />
              <span>Once approved, reconnecting this wallet unlocks your dashboard automatically.</span>
            </div>
          </div>
        ) : (
          <PartnerApplicationForm walletAddress={account} onSubmitted={checkStatus} />
        )}

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          <Link to="/commission" className="hover:text-primary flex items-center gap-1 font-medium">
            View Commission Structure <ArrowRight size={14} />
          </Link>
          <Link to="/become-bdm" className="hover:text-primary flex items-center gap-1 font-medium">
            Interested in Managing Partners? Apply as BDM <ArrowRight size={14} />
          </Link>
          <Link to="/partner-faq" className="hover:text-primary flex items-center gap-1 font-medium">
            Partner FAQ <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

