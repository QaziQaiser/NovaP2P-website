import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Mail,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { affiliateApi } from '../../services/affiliateApi';
import {
  buildDecisionMailtoLink,
} from '../../services/emailNotifications';

export const AffiliateReviewPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('id') || '';
  const token = searchParams.get('token') || '';
  const initialAction = searchParams.get('action') === 'reject' ? 'reject' : 'approve';

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject'>(initialAction);
  const [bdmWalletAddress, setBdmWalletAddress] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultNotice, setResultNotice] = useState<string | null>(null);
  const [fallbackMailto, setFallbackMailto] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Review Affiliate Application — Nova Swap Admin | NovaP2P';
    window.scrollTo(0, 0);

    if (!appId || !token) {
      setLoadError('Missing application ID or review security token in URL.');
      setLoading(false);
      return;
    }

    affiliateApi
      .getReviewInfo(appId, token)
      .then((res) => {
        setApplication(res.application);
        if (res.application?.bdm_wallet_address) {
          setBdmWalletAddress(res.application.bdm_wallet_address);
        }
        if (res.application?.admin_notes) {
          setRejectionReason(res.application.admin_notes);
        }
      })
      .catch((err: any) => {
        setLoadError(err.message || 'Invalid or expired application review link.');
      })
      .finally(() => setLoading(false));
  }, [appId, token]);

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application) return;

    if (selectedAction === 'reject' && !rejectionReason.trim()) {
      setSubmitError('Please write the rejection reason / query so the applicant receives an explanation.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      setFallbackMailto(null);

      const res = await affiliateApi.submitReviewAction({
        id: appId,
        token,
        action: selectedAction,
        assignRole: application.role,
        bdmWalletAddress:
          selectedAction === 'approve' && application.role === 'partner'
            ? bdmWalletAddress.trim() || undefined
            : undefined,
        adminNotes: selectedAction === 'reject' ? rejectionReason.trim() : undefined,
      });

      // The server emails the decision to the applicant from support@novap2p.com
      const emailSent = Boolean(res.applicantNotified);

      setApplication((prev: any) => ({
        ...prev,
        status: res.status,
        admin_notes: res.rejectionReason || prev?.admin_notes,
      }));

      if (emailSent) {
        setResultNotice(
          selectedAction === 'approve'
            ? `Approved! Dashboard unlocked for ${res.walletAddress} and confirmation email sent to ${res.applicantEmail}.`
            : `Rejected! Status updated and rejection reason email sent to ${res.applicantEmail}.`
        );
      } else {
        setResultNotice(
          selectedAction === 'approve'
            ? `Approved and dashboard unlocked for ${res.walletAddress}, but the automatic email could not be delivered. Use the button below to email the applicant directly.`
            : `Rejected in database, but the automatic email could not be delivered. Use the button below to send the rejection reason to the applicant.`
        );
        setFallbackMailto(
          buildDecisionMailtoLink({
            decision: selectedAction === 'approve' ? 'approved' : 'rejected',
            role: res.role,
            applicantEmail: res.applicantEmail,
            applicantName: res.applicantName,
            walletAddress: res.walletAddress,
            rejectionReason: selectedAction === 'reject' ? rejectionReason.trim() : null,
          })
        );
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save decision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07111e] text-slate-100 pt-28 pb-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/swap-admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300"
          >
            <ArrowLeft size={14} /> Open Full Admin Panel (/swap-admin)
          </Link>
          <span className="text-xs font-mono text-slate-500">Nova Swap Admin Review</span>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-[#0b192c] border border-slate-800 p-12 text-center">
            <Loader2 size={34} className="animate-spin text-teal-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300">Verifying review link and loading application...</p>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl bg-[#0b192c] border border-red-500/30 p-8 text-center">
            <AlertTriangle size={34} className="text-red-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white mb-2">Review Link Invalid</h1>
            <p className="text-sm text-slate-400 mb-6">{loadError}</p>
            <Link
              to="/swap-admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm"
            >
              Go to Admin Dashboard
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl bg-[#0b192c] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Top summary */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-bold uppercase mb-2">
                  <ShieldCheck size={14} />
                  {application.role === 'bdm' ? 'BDM Application' : 'Partner Application'}
                </div>
                <h1 className="text-2xl font-bold text-white">{application.full_name}</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Submitted {new Date(application.created_at).toLocaleString()}
                </p>
              </div>
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                  application.status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : application.status === 'rejected'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                Status: {application.status}
              </span>
            </div>

            {/* Applicant details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div>
                <div className="text-slate-400 mb-0.5">Email Address</div>
                <div className="font-semibold text-white">{application.email}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Telegram Username</div>
                <div className="font-semibold text-white">{application.telegram_username}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-slate-400 mb-0.5">Connected Wallet</div>
                <div className="font-mono text-teal-300 break-all">{application.wallet_address}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Twitter / X</div>
                <a
                  href={application.twitter_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:underline inline-flex items-center gap-1 break-all"
                >
                  {application.twitter_link} <ExternalLink size={11} />
                </a>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Telegram Channel / Group</div>
                <a
                  href={application.telegram_channel_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:underline inline-flex items-center gap-1 break-all"
                >
                  {application.telegram_channel_link} <ExternalLink size={11} />
                </a>
              </div>
              {application.youtube_link && (
                <div>
                  <div className="text-slate-400 mb-0.5">YouTube Channel</div>
                  <a
                    href={application.youtube_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-400 hover:underline inline-flex items-center gap-1 break-all"
                  >
                    {application.youtube_link} <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {application.audience_size && (
                <div>
                  <div className="text-slate-400 mb-0.5">Audience Size</div>
                  <div className="text-white">{application.audience_size}</div>
                </div>
              )}
              {application.marketing_experience && (
                <div>
                  <div className="text-slate-400 mb-0.5">Marketing Experience</div>
                  <div className="text-white">{application.marketing_experience}</div>
                </div>
              )}
              {application.manageable_partners_count && (
                <div>
                  <div className="text-slate-400 mb-0.5">Manageable Partners</div>
                  <div className="text-white">{application.manageable_partners_count}</div>
                </div>
              )}
              {application.message && (
                <div className="sm:col-span-2">
                  <div className="text-slate-400 mb-0.5">Applicant Message</div>
                  <div className="text-slate-200 whitespace-pre-wrap">{application.message}</div>
                </div>
              )}
            </div>

            {resultNotice && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs space-y-3">
                <div className="font-semibold">{resultNotice}</div>
                {fallbackMailto && (
                  <a
                    href={fallbackMailto}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                  >
                    <Mail size={14} /> Open Email App to Send to {application.email}
                  </a>
                )}
              </div>
            )}

            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                {submitError}
              </div>
            )}

            {/* Two Clear Action Toggle Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAction('approve');
                  setSubmitError(null);
                }}
                className={`py-3.5 px-4 rounded-2xl border font-bold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                  selectedAction === 'approve'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/50'
                }`}
              >
                <CheckCircle2 size={18} /> Approve Application
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAction('reject');
                  setSubmitError(null);
                }}
                className={`py-3.5 px-4 rounded-2xl border font-bold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                  selectedAction === 'reject'
                    ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-red-500/50'
                }`}
              >
                <XCircle size={18} /> Reject Application
              </button>
            </div>

            {/* Action Form */}
            <form onSubmit={handleConfirmDecision} className="space-y-4">
              {selectedAction === 'approve' ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                  <p className="text-xs text-emerald-200 leading-relaxed">
                    Approving will immediately activate <strong>{application.wallet_address}</strong> as an approved{' '}
                    <strong>{application.role === 'bdm' ? 'BDM' : 'Partner'}</strong>, unlock their live dashboard, and send a confirmation email to <strong>{application.email}</strong>.
                  </p>
                  {application.role === 'partner' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Optional Assigned BDM Wallet Address (Leave empty for direct Partner)
                      </label>
                      <input
                        type="text"
                        value={bdmWalletAddress}
                        onChange={(e) => setBdmWalletAddress(e.target.value)}
                        placeholder="0x... (optional)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none focus:border-teal-400"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-3">
                  <label className="block text-xs font-semibold text-red-200">
                    Rejection Reason / Query (Required — Sent to {application.email}) *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Submitted social links could not be verified or appear inactive.',
                      'Minimum active community audience requirement not yet met.',
                      'Please reply with proof of ownership for the submitted Telegram/YouTube channel.',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRejectionReason(preset)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer text-left"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain clearly why the application is being rejected or what information is needed..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-red-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                  selectedAction === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-red-500 hover:bg-red-400 text-white'
                }`}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {selectedAction === 'approve'
                  ? 'Confirm Approve & Send Confirmation Email'
                  : 'Confirm Reject & Send Reason Email'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

