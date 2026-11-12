import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Wallet, Loader2 } from 'lucide-react';
import { affiliateApi } from '../../services/affiliateApi';
import { sendAdminAffiliateApplicationEmail } from '../../services/emailNotifications';

interface BdmApplicationFormProps {
  walletAddress: string;
  onSubmitted: () => void;
}

export const BdmApplicationForm: React.FC<BdmApplicationFormProps> = ({
  walletAddress,
  onSubmitted,
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    telegramUsername: '',
    twitterLink: '',
    youtubeLink: '',
    telegramChannelLink: '',
    marketingExperience: '',
    manageablePartnersCount: '',
    message: '',
  });
  const [walletConfirmed, setWalletConfirmed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConfirmed) {
      setError('Please confirm your connected wallet address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setEmailWarning(null);

    try {
      const res = await affiliateApi.submitApplication({
        role: 'bdm',
        walletAddress,
        fullName: formData.fullName,
        email: formData.email,
        telegramUsername: formData.telegramUsername,
        twitterLink: formData.twitterLink,
        youtubeLink: formData.youtubeLink || undefined,
        telegramChannelLink: formData.telegramChannelLink,
        marketingExperience: formData.marketingExperience,
        manageablePartnersCount: formData.manageablePartnersCount,
        message: formData.message,
      });

      // Send admin email notification with direct signed Approve/Reject action links
      const emailResult = await sendAdminAffiliateApplicationEmail({
        applicationId: res.applicationId,
        reviewToken: res.reviewToken,
        role: 'bdm',
        walletAddress,
        fullName: formData.fullName,
        email: formData.email,
        telegramUsername: formData.telegramUsername,
        twitterLink: formData.twitterLink,
        youtubeLink: formData.youtubeLink || undefined,
        telegramChannelLink: formData.telegramChannelLink,
        marketingExperience: formData.marketingExperience,
        manageablePartnersCount: formData.manageablePartnersCount,
        message: formData.message,
      });

      if (!emailResult.sent) {
        setEmailWarning(
          `Your application is saved in our review queue, though email delivery reported: ${emailResult.error || 'Email service unavailable'}`
        );
      }

      setSubmitted(true);
      onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit BDM application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white border border-teal-200 rounded-3xl p-8 md:p-10 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">BDM Application Submitted!</h3>
        <p className="text-gray-600 max-w-md mx-auto mb-4">
          Thank you for applying as a Business Development Manager (BDM). Our leadership team will review your profile and approve your wallet within 24 hours.
        </p>
        <div className="inline-block bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-mono text-gray-700 break-all max-w-full">
          Wallet: {walletAddress}
        </div>
        {emailWarning && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-4 max-w-md mx-auto">
            {emailWarning}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl shadow-gray-200/50 space-y-6">
      <div className="border-b border-gray-100 pb-5">
        <h2 className="text-2xl font-bold text-gray-900">Business Development Manager (BDM) Application</h2>
        <p className="text-sm text-gray-500 mt-1">
          Onboard &amp; manage Nova Swap Partners and earn a 10% override fee on all partner volume, plus 20% on direct referrals.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2.5 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Auto-filled Wallet Address */}
      <div className="bg-teal-50/70 border border-teal-100 rounded-2xl p-4">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Connected Wallet Address (Auto-filled)
        </label>
        <div className="flex items-center gap-2.5 bg-white border border-teal-200 rounded-xl px-4 py-2.5">
          <Wallet size={18} className="text-teal-600 shrink-0" />
          <input
            type="text"
            readOnly
            value={walletAddress}
            className="w-full text-sm font-mono text-gray-800 bg-transparent outline-none"
          />
        </div>
        <label className="flex items-center gap-2 mt-2.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={walletConfirmed}
            onChange={(e) => setWalletConfirmed(e.target.checked)}
            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          <span>I confirm this is my official BDM wallet address for dashboard access &amp; override payouts.</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Alex Morgan"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Telegram Username *</label>
          <input
            type="text"
            required
            value={formData.telegramUsername}
            onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
            placeholder="@username"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">How many partners can you manage? *</label>
          <select
            required
            value={formData.manageablePartnersCount}
            onChange={(e) => setFormData({ ...formData, manageablePartnersCount: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm bg-white"
          >
            <option value="">Select partner capacity</option>
            <option value="5 - 15 Partners">5 - 15 Partners</option>
            <option value="15 - 30 Partners">15 - 30 Partners</option>
            <option value="30 - 50 Partners">30 - 50 Partners</option>
            <option value="50+ Partners">50+ Partners</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Twitter / X Profile Link *</label>
          <input
            type="url"
            required
            value={formData.twitterLink}
            onChange={(e) => setFormData({ ...formData, twitterLink: e.target.value })}
            placeholder="https://x.com/yourhandle"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">YouTube Channel Link (Optional)</label>
          <input
            type="url"
            value={formData.youtubeLink}
            onChange={(e) => setFormData({ ...formData, youtubeLink: e.target.value })}
            placeholder="https://youtube.com/@yourchannel (optional)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Telegram Channel / Group Link *</label>
        <input
          type="url"
          required
          value={formData.telegramChannelLink}
          onChange={(e) => setFormData({ ...formData, telegramChannelLink: e.target.value })}
          placeholder="https://t.me/yournetwork"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Experience in Crypto / Affiliate Marketing *</label>
        <textarea
          rows={2}
          required
          value={formData.marketingExperience}
          onChange={(e) => setFormData({ ...formData, marketingExperience: e.target.value })}
          placeholder="Briefly describe your Web3 BD, KOL network, or affiliate management background..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Message</label>
        <textarea
          rows={3}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Share your strategy for onboarding active trading partners to Nova Swap..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base transition-all shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Submitting Application...
          </>
        ) : (
          <>
            <Send size={18} />
            Submit BDM Application
          </>
        )}
      </button>
    </form>
  );
};

