import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Link2,
  Copy,
  Check,
  Wallet,
  Clock,
  TrendingUp,
  Users,
  Bell,
  User,
  LogOut,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { affiliateApi, PartnerDashboardData } from '../../services/affiliateApi';
import { WalletConnectGate } from '../../components/affiliate/WalletConnectGate';
import { AffiliateStatCards, StatCardItem } from '../../components/affiliate/AffiliateStatCards';
import { CommissionsTable } from '../../components/affiliate/CommissionsTable';
import { PayoutRequestModal } from '../../components/affiliate/PayoutRequestModal';
import logoImg from '../../assets/logo.png';

type PartnerTab = 'dashboard' | 'referrals' | 'commissions' | 'payouts';

export const PartnerDashboardPage: React.FC = () => {
  const { account, isConnected, disconnectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<PartnerTab>('dashboard');
  const [dashboard, setDashboard] = useState<PartnerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);
  const [roleRedirect, setRoleRedirect] = useState<'partner' | 'bdm' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Partner Dashboard — Nova Swap Affiliate Portal | NovaP2P';
    window.scrollTo(0, 0);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!account) {
      setDashboard(null);
      setAccessDeniedReason(null);
      return;
    }

    try {
      setIsLoading(true);
      setAccessDeniedReason(null);
      setRoleRedirect(null);
      const data = await affiliateApi.getPartnerDashboard(account);
      setDashboard(data);
    } catch (err: any) {
      setDashboard(null);
      // Check if wallet is BDM instead or pending
      try {
        const status = await affiliateApi.getWalletStatus(account);
        if (status.isApproved && status.role === 'bdm') {
          setRoleRedirect('bdm');
          setAccessDeniedReason('This wallet is registered as a BDM. Open your BDM Dashboard instead.');
        } else if (status.status === 'pending') {
          setAccessDeniedReason('Your Partner application is currently pending admin approval (reviewed within 24 hours).');
        } else {
          setAccessDeniedReason('This wallet is not yet approved as a Nova Swap Partner.');
        }
      } catch {
        setAccessDeniedReason(err.message || 'Access denied. Approved Partner wallet required.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (isConnected && account) {
      loadDashboard();
    } else {
      setDashboard(null);
      setAccessDeniedReason(null);
    }
  }, [isConnected, account, loadDashboard]);

  const handleCopyReferralLink = () => {
    if (!dashboard?.partner.referralLink) return;
    navigator.clipboard.writeText(dashboard.partner.referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatWallet = (addr: string) =>
    addr && addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const statCards: StatCardItem[] = dashboard
    ? [
        {
          label: 'Total Earnings',
          value: `$${dashboard.stats.totalEarningsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
          subtext: `Paid: $${dashboard.stats.paidBalanceUSD.toFixed(2)} • Lifetime 20% fee`,
          icon: <Wallet size={20} />,
          accent: 'teal',
        },
        {
          label: 'Pending Balance',
          value: `$${dashboard.stats.pendingBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
          subtext: dashboard.stats.pendingBalanceUSD >= 100 ? 'Eligible for Payout' : `Min $100 to withdraw`,
          icon: <Clock size={20} />,
          accent: 'blue',
        },
        {
          label: 'Referred Volume',
          value: `$${dashboard.stats.referredVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          subtext: `0.10% commission on volume`,
          icon: <TrendingUp size={20} />,
          accent: 'emerald',
        },
        {
          label: 'Active Users',
          value: String(dashboard.stats.activeUsers),
          subtext: `+${dashboard.stats.referralsThisMonth} this month`,
          icon: <Users size={20} />,
          accent: 'indigo',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#060c14] text-slate-100 flex flex-col font-sans">
      {/* Top Dark Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#08101b]/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 sm:h-20 flex items-center justify-between gap-4">
            {/* Brand */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2.5 group">
                <img src={logoImg} alt="Nova Swap" className="w-8 h-8 object-contain" />
                <div>
                  <div className="text-lg font-bold text-white leading-none tracking-tight">Nova Swap</div>
                  <div className="text-[10px] tracking-[0.18em] text-teal-400 uppercase font-semibold mt-0.5">
                    PARTNER PORTAL
                  </div>
                </div>
              </Link>
              <Link
                to="/"
                className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-300 transition-colors ml-2 px-2.5 py-1 rounded-lg bg-slate-800/50 border border-slate-700/60"
              >
                <ArrowLeft size={12} /> Main Site
              </Link>
            </div>

            {/* Center Navigation Tabs */}
            {dashboard && (
              <nav className="hidden md:flex items-center gap-8">
                {(
                  [
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'referrals', label: 'Referrals' },
                    { id: 'commissions', label: 'Commissions' },
                    { id: 'payouts', label: 'Payouts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-6 text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full" />
                    )}
                  </button>
                ))}
              </nav>
            )}

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {isConnected && account ? (
                <>
                  <button
                    onClick={() => setActiveTab('payouts')}
                    className="relative p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title="Payout Notifications"
                  >
                    <Bell size={18} />
                    {dashboard && dashboard.stats.pendingBalanceUSD >= 100 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-400" />
                    )}
                  </button>
                  <div className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-[#0e1726] border border-slate-700/80">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
                      <User size={14} />
                    </div>
                    <span className="text-xs font-mono text-slate-200 hidden sm:inline">
                      {formatWallet(account)}
                    </span>
                    <button
                      onClick={disconnectWallet}
                      className="text-slate-400 hover:text-red-400 transition-colors ml-1 cursor-pointer"
                      title="Disconnect Wallet"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to="/become-partner"
                  className="text-xs sm:text-sm font-semibold text-teal-400 hover:text-teal-300"
                >
                  Apply as Partner →
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Tabs */}
          {dashboard && (
            <div className="flex md:hidden items-center justify-between gap-1.5 overflow-x-auto pb-2 border-t border-slate-800/60 pt-2">
              {(
                [
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'referrals', label: 'Referrals' },
                  { id: 'commissions', label: 'Commissions' },
                  { id: 'payouts', label: 'Payouts' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected || !account ? (
          <div className="max-w-xl mx-auto mt-10">
            <WalletConnectGate
              title="Partner Dashboard Login"
              subtitle="Connect your approved Partner wallet to access live referral statistics, commissions, and payout requests."
              badgeText="Approved Partners Only"
              accentColor="teal"
            />
          </div>
        ) : isLoading ? (
          <div className="rounded-3xl bg-[#0c1420] border border-slate-800 p-16 text-center mt-8">
            <Loader2 size={40} className="animate-spin text-teal-400 mx-auto mb-4" />
            <p className="text-slate-300 font-medium">Loading Partner analytics...</p>
          </div>
        ) : accessDeniedReason || !dashboard ? (
          <div className="max-w-xl mx-auto mt-10 rounded-3xl bg-[#0c1420] border border-slate-800 p-8 sm:p-10 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-5">
              <ShieldAlert size={30} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Partner Access Required</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{accessDeniedReason}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {roleRedirect === 'bdm' ? (
                <Link
                  to="/bdm-dashboard"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold text-sm hover:opacity-95"
                >
                  Go to BDM Dashboard
                </Link>
              ) : (
                <Link
                  to="/become-partner"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold text-sm hover:opacity-95"
                >
                  Apply to Become a Partner
                </Link>
              )}
              <button
                onClick={disconnectWallet}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer"
              >
                Switch Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Big Referral Link Box */}
            <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 p-5 sm:p-6 shadow-xl shadow-black/25">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                    <Link2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white">Your Referral Link</h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Share your link and earn <strong className="text-teal-400">20% of the 0.5% fee (0.10% of volume)</strong> lifetime • Referrals get 5% cashback
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0 w-full lg:max-w-2xl">
                  <div className="flex-1 min-w-0 bg-[#070d15] border border-slate-700/80 rounded-xl px-4 py-3 font-mono text-xs sm:text-sm text-slate-200 truncate">
                    {dashboard.partner.referralLink}
                  </div>
                  <button
                    onClick={handleCopyReferralLink}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-teal-500/20 shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Four Stat Cards */}
            <AffiliateStatCards cards={statCards} />

            {/* Tab Views */}
            {activeTab === 'dashboard' && (
              <>
                <CommissionsTable
                  title="Recent Commissions"
                  commissions={dashboard.commissions.slice(0, 10)}
                  onViewAll={() => setActiveTab('commissions')}
                />

                {/* Bottom Request Payout CTA */}
                <div className="pt-2 flex flex-col items-center">
                  <button
                    onClick={() => setIsPayoutModalOpen(true)}
                    className="w-full max-w-md py-4 px-8 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-base shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Wallet size={20} />
                    <span>Request Payout</span>
                  </button>
                  <p className="text-xs text-slate-400 mt-3">
                    Minimum payout: $100 | Processed within 24 hours
                  </p>
                </div>
              </>
            )}

            {activeTab === 'commissions' && (
              <CommissionsTable title="All Commissions History" commissions={dashboard.commissions} />
            )}

            {activeTab === 'referrals' && (
              <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Referred Traders ({dashboard.referrals.length})</h3>
                  <span className="text-xs text-teal-400 font-medium">Lifetime Attribution</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400 bg-[#080f18]/60">
                        <th className="py-3.5 px-6">User Wallet</th>
                        <th className="py-3.5 px-6">Total Swaps</th>
                        <th className="py-3.5 px-6">Lifetime Volume</th>
                        <th className="py-3.5 px-6">Your Commission (0.10%)</th>
                        <th className="py-3.5 px-6 text-right">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {dashboard.referrals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                            No referred users yet. Share your link to onboard traders!
                          </td>
                        </tr>
                      ) : (
                        dashboard.referrals.map((ref) => (
                          <tr key={ref.id} className="hover:bg-slate-800/30">
                            <td className="py-4 px-6 font-mono text-slate-200">{formatWallet(ref.walletAddress)}</td>
                            <td className="py-4 px-6 text-slate-300">{ref.swapsCount}</td>
                            <td className="py-4 px-6 font-semibold text-white">
                              ${ref.totalVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-4 px-6 font-semibold text-teal-400">
                              +${(ref.totalVolumeUSD * 0.001).toFixed(4)}
                            </td>
                            <td className="py-4 px-6 text-right text-slate-400 text-xs">
                              {new Date(ref.joinedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Withdraw Commissions</h3>
                    <p className="text-sm text-slate-400">
                      Available Pending Balance: <strong className="text-teal-400">${dashboard.stats.pendingBalanceUSD.toFixed(2)} USDT</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPayoutModalOpen(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    Request Payout
                  </button>
                </div>

                <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 overflow-hidden shadow-xl">
                  <div className="px-6 py-4 border-b border-slate-800/80">
                    <h3 className="text-lg font-semibold text-white">Payout History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400 bg-[#080f18]/60">
                          <th className="py-3.5 px-6">Date</th>
                          <th className="py-3.5 px-6">Amount</th>
                          <th className="py-3.5 px-6">Network &amp; Token</th>
                          <th className="py-3.5 px-6">Destination</th>
                          <th className="py-3.5 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm">
                        {dashboard.payouts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                              No payout requests submitted yet. Minimum withdrawal is $100.
                            </td>
                          </tr>
                        ) : (
                          dashboard.payouts.map((pay) => (
                            <tr key={pay.id} className="hover:bg-slate-800/30">
                              <td className="py-4 px-6 text-slate-300 text-xs">
                                {new Date(pay.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-6 font-bold text-white">
                                ${pay.amount_usd.toFixed(2)} {pay.preferred_token}
                              </td>
                              <td className="py-4 px-6 text-slate-300 text-xs">{pay.preferred_network}</td>
                              <td className="py-4 px-6 font-mono text-xs text-slate-400">
                                {formatWallet(pay.payout_address)}
                                {pay.tx_hash && (
                                  <div className="text-[11px] text-teal-400 flex items-center gap-1 mt-0.5">
                                    <span>Tx: {formatWallet(pay.tx_hash)}</span>
                                    <ExternalLink size={10} />
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                {pay.status === 'paid' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30">
                                    <CheckCircle2 size={12} /> Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    <Clock size={12} /> {pay.status}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {dashboard && account && (
        <PayoutRequestModal
          isOpen={isPayoutModalOpen}
          onClose={() => setIsPayoutModalOpen(false)}
          walletAddress={account}
          availableBalanceUSD={dashboard.stats.pendingBalanceUSD}
          minWithdrawalUSD={dashboard.stats.minWithdrawalUSD}
          onSuccess={loadDashboard}
        />
      )}
    </div>
  );
};

