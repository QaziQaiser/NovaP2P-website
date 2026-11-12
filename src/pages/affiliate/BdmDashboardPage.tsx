import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Wallet,
  FileText,
  BookOpen,
  Search,
  Copy,
  Check,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  Menu,
  X,
  Link2,
  Download,
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { affiliateApi, BdmDashboardData } from '../../services/affiliateApi';
import { WalletConnectGate } from '../../components/affiliate/WalletConnectGate';
import { AffiliateStatCards, StatCardItem } from '../../components/affiliate/AffiliateStatCards';
import { CommissionsTable } from '../../components/affiliate/CommissionsTable';
import { PayoutRequestModal } from '../../components/affiliate/PayoutRequestModal';
import logoImg from '../../assets/logo.png';

type BdmSidebarTab = 'overview' | 'partners' | 'earnings' | 'payouts' | 'reports' | 'resources';

export const BdmDashboardPage: React.FC = () => {
  const { account, isConnected, disconnectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<BdmSidebarTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState<BdmDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);
  const [roleRedirect, setRoleRedirect] = useState<'partner' | 'bdm' | null>(null);

  const [partnerSearch, setPartnerSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'BDM Dashboard — Nova Swap Business Development Portal | NovaP2P';
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
      const data = await affiliateApi.getBdmDashboard(account);
      setDashboard(data);
    } catch (err: any) {
      setDashboard(null);
      try {
        const status = await affiliateApi.getWalletStatus(account);
        if (status.isApproved && status.role === 'partner') {
          setRoleRedirect('partner');
          setAccessDeniedReason('This wallet is registered as a Partner. Open your Partner Dashboard instead.');
        } else if (status.status === 'pending') {
          setAccessDeniedReason('Your BDM application is currently pending admin approval (reviewed within 24 hours).');
        } else {
          setAccessDeniedReason('This wallet is not yet approved as a Nova Swap BDM.');
        }
      } catch {
        setAccessDeniedReason(err.message || 'Access denied. Approved BDM wallet required.');
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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const formatWallet = (addr: string) =>
    addr && addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const filteredPartners = (dashboard?.partners || []).filter((p) => {
    const q = partnerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.walletAddress.toLowerCase().includes(q) ||
      (p.fullName || '').toLowerCase().includes(q) ||
      (p.telegramUsername || '').toLowerCase().includes(q)
    );
  });

  const exportPartnersCsv = () => {
    if (!dashboard) return;
    const headers = ['Partner Wallet,Partner Name,Referred Volume USD,Partner Earnings USD,BDM Override USD,Status'];
    const rows = dashboard.partners.map(
      (p) =>
        `${p.walletAddress},"${p.fullName || ''}",${p.referredVolumeUSD.toFixed(2)},${p.partnerEarningsUSD.toFixed(4)},${p.bdmOverrideUSD.toFixed(4)},${p.status}`
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova-bdm-partners-${dashboard.bdm.walletAddress.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sidebarItems: { id: BdmSidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'partners', label: 'Partners', icon: <Users size={18} /> },
    { id: 'earnings', label: 'Volume & Earnings', icon: <BarChart3 size={18} /> },
    { id: 'payouts', label: 'Payouts', icon: <Wallet size={18} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
    { id: 'resources', label: 'Resources', icon: <BookOpen size={18} /> },
  ];

  const statCards: StatCardItem[] = dashboard
    ? [
        {
          label: 'Total Managed Volume',
          value: `$${dashboard.stats.totalManagedVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          subtext: `Partner volume: $${dashboard.stats.partnersOnlyVolumeUSD.toLocaleString()}`,
          icon: <TrendingUp size={20} />,
          accent: 'teal',
        },
        {
          label: 'Total Earnings',
          value: `$${dashboard.stats.totalEarningsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
          subtext: `10% override + 20% direct`,
          icon: <BarChart3 size={20} />,
          accent: 'emerald',
        },
        {
          label: 'Active Partners',
          value: String(dashboard.stats.activePartnersCount),
          subtext: `${dashboard.stats.totalPartnersCount} total assigned partners`,
          icon: <Users size={20} />,
          accent: 'blue',
        },
        {
          label: 'Pending Payout',
          value: `$${dashboard.stats.pendingPayoutUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
          subtext: dashboard.stats.pendingPayoutUSD >= 100 ? 'Ready to withdraw' : 'Min $100 | 24h payout',
          icon: <Clock size={20} />,
          accent: 'indigo',
        },
      ]
    : [];

  const renderStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30">
          <CheckCircle2 size={12} /> Active
        </span>
      );
    }
    if (status === 'pending_activation') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock size={12} /> Pending Activation
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50">
        <AlertCircle size={12} /> Inactive
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#060c14] text-slate-100 flex font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#08101b] border-r border-slate-800/80 shrink-0 sticky top-0 h-screen">
        <div className="h-20 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoImg} alt="Nova Swap" className="w-8 h-8 object-contain" />
            <div>
              <div className="text-base font-bold text-white leading-none">Nova Swap</div>
              <div className="text-[10px] tracking-[0.16em] text-teal-400 uppercase font-semibold mt-1">
                BDM COMMAND
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === item.id
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-2">
          <Link
            to="/"
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50"
          >
            <ArrowLeft size={14} /> Back to Main Site
          </Link>
          {isConnected && account && (
            <button
              onClick={disconnectWallet}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 cursor-pointer"
            >
              <LogOut size={14} /> Disconnect Wallet
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative w-64 bg-[#08101b] border-r border-slate-800 h-full flex flex-col p-4 z-10">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <img src={logoImg} alt="Nova Swap" className="w-7 h-7 object-contain" />
                <span className="font-bold text-white">BDM Portal</span>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1.5 flex-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    activeTab === item.id
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-800 space-y-1">
              <Link to="/" className="py-2.5 px-4 text-xs text-slate-400 hover:text-white flex items-center gap-2">
                <ArrowLeft size={14} /> Back to Main Site
              </Link>
              {isConnected && account && (
                <button
                  onClick={() => {
                    disconnectWallet();
                    setMobileSidebarOpen(false);
                  }}
                  className="w-full py-2.5 px-4 text-xs text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} /> Disconnect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Mobile/Status Header */}
        <header className="sticky top-0 z-30 h-16 sm:h-20 bg-[#08101b]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-white capitalize">
              {activeTab === 'earnings' ? 'Volume & Earnings' : activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && account ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0e1726] border border-slate-700/80">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-mono text-slate-200">{formatWallet(account)}</span>
                <button
                  onClick={disconnectWallet}
                  className="text-slate-400 hover:text-red-400 transition-colors ml-1 cursor-pointer lg:hidden"
                  title="Disconnect Wallet"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <Link to="/become-bdm" className="text-xs sm:text-sm font-semibold text-teal-400">
                Apply as BDM →
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {!isConnected || !account ? (
            <div className="max-w-xl mx-auto mt-10">
              <WalletConnectGate
                title="BDM Portal Login"
                subtitle="Connect your approved Business Development Manager wallet to track managed partners, override earnings, and request payouts."
                badgeText="Approved BDMs Only"
                accentColor="teal"
              />
            </div>
          ) : isLoading ? (
            <div className="rounded-3xl bg-[#0c1420] border border-slate-800 p-16 text-center mt-8">
              <Loader2 size={40} className="animate-spin text-teal-400 mx-auto mb-4" />
              <p className="text-slate-300 font-medium">Loading BDM portfolio...</p>
            </div>
          ) : accessDeniedReason || !dashboard ? (
            <div className="max-w-xl mx-auto mt-10 rounded-3xl bg-[#0c1420] border border-slate-800 p-8 sm:p-10 text-center shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-5">
                <ShieldAlert size={30} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">BDM Access Required</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">{accessDeniedReason}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {roleRedirect === 'partner' ? (
                  <Link
                    to="/partner-dashboard"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold text-sm"
                  >
                    Go to Partner Dashboard
                  </Link>
                ) : (
                  <Link
                    to="/become-bdm"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold text-sm"
                  >
                    Apply to Become a BDM
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
              {/* Welcome BDM Section */}
              <div className="rounded-2xl bg-gradient-to-r from-[#0c1624] via-[#0e1c2e] to-[#0a1826] border border-teal-500/25 p-6 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 text-teal-300 text-xs font-semibold border border-teal-500/25 mb-2">
                      Welcome Back, {dashboard.bdm.fullName || 'BDM'}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Manage Partners &amp; Track Override Commissions
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Earn <strong className="text-teal-400">10% fee override</strong> on your Partners&apos; volume + <strong className="text-teal-400">full 20% fee</strong> on your direct referral swaps.
                    </p>
                  </div>

                  <div className="flex flex-col items-stretch sm:items-end shrink-0">
                    <button
                      onClick={() => setIsPayoutModalOpen(true)}
                      className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      <Wallet size={18} />
                      <span>Request Payout</span>
                    </button>
                    <span className="text-[11px] text-slate-400 mt-1.5 text-center sm:text-right">
                      Minimum payout: $100 | Processed within 24 hours
                    </span>
                  </div>
                </div>

                {/* BDM Direct Link */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                    <Link2 size={15} className="text-teal-400" />
                    <span>Direct BDM Referral Link (20% Commission):</span>
                  </div>
                  <div className="flex-1 min-w-0 w-full flex items-center gap-2">
                    <div className="flex-1 min-w-0 bg-[#060c14] border border-slate-700/80 rounded-lg px-3 py-2 font-mono text-xs text-slate-200 truncate">
                      {dashboard.bdm.referralLink}
                    </div>
                    <button
                      onClick={() => handleCopy('bdm_link', dashboard.bdm.referralLink)}
                      className="px-3.5 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedId === 'bdm_link' ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === 'bdm_link' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Stat Cards */}
              <AffiliateStatCards cards={statCards} />

              {/* Main Content Based on Sidebar Selection */}
              {(activeTab === 'overview' || activeTab === 'partners') && (
                <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 overflow-hidden shadow-xl">
                  <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Managed Partners Network</h3>
                      <p className="text-xs text-slate-400">Live partner volumes, earnings &amp; 10% BDM override</p>
                    </div>

                    {/* Search Partners */}
                    <div className="relative w-full sm:w-72">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={partnerSearch}
                        onChange={(e) => setPartnerSearch(e.target.value)}
                        placeholder="Search partner wallet or name..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#080f18] border border-slate-700/80 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-teal-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400 bg-[#080f18]/60">
                          <th className="py-3.5 px-6">Partner Wallet</th>
                          <th className="py-3.5 px-6">Referred Volume</th>
                          <th className="py-3.5 px-6">Partner Earnings (20%)</th>
                          <th className="py-3.5 px-6">BDM Override (10%)</th>
                          <th className="py-3.5 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm">
                        {filteredPartners.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                              {partnerSearch
                                ? 'No partners match your search query.'
                                : 'No partners assigned yet. Once approved partners are mapped to your BDM wallet, they will appear here.'}
                            </td>
                          </tr>
                        ) : (
                          filteredPartners.map((partner) => (
                            <tr key={partner.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-white">{formatWallet(partner.walletAddress)}</span>
                                  <button
                                    onClick={() => handleCopy(partner.id, partner.walletAddress)}
                                    className="text-slate-500 hover:text-teal-400 cursor-pointer"
                                  >
                                    {copiedId === partner.id ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
                                  </button>
                                </div>
                                {partner.fullName && (
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    {partner.fullName} {partner.telegramUsername ? `• ${partner.telegramUsername}` : ''}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 font-semibold text-white">
                                ${partner.referredVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-4 px-6 text-slate-300">
                                ${partner.partnerEarningsUSD.toFixed(4)}
                              </td>
                              <td className="py-4 px-6 font-semibold text-teal-400">
                                +${partner.bdmOverrideUSD.toFixed(4)}
                              </td>
                              <td className="py-4 px-6 text-right">
                                {renderStatusBadge(partner.status)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(activeTab === 'overview' || activeTab === 'earnings') && (
                <CommissionsTable
                  title="Live Overrides & Direct Commissions"
                  commissions={dashboard.commissions.map((c) => ({
                    id: c.id,
                    date: c.date,
                    referredUser: c.referredUser,
                    swapVolumeUSD: c.swapVolumeUSD,
                    commissionRatePct: c.commissionRatePct,
                    commissionAmountUSD: c.commissionAmountUSD,
                    status: c.status,
                    subtitle:
                      c.commissionType === 'bdm_override' && c.sourcePartnerWallet
                        ? `10% Override via Partner ${formatWallet(c.sourcePartnerWallet)}`
                        : 'Direct BDM Referral (20%)',
                  }))}
                />
              )}

              {activeTab === 'payouts' && (
                <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 overflow-hidden shadow-xl">
                  <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">BDM Payout History</h3>
                      <p className="text-xs text-slate-400">Minimum withdrawal: $100 | Processed within 24 hours</p>
                    </div>
                    <button
                      onClick={() => setIsPayoutModalOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Request Payout
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400 bg-[#080f18]/60">
                          <th className="py-3.5 px-6">Date</th>
                          <th className="py-3.5 px-6">Amount</th>
                          <th className="py-3.5 px-6">Network</th>
                          <th className="py-3.5 px-6">Destination</th>
                          <th className="py-3.5 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm">
                        {dashboard.payouts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 px-6 text-center text-slate-500">
                              No BDM payouts submitted yet.
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
                              </td>
                              <td className="py-4 px-6 text-right">{renderStatusBadge(pay.status)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Partner Performance Export</h3>
                      <p className="text-xs text-slate-400">Download full CSV breakdown of partner volumes, commissions, and override totals.</p>
                    </div>
                    <button
                      onClick={exportPartnersCsv}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 font-semibold text-sm cursor-pointer"
                    >
                      <Download size={16} /> Export CSV Report
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white">BDM Guidelines &amp; Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                    <div className="p-4 rounded-xl bg-[#080f18] border border-slate-800">
                      <h4 className="font-bold text-teal-400 mb-1.5">Commission Rules</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Platform fee is 0.5%. Partners receive 20% (0.10% of volume). You receive a 10% override fee on all volume generated by Partners under your management, plus full 20% on users who join via your direct BDM link.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#080f18] border border-slate-800">
                      <h4 className="font-bold text-teal-400 mb-1.5">Cashback Separation</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Normal users receive 5% cashback on their trades. Partners and BDMs do not receive cashback on referred user volume, though personal swaps earn 5% cashback automatically.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {dashboard && account && (
        <PayoutRequestModal
          isOpen={isPayoutModalOpen}
          onClose={() => setIsPayoutModalOpen(false)}
          walletAddress={account}
          availableBalanceUSD={dashboard.stats.pendingPayoutUSD}
          minWithdrawalUSD={dashboard.stats.minWithdrawalUSD}
          onSuccess={loadDashboard}
        />
      )}
    </div>
  );
};

