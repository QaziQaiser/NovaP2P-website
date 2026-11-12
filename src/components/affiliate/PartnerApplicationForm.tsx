import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { Send, CheckCircle2, AlertCircle, Wallet, Loader2 } from 'lucide-react';
import { affiliateApi } from '../../services/affiliateApi';

interface PartnerApplicationFormProps {
  walletAddress: string;
  onSubmitted: () => void;
}

export const PartnerApplicationForm: React.FC<PartnerApplicationFormProps> = ({
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
    audienceSize: '',
    message: '',
  });
  const [walletConfirmed, setWalletConfirmed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConfirmed) {
      setError('Please confirm your connected wallet address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await affiliateApi.submitApplication({
        role: 'partner',
        walletAddress,
        fullName: formData.fullName,
        email: formData.email,
        telegramUsername: formData.telegramUsername,
        twitterLink: formData.twitterLink,
        youtubeLink: formData.youtubeLink,
        telegramChannelLink: formData.telegramChannelLink,
        audienceSize: formData.audienceSize,
        message: formData.message,
      });

      // Send admin email notification via EmailJS (non-blocking)
      try {
        const appEnv = (import.meta as any).env || {};
        const serviceId = appEnv.VITE_EMAILJS_SERVICE_ID || 'service_vdt1rat';
        const templateId = appEnv.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp';
        const publicKey = appEnv.VITE_EMAILJS_PUBLIC_KEY || '8J3X62oVWT-2HXcvw';

        await emailjs.send(
          serviceId,
          templateId,
          {
            from_name: formData.fullName,
            from_email: formData.email,
            subject: `New Partner Program Application — ${formData.fullName}`,
            form_source: 'Nova Swap Partner Application',
            message: [
              `Role: Partner`,
              `Wallet Address: ${walletAddress}`,
              `Full Name: ${formData.fullName}`,
              `Email: ${formData.email}`,
              `Telegram Username: ${formData.telegramUsername}`,
              `Twitter / X: ${formData.twitterLink}`,
              `YouTube Channel: ${formData.youtubeLink}`,
              `Telegram Channel/Group: ${formData.telegramChannelLink}`,
              `Estimated Audience Size: ${formData.audienceSize}`,
              `Message: ${formData.message}`,
            ].join('\n'),
          },
          publicKey
        );
      } catch (emailErr) {
        console.warn('EmailJS notification failed (application saved in DB):', emailErr);
      }

      setSubmitted(true);
      onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit Partner application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white border border-green-200 rounded-3xl p-8 md:p-10 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
        <p className="text-gray-600 max-w-md mx-auto mb-4">
          Thank you for applying to the Nova Swap Partner Program. Our team will review your channels and approve your wallet within 24 hours.
        </p>
        <div className="inline-block bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-mono text-gray-700">
          Wallet: {walletAddress}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl shadow-gray-200/50 space-y-6">
      <div className="border-b border-gray-100 pb-5">
        <h2 className="text-2xl font-bold text-gray-900">Partner Program Application</h2>
        <p className="text-sm text-gray-500 mt-1">
          Submit your community details below. Once approved, connecting your wallet unlocks the Partner Dashboard.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2.5 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Auto-filled Wallet Address */}
      <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Connected Wallet Address (Auto-filled)
        </label>
        <div className="flex items-center gap-2.5 bg-white border border-blue-200 rounded-xl px-4 py-2.5">
          <Wallet size={18} className="text-primary shrink-0" />
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
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span>I confirm this is my official Partner wallet address for payouts &amp; dashboard access.</span>
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
            placeholder="John Doe"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
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
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
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
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Audience Size *</label>
          <select
            required
            value={formData.audienceSize}
            onChange={(e) => setFormData({ ...formData, audienceSize: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm bg-white"
          >
            <option value="">Select audience size</option>
            <option value="1,000 - 5,000">1,000 - 5,000</option>
            <option value="5,000 - 25,000">5,000 - 25,000</option>
            <option value="25,000 - 100,000">25,000 - 100,000</option>
            <option value="100,000+">100,000+</option>
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
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">YouTube Channel Link *</label>
          <input
            type="url"
            required
            value={formData.youtubeLink}
            onChange={(e) => setFormData({ ...formData, youtubeLink: e.target.value })}
            placeholder="https://youtube.com/@yourchannel"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
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
          placeholder="https://t.me/yourcommunity"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Message</label>
        <textarea
          rows={3}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Tell us about your community and how you plan to promote Nova Swap..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-base transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Submitting Application...
          </>
        ) : (
          <>
            <Send size={18} />
            Submit Partner Application
          </>
        )}
      </button>
    </form>
  );
};
