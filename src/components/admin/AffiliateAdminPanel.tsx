import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, Users, DollarSign, ShieldCheck, Mail, X } from 'lucide-react';
import { affiliateApi } from '../../services/affiliateApi';
import { buildDecisionMailtoLink } from '../../services/emailNotifications';

interface AffiliateAdminPanelProps {
  adminKey: string;
}

export const AffiliateAdminPanel: React.FC<AffiliateAdminPanelProps> = ({ adminKey }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackMailto, setFallbackMailto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state for Approve (optional BDM mapping) & Reject (mandatory reason/query)
  const [reviewModal, setReviewModal] = useState<{ app: any; action: 'approve' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assignBdmWallet, setAssignBdmWallet] = useState('');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await affiliateApi.getAdminOverview(adminKey);
      setApplications(res.applications || []);
      setAffiliates(res.affiliates || []);
      setPayouts(res.payouts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load affiliate data');
    } finally {
      setIsLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openReviewModal = (app: any, action: 'approve' | 'reject') => {
    setError(null);
    setFallbackMailto(null);
    setRejectReason(app.admin_notes || '');
    setAssignBdmWallet(app.bdm_wallet_address || '');
    setReviewModal({ app, action });
  };

  const submitReviewModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal) return;

    const { app, action } = reviewModal;
    if (action === 'reject' && !rejectReason.trim()) {
      setError('Please enter a rejection reason / query so the applicant knows why their application was rejected.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setFallbackMailto(null);

      const res = await affiliateApi.reviewApplication(adminKey, app.id, {
        action,
        assignRole: app.role,
        bdmWalletAddress: action === 'approve' && app.role === 'partner' ? assignBdmWallet.trim() || undefined : undefined,
        adminNotes: action === 'reject' ? rejectReason.trim() : undefined,
      });

      // The server automatically emails the confirmation / rejection to the applicant
      if (res.applicantNotified) {
        setNotice(
          action === 'approve'
            ? `Application approved, dashboard activated, and confirmation email sent to ${app.email}.`
            : `Application rejected and rejection reason email sent to ${app.email}.`
        );
      } else {
        setNotice(
          `Application ${action === 'approve' ? 'approved (dashboard active)' : 'rejected'} in DB, but the automatic email to ${app.email} could not be delivered. Use the button below to email the applicant.`
        );
        setFallbackMailto(
          buildDecisionMailtoLink({
            decision: action === 'approve' ? 'approved' : 'rejected',
            role: res.role || app.role,
            applicantEmail: res.applicantEmail || app.email,
            applicantName: res.applicantName || app.full_name,
            walletAddress: res.walletAddress || app.wallet_address,
            rejectionReason: action === 'reject' ? rejectReason.trim() : null,
          })
        );
      }

      setReviewModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAffiliateStatus = async (walletAddress: string, status: 'active' | 'pending_activation' | 'inactive') => {
    try {
      setIsLoading(true);
      await affiliateApi.updateAffiliate(adminKey, walletAddress, { status });
      setNotice(`Affiliate ${walletAddress} status updated to ${status}.`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayPayout = async (payout: any) => {
    const txHash = prompt(`Enter transaction hash for $${payout.amount_usd.toFixed(2)} payout to ${payout.payout_address}:`);
    if (!txHash) return;

    try {
      setIsLoading(true);
      await affiliateApi.payPayout(adminKey, payout.id, { txHash: txHash.trim() });
      setNotice(`Payout ${payout.id} marked as Paid.`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const bdmList = affiliates.filter((a) => a.role === 'bdm');

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex flex-wrap items-center justify-between gap-2">
          <span>{notice}</span>
          {fallbackMailto && (
            <a
              href={fallbackMailto}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              <Mail size={12} /> Send via Email Client
            </a>
          )}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium">
          {error}
        </div>
      )}

      {/* 1. Partner & BDM Applications */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-400" />
            Partner &amp; BDM Applications ({applications.length})
          </h3>
          {isLoading && <Loader2 size={16} className="animate-spin text-teal-400" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Applicant &amp; Socials</th>
                <th className="py-2.5 px-3">Wallet Address</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No Partner or BDM applications yet.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                          app.role === 'bdm'
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {app.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{app.full_name}</div>
                      <div className="text-slate-400">{app.email} • {app.telegram_username}</div>
                      <div className="flex gap-2 mt-1 text-[10px] text-teal-400">
                        <a href={app.twitter_link} target="_blank" rel="noreferrer" className="underline">X/Twitter</a>
                        {app.youtube_link && (
                          <a href={app.youtube_link} target="_blank" rel="noreferrer" className="underline">YouTube</a>
                        )}
                        <a href={app.telegram_channel_link} target="_blank" rel="noreferrer" className="underline">Telegram</a>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{app.wallet_address}</td>
                    <td className="py-3 px-3 text-slate-400 max-w-xs">
                      {app.role === 'partner' ? (
                        <span>Audience: {app.audience_size}</span>
                      ) : (
                        <span>Manage: {app.manageable_partners_count} | Exp: {app.marketing_experience}</span>
                      )}
                      {app.message && <div className="text-[11px] text-slate-500 truncate">{app.message}</div>}
                    </td>
                    <td className="py-3 px-3 capitalize font-semibold text-slate-200">
                      <span
                        className={
                          app.status === 'approved'
                            ? 'text-emerald-400'
                            : app.status === 'rejected'
                            ? 'text-red-400'
                            : 'text-amber-300'
                        }
                      >
                        {app.status}
                      </span>
                      {app.status === 'rejected' && app.admin_notes && (
                        <div className="text-[11px] font-normal text-red-300/90 mt-0.5 max-w-[200px] whitespace-normal">
                          Reason: {app.admin_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {app.status === 'pending' && (
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => openReviewModal(app, 'approve')}
                            className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => openReviewModal(app, 'reject')}
                            className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Approved Partners & BDMs */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Users size={18} className="text-teal-400" />
          Approved Affiliates ({affiliates.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Wallet</th>
                <th className="py-2.5 px-3">Assigned BDM</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">Earnings (Pending)</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No approved Partners or BDMs yet.
                  </td>
                </tr>
              ) : (
                affiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 uppercase font-bold text-teal-400">{aff.role}</td>
                    <td className="py-3 px-3 font-mono text-slate-200">
                      {aff.wallet_address}
                      <div className="text-slate-400 font-sans">{aff.full_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      {aff.role === 'partner' ? (
                        <select
                          value={aff.bdm_wallet_address || ''}
                          onChange={async (e) => {
                            await affiliateApi.updateAffiliate(adminKey, aff.wallet_address, {
                              bdmWalletAddress: e.target.value || null,
                            });
                            loadData();
                          }}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        >
                          <option value="">None (Direct Partner)</option>
                          {bdmList.map((b) => (
                            <option key={b.id} value={b.wallet_address}>
                              {b.full_name || b.wallet_address.slice(0, 10)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">${(aff.total_referred_volume_usd || 0).toFixed(2)}</td>
                    <td className="py-3 px-3 text-teal-300">
                      ${(aff.total_earnings_usd || 0).toFixed(4)} (${(aff.pending_balance_usd || 0).toFixed(2)} pending)
                    </td>
                    <td className="py-3 px-3 text-right">
                      <select
                        value={aff.status}
                        onChange={(e) => handleUpdateAffiliateStatus(aff.wallet_address, e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
                      >
                        <option value="active">Active</option>
                        <option value="pending_activation">Pending Activation</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Affiliate Payout Requests */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-teal-400" />
          Affiliate Payout Requests ({payouts.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Affiliate Wallet</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Destination &amp; Network</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No affiliate payout requests yet.
                  </td>
                </tr>
              ) : (
                payouts.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400">{new Date(pay.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-200">
                      {pay.affiliate_wallet_address} ({pay.affiliate_role})
                    </td>
                    <td className="py-3 px-3 font-bold text-teal-400">${pay.amount_usd.toFixed(2)} {pay.preferred_token}</td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {pay.payout_address} <span className="font-sans text-slate-400">({pay.preferred_network})</span>
                    </td>
                    <td className="py-3 px-3 capitalize font-semibold">{pay.status}</td>
                    <td className="py-3 px-3 text-right">
                      {pay.status === 'pending' && (
                        <button
                          onClick={() => handlePayPayout(pay)}
                          className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Approve / Reject Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                {reviewModal.action === 'approve' ? (
                  <CheckCircle size={18} className="text-emerald-400" />
                ) : (
                  <XCircle size={18} className="text-red-400" />
                )}
                {reviewModal.action === 'approve' ? 'Approve Application' : 'Reject Application'}
              </h4>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700 rounded-xl p-3 mb-4 space-y-1">
              <div><strong>Applicant:</strong> {reviewModal.app.full_name} ({reviewModal.app.email})</div>
              <div><strong>Role:</strong> {reviewModal.app.role?.toUpperCase()}</div>
              <div className="font-mono break-all"><strong>Wallet:</strong> {reviewModal.app.wallet_address}</div>
            </div>

            <form onSubmit={submitReviewModal} className="space-y-4">
              {reviewModal.action === 'approve' && reviewModal.app.role === 'partner' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Assigned BDM Wallet Address (Optional — leave empty for direct Partner)
                  </label>
                  <input
                    type="text"
                    value={assignBdmWallet}
                    onChange={(e) => setAssignBdmWallet(e.target.value)}
                    placeholder="0x... BDM wallet or select below"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-teal-500"
                  />
                  {bdmList.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bdmList.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setAssignBdmWallet(b.wallet_address)}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 cursor-pointer"
                        >
                          {b.full_name} ({b.wallet_address.slice(0, 6)}...)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {reviewModal.action === 'reject' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Rejection Reason / Query (Sent directly to applicant) *
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'Social channel links could not be verified or appear inactive.',
                      'Minimum active community engagement requirement not yet met.',
                      'Provided Telegram / X profile does not match ownership of the submitted channels.',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRejectReason(preset)}
                        className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-left cursor-pointer"
                      >
                        + {preset.slice(0, 46)}...
                      </button>
                    ))}
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain clearly why the application is rejected or what needs to be updated to re-apply..."
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-red-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    reviewModal.action === 'approve'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-red-500 hover:bg-red-400 text-white'
                  }`}
                >
                  {isLoading && <Loader2 size={13} className="animate-spin" />}
                  {reviewModal.action === 'approve'
                    ? 'Approve & Send Confirmation Email'
                    : 'Reject & Send Reason Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

