import React, { useState, useEffect } from 'react';
import {
  Lock,
  BarChart3,
  Settings,
  Gift,
  ShieldAlert,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  Users,
  TrendingUp,
  Check,
  Plus,
  Trash2,
  Edit,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { swapCampaignApi } from '../../services/swapCampaignApi';
import { AffiliateAdminPanel } from './AffiliateAdminPanel';

export const SwapAdminDashboard: React.FC = () => {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('nova_swap_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'campaign' | 'claims' | 'fraud' | 'logs' | 'affiliates'>('analytics');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data states
  const [overviewData, setOverviewData] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Filter states
  const [claimStatusFilter, setClaimStatusFilter] = useState('all');
  const [claimSearch, setClaimSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Selected claim for payout modal
  const [payingClaim, setPayingClaim] = useState<any | null>(null);
  const [payoutNetwork, setPayoutNetwork] = useState('BNB Smart Chain');
  const [payoutToken, setPayoutToken] = useState('USDT');
  const [payoutTxHash, setPayoutTxHash] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');

  // Campaign Settings Edit form
  const [campaignForm, setCampaignForm] = useState<any>(null);

  // New/Edit Milestone Form
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);

  // Check initial login
  useEffect(() => {
    if (adminKey) {
      handleLogin(adminKey);
    }
  }, []);

  const handleLogin = async (key: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await swapCampaignApi.adminLogin(key);
      localStorage.setItem('nova_swap_admin_key', key);
      setIsAuthenticated(true);
      loadAllData(key);
    } catch (err: any) {
      setErrorMessage('Invalid Admin Passkey. Please check your credentials.');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nova_swap_admin_key');
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const loadAllData = async (key: string) => {
    try {
      setIsLoading(true);
      const [overview, claimsRes, usersRes, logsRes] = await Promise.all([
        swapCampaignApi.getAdminOverview(key).catch(() => null),
        swapCampaignApi.getAdminClaims(key).catch(() => ({ claims: [] })),
        swapCampaignApi.getAdminUsers(key).catch(() => ({ users: [] })),
        swapCampaignApi.getAdminAuditLogs(key).catch(() => ({ logs: [] })),
      ]);

      if (overview) {
        setOverviewData(overview);
        setCampaignForm({
          title: overview.campaign?.title || '',
          description: overview.campaign?.description || '',
          status: overview.campaign?.status || 'active',
          startDate: overview.campaign?.start_date || '',
          endDate: overview.campaign?.end_date || '',
          totalBudgetUSD: overview.campaign?.total_budget_usd || 10000,
          minSwapUSD: overview.campaign?.min_swap_usd || 10,
          referralRewardUSD: overview.campaign?.referral_reward_usd || 5.0,
          referralQualifyingVolUSD: overview.campaign?.referral_qualifying_vol_usd || 2000,
          cashbackEnabled: Boolean(overview.campaign?.cashback_enabled),
          cashbackPercentage: overview.campaign?.cashback_percentage || 0,
        });
      }

      setClaims(claimsRes.claims || []);
      setUsers(usersRes.users || []);
      setAuditLogs(logsRes.logs || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 1. Save Campaign Settings
  const handleSaveCampaignSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await swapCampaignApi.updateAdminCampaign(adminKey, campaignForm);
      notifySuccess('Campaign settings saved successfully!');
      loadAllData(adminKey);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Save Milestone
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;

    try {
      setIsLoading(true);
      await swapCampaignApi.saveAdminMilestone(adminKey, editingMilestone);
      setEditingMilestone(null);
      notifySuccess('Milestone saved successfully!');
      loadAllData(adminKey);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save milestone');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Delete Milestone
  const handleDeleteMilestone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    try {
      setIsLoading(true);
      await swapCampaignApi.deleteAdminMilestone(adminKey, id);
      notifySuccess('Milestone deleted!');
      loadAllData(adminKey);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete milestone');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Review Claim (Approve, Reject, Freeze)
  const handleReviewClaim = async (id: string, action: 'approve' | 'reject' | 'freeze') => {
    let rejectionReason: string | undefined;
    if (action === 'reject') {
      const reason = prompt('Please specify rejection reason for the user:');
      if (reason === null) return;
      rejectionReason = reason;
    }

    try {
      setIsLoading(true);
      await swapCampaignApi.reviewAdminClaim(adminKey, id, { action, rejectionReason });
      notifySuccess(`Claim marked as ${action}d!`);
      loadAllData(adminKey);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to review claim');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Submit Paid Claim Modal
  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingClaim) return;
    if (!payoutTxHash || !payoutTxHash.startsWith('0x') || payoutTxHash.length < 30) {
      alert('Please provide a valid on-chain transaction hash (0x...)');
      return;
    }

    try {
      setIsLoading(true);
      await swapCampaignApi.payAdminClaim(adminKey, payingClaim.id, {
        payoutNetwork,
        payoutToken,
        payoutTxHash: payoutTxHash.trim(),
        notes: payoutNotes,
      });

      setPayingClaim(null);
      setPayoutTxHash('');
      setPayoutNotes('');
      notifySuccess('Payout recorded and user claim updated to Paid!');
      loadAllData(adminKey);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record payout');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Toggle User Flag
  const handleToggleUserFlag = async (user: any) => {
    const isFlagged = !user.is_flagged;
    let reason = user.flag_reason || '';
    if (isFlagged) {
      const input = prompt('Specify flag reason (e.g. Circular wash trading, Sybil farm):', 'Suspicious activity');
      if (input === null) return;
      reason = input;
    }

    try {
      setIsLoading(true);
      await swapCampaignApi.flagAdminUser(adminKey, user.id, isFlagged, reason);
      notifySuccess(isFlagged ? 'Wallet flagged!' : 'Wallet unflagged!');
      loadAllData(adminKey);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to flag user');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. CSV Export
  const handleExportCSV = (type: 'users' | 'transactions' | 'claims' | 'referrals') => {
    const url = swapCampaignApi.getExportUrl(adminKey, type);
    fetch(url, { headers: { 'x-admin-key': adminKey } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `nova_swap_${type}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert('Export failed: ' + err.message));
  };

  // If not authenticated, render Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-bold text-center text-white">Nova Swap Admin</h2>
          <p className="text-xs text-slate-400 text-center mt-1 mb-6">
            Genesis Campaign & Reward Management System
          </p>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
              {errorMessage}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin(adminKey);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Passkey / API Secret
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter SWAP_ADMIN_KEY..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-primary"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark font-semibold text-sm transition-all shadow-lg shadow-primary/30 cursor-pointer"
            >
              {isLoading ? 'Verifying...' : 'Access Swap Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { analytics, campaign } = overviewData || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-2xl">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-800/60">
                  Nova Swap Engine
                </span>
                <span className="text-xs text-slate-400">v1.0 Genesis</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Swap Campaign Administration
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => loadAllData(adminKey)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
          {[
            { id: 'analytics', label: 'Analytics & Overview', icon: BarChart3 },
            { id: 'claims', label: 'Reward Claims', icon: Gift, count: analytics?.pendingClaims },
            { id: 'campaign', label: 'Campaign Settings & Milestones', icon: Settings },
            { id: 'affiliates', label: 'Partners & BDMs', icon: Users },
            { id: 'fraud', label: 'Users & Sybil Review', icon: ShieldAlert },
            { id: 'logs', label: 'Audit Logs & CSV Export', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: ANALYTICS OVERVIEW */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Swap Volume</span>
                <div className="text-2xl font-extrabold text-white mt-1">
                  ${analytics?.totalVerifiedVolumeUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">Verified on 6 EVM networks</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connected Wallets</span>
                <div className="text-2xl font-extrabold text-white mt-1">
                  {analytics?.connectedWallets || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Repeat Swappers: {analytics?.repeatSwappers || 0}</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified Swaps</span>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {analytics?.successfulSwaps || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Initiated: {analytics?.swapsInitiated || 0}</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Remaining Budget</span>
                <div className="text-2xl font-extrabold text-purple-400 mt-1">
                  ${analytics?.remainingBudgetUSD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '10,000.00'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Total: ${analytics?.totalBudgetUSD?.toLocaleString()}</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Claims</span>
                <div className="text-2xl font-extrabold text-amber-400 mt-1">
                  {analytics?.pendingClaims || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Awaiting manual approval</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid Rewards</span>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                  ${analytics?.totalPaidAmountUSD?.toFixed(2) || '0.00'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{analytics?.paidClaims || 0} claims completed</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Referral Conversions</span>
                <div className="text-2xl font-extrabold text-blue-400 mt-1">
                  {analytics?.qualifiedReferrals || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Visits: {analytics?.referralVisits || 0}</div>
              </div>

              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Page Impressions</span>
                <div className="text-2xl font-extrabold text-white mt-1">
                  {analytics?.pageViews || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Unique: {analytics?.uniqueVisitors || 0}</div>
              </div>
            </div>

            {/* Campaign Summary Card */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
              <h3 className="text-base font-bold text-white mb-2">Campaign Status & Guidelines</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Nova Swap rewards are non-custodial and verified against genuine on-chain execution via LI.FI status API. Payouts are manually approved and signed on-chain to ensure zero automated exploit exposure.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Status: {campaign?.status?.toUpperCase()}
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Cashback: {campaign?.cashback_enabled ? 'ENABLED' : 'DISABLED (Default)'}
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  Min Swap: ${campaign?.min_swap_usd} USD
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Referral: ${campaign?.referral_reward_usd} on ${campaign?.referral_qualifying_vol_usd} vol
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REWARD CLAIMS */}
        {activeTab === 'claims' && (
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search size={16} className="text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by wallet address..."
                  value={claimSearch}
                  onChange={(e) => setClaimSearch(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full sm:w-64"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-slate-400">Status:</span>
                <select
                  value={claimStatusFilter}
                  onChange={(e) => setClaimStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>
            </div>

            {/* Claims Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Claim Date</th>
                      <th className="py-3 px-4">User Wallet</th>
                      <th className="py-3 px-4">Reward Type / Milestone</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Payout Details</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {claims
                      .filter((c) => (claimStatusFilter === 'all' ? true : c.status === claimStatusFilter))
                      .filter((c) =>
                        claimSearch
                          ? c.wallet_address.toLowerCase().includes(claimSearch.toLowerCase()) ||
                            c.payout_address.toLowerCase().includes(claimSearch.toLowerCase())
                          : true
                      )
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 text-slate-400 font-sans">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-white font-bold">{c.wallet_address.slice(0, 6)}...{c.wallet_address.slice(-4)}</span>
                            <div className="text-[10px] text-slate-400 font-sans">Vol: ${c.total_volume_usd.toFixed(2)}</div>
                          </td>
                          <td className="py-3.5 px-4 font-sans text-slate-300">
                            {c.milestone_title || c.reward_type}
                          </td>
                          <td className="py-3.5 px-4 text-emerald-400 font-bold">
                            ${c.requested_amount_usd.toFixed(2)} USD
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <div className="text-white font-mono text-[11px] truncate max-w-[150px]" title={c.payout_address}>
                              {c.payout_address.slice(0, 6)}...{c.payout_address.slice(-4)}
                            </div>
                            <div className="text-[10px] text-purple-300">
                              {c.preferred_network} • {c.preferred_token}
                            </div>
                            {c.payout_tx_hash && (
                              <a
                                href={`https://bscscan.com/tx/${c.payout_tx_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                              >
                                <span>Tx: {c.payout_tx_hash.slice(0, 8)}...</span>
                                <ExternalLink size={9} />
                              </a>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                c.status === 'paid'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : c.status === 'approved'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : c.status === 'rejected'
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                  : c.status === 'frozen'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {c.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleReviewClaim(c.id, 'approve')}
                                    className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 cursor-pointer"
                                    title="Approve Claim"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleReviewClaim(c.id, 'reject')}
                                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 cursor-pointer"
                                    title="Reject Claim"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </>
                              )}

                              {c.status === 'approved' && (
                                <button
                                  onClick={() => {
                                    setPayingClaim(c);
                                    setPayoutNetwork(c.preferred_network || 'BNB Smart Chain');
                                    setPayoutToken(c.preferred_token || 'USDT');
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-[11px] shadow-sm hover:opacity-90 cursor-pointer"
                                >
                                  Mark as Paid
                                </button>
                              )}

                              {c.status !== 'frozen' && c.status !== 'paid' && (
                                <button
                                  onClick={() => handleReviewClaim(c.id, 'freeze')}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-purple-950/40 text-slate-400 hover:text-purple-300 cursor-pointer"
                                  title="Freeze Claim"
                                >
                                  <AlertTriangle size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    {claims.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                          No reward requests currently recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAMPAIGN SETTINGS & MILESTONES */}
        {activeTab === 'campaign' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: General Settings (7 cols) */}
            <div className="lg:col-span-7 rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4">Edit Campaign Parameters</h3>
              {campaignForm && (
                <form onSubmit={handleSaveCampaignSettings} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Campaign Title</label>
                    <input
                      type="text"
                      value={campaignForm.title}
                      onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Description / Tagline</label>
                    <input
                      type="text"
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Status</label>
                      <select
                        value={campaignForm.status}
                        onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="ended">Ended</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Total Reward Budget ($ USD)</label>
                      <input
                        type="number"
                        step="100"
                        value={campaignForm.totalBudgetUSD}
                        onChange={(e) => setCampaignForm({ ...campaignForm, totalBudgetUSD: parseFloat(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Min Eligible Swap ($ USD)</label>
                      <input
                        type="number"
                        step="1"
                        value={campaignForm.minSwapUSD}
                        onChange={(e) => setCampaignForm({ ...campaignForm, minSwapUSD: parseFloat(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Referral Bonus ($ USD)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={campaignForm.referralRewardUSD}
                        onChange={(e) => setCampaignForm({ ...campaignForm, referralRewardUSD: parseFloat(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Referral Qualifying Volume ($ USD)</label>
                    <input
                      type="number"
                      step="10"
                      value={campaignForm.referralQualifyingVolUSD}
                      onChange={(e) => setCampaignForm({ ...campaignForm, referralQualifyingVolUSD: parseFloat(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                      required
                    />
                  </div>

                  {/* Optional Cashback Toggle (Disabled by default) */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">Enable Optional Swap Cashback</div>
                      <div className="text-[11px] text-slate-400">Disabled by default. Separate from P2P fees.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={campaignForm.cashbackEnabled}
                      onChange={(e) => setCampaignForm({ ...campaignForm, cashbackEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-xs shadow-md shadow-primary/30 transition-all cursor-pointer"
                  >
                    Save Campaign Configuration
                  </button>
                </form>
              )}
            </div>

            {/* Right: Milestones Manager (5 cols) */}
            <div className="lg:col-span-5 rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white">Milestones</h3>
                  <button
                    onClick={() =>
                      setEditingMilestone({
                        milestoneNumber: (overviewData?.milestones?.length || 0) + 1,
                        title: `Milestone ${(overviewData?.milestones?.length || 0) + 1}`,
                        targetVolumeUSD: 1000,
                        rewardAmountUSD: 5,
                        rewardDescription: '$5.00 Bonus Reward on reaching $1,000 swap volume',
                        isActive: 1,
                        sortOrder: (overviewData?.milestones?.length || 0) + 1,
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-semibold cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Milestone</span>
                  </button>
                </div>

                {/* Milestones list */}
                <div className="space-y-3">
                  {overviewData?.milestones?.map((ms: any) => (
                    <div
                      key={ms.id}
                      className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="text-white font-bold">{ms.title}</div>
                        <div className="text-[11px] text-slate-400">
                          Target: ${ms.targetVolumeUSD?.toLocaleString()} • Reward: +${ms.rewardAmountUSD?.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingMilestone(ms)}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                          title="Edit"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(ms.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 text-red-300 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit/Add Milestone Modal Dialog */}
              {editingMilestone && (
                <div className="mt-4 p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30">
                  <h4 className="text-xs font-bold text-purple-200 mb-2">
                    {editingMilestone.id ? 'Edit Milestone' : 'New Milestone'}
                  </h4>
                  <form onSubmit={handleSaveMilestone} className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-slate-400 text-[10px]">Title</label>
                      <input
                        type="text"
                        value={editingMilestone.title}
                        onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 text-[10px]">Target Vol ($)</label>
                        <input
                          type="number"
                          value={editingMilestone.targetVolumeUSD}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, targetVolumeUSD: parseFloat(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-[10px]">Reward ($)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={editingMilestone.rewardAmountUSD}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, rewardAmountUSD: parseFloat(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px]">Description</label>
                      <input
                        type="text"
                        value={editingMilestone.rewardDescription}
                        onChange={(e) => setEditingMilestone({ ...editingMilestone, rewardDescription: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingMilestone(null)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 text-[11px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px]"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: USERS & SYBIL REVIEW */}
        {activeTab === 'fraud' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search size={16} className="text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user address or referral code..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full sm:w-64"
                />
              </div>
              <div className="text-xs text-slate-400">
                Total Tracked Wallets: <strong>{users.length}</strong>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Wallet Address</th>
                      <th className="py-3 px-4">Cumulative Volume</th>
                      <th className="py-3 px-4">Swaps Count</th>
                      <th className="py-3 px-4">Referral Code</th>
                      <th className="py-3 px-4">Referrals Made</th>
                      <th className="py-3 px-4">Anti-Sybil Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {users
                      .filter((u) =>
                        userSearch
                          ? u.wallet_address.toLowerCase().includes(userSearch.toLowerCase()) ||
                            u.referral_code.toLowerCase().includes(userSearch.toLowerCase())
                          : true
                      )
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 text-white font-bold">
                            {u.wallet_address.slice(0, 8)}...{u.wallet_address.slice(-6)}
                          </td>
                          <td className="py-3 px-4 text-emerald-400 font-bold">
                            ${u.total_volume_usd.toFixed(2)} USD
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300">
                            {u.eligible_swaps_count}
                          </td>
                          <td className="py-3 px-4 text-primary font-bold">
                            {u.referral_code}
                          </td>
                          <td className="py-3 px-4 font-sans text-slate-300">
                            {u.referrals_count}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            {u.is_flagged ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                                FLAGGED: {u.flag_reason || 'Sybil suspect'}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                Clean / Verified
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-sans">
                            <button
                              onClick={() => handleToggleUserFlag(u)}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                u.is_flagged
                                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                              }`}
                            >
                              {u.is_flagged ? 'Unflag Wallet' : 'Flag as Suspicious'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS & CSV EXPORT */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* CSV Export Bar */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <h3 className="text-base font-bold text-white mb-2">Export Campaign Records (CSV)</h3>
              <p className="text-xs text-slate-400 mb-4">
                Download timestamped audit data for financial reconciliation and compliance reporting.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => handleExportCSV('users')}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download size={14} className="text-primary" />
                  <span>Export Users CSV</span>
                </button>
                <button
                  onClick={() => handleExportCSV('transactions')}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download size={14} className="text-emerald-400" />
                  <span>Export Swaps CSV</span>
                </button>
                <button
                  onClick={() => handleExportCSV('claims')}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download size={14} className="text-purple-400" />
                  <span>Export Claims CSV</span>
                </button>
                <button
                  onClick={() => handleExportCSV('referrals')}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download size={14} className="text-blue-400" />
                  <span>Export Referrals CSV</span>
                </button>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-3">Admin Action Audit Trail</h3>
              <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex flex-col sm:flex-row justify-between gap-2">
                    <div>
                      <span className="text-primary font-bold">[{log.action}]</span>{' '}
                      <span className="text-slate-300 font-sans">{log.details}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 shrink-0 font-sans">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="text-slate-500 font-sans text-center py-6">No audit actions recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'affiliates' && (
          <AffiliateAdminPanel adminKey={adminKey} />
        )}
      </div>

      {/* CONFIRM PAYOUT MODAL DIALOG */}
      {payingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-white">
            <button
              onClick={() => setPayingClaim(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <XCircle size={18} />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Record On-Chain Reward Payout</h3>
            <p className="text-xs text-slate-400 mb-4">
              Payout for <strong className="text-white">{payingClaim.wallet_address.slice(0, 6)}...{payingClaim.wallet_address.slice(-4)}</strong> ({payingClaim.milestone_title || 'Reward'})
            </p>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-sm mb-4">
              Amount to Transfer: ${payingClaim.requested_amount_usd.toFixed(2)} USD
            </div>

            <form onSubmit={handleConfirmPayout} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Receiving Address</label>
                <input
                  type="text"
                  value={payingClaim.payout_address}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Payout Network</label>
                  <input
                    type="text"
                    value={payoutNetwork}
                    onChange={(e) => setPayoutNetwork(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Token Paid</label>
                  <input
                    type="text"
                    value={payoutToken}
                    onChange={(e) => setPayoutToken(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">On-Chain Transaction Hash (Required)</label>
                <input
                  type="text"
                  value={payoutTxHash}
                  onChange={(e) => setPayoutTxHash(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-[11px]"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Admin Notes (Optional)</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Sent via Binance treasury wallet"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingClaim(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  {isLoading ? 'Saving...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

