import emailjs from '@emailjs/browser';

export interface EmailSendResult {
  sent: boolean;
  error?: string;
}

function getEmailJsConfig() {
  const env = (import.meta as any).env || {};
  return {
    serviceId: env.VITE_EMAILJS_SERVICE_ID || 'service_vdt1rat',
    templateId: env.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp',
    decisionTemplateId: env.VITE_EMAILJS_DECISION_TEMPLATE_ID || env.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp',
    publicKey: env.VITE_EMAILJS_PUBLIC_KEY || '8J3X62oVWT-2HXcvw',
    adminEmail: env.VITE_ADMIN_NOTIFICATION_EMAIL || 'support@novap2p.com',
  };
}

function getSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://novap2p.com';
}

export async function sendAdminAffiliateApplicationEmail(params: {
  applicationId: string;
  reviewToken: string;
  role: 'partner' | 'bdm';
  walletAddress: string;
  fullName: string;
  email: string;
  telegramUsername: string;
  twitterLink: string;
  youtubeLink?: string;
  telegramChannelLink: string;
  audienceSize?: string;
  marketingExperience?: string;
  manageablePartnersCount?: string;
  message?: string;
}): Promise<EmailSendResult> {
  const { serviceId, templateId, publicKey, adminEmail } = getEmailJsConfig();
  const origin = getSiteOrigin();
  const baseReviewUrl = `${origin}/affiliate-review?id=${encodeURIComponent(params.applicationId)}&token=${encodeURIComponent(params.reviewToken)}`;
  const approveUrl = `${baseReviewUrl}&action=approve`;
  const rejectUrl = `${baseReviewUrl}&action=reject`;
  const roleLabel = params.role === 'bdm' ? 'Business Development Manager (BDM)' : 'Partner';

  const detailsLines = [
    `NEW NOVA SWAP ${roleLabel.toUpperCase()} APPLICATION`,
    `==================================================`,
    `Application ID: ${params.applicationId}`,
    `Role: ${roleLabel}`,
    `Wallet Address: ${params.walletAddress}`,
    `Full Name: ${params.fullName}`,
    `Email: ${params.email}`,
    `Telegram: ${params.telegramUsername}`,
    `Twitter / X: ${params.twitterLink}`,
    params.youtubeLink ? `YouTube: ${params.youtubeLink}` : null,
    `Telegram Channel / Group: ${params.telegramChannelLink}`,
    params.audienceSize ? `Estimated Audience Size: ${params.audienceSize}` : null,
    params.marketingExperience ? `Marketing Experience: ${params.marketingExperience}` : null,
    params.manageablePartnersCount ? `Manageable Partners: ${params.manageablePartnersCount}` : null,
    params.message ? `Applicant Message: ${params.message}` : null,
    ``,
    `QUICK ADMIN ACTIONS (CLICK ONE BELOW):`,
    `--------------------------------------------------`,
    `[ APPROVE APPLICATION & ACTIVATE DASHBOARD ]:`,
    approveUrl,
    ``,
    `[ REJECT APPLICATION & SEND REASON QUERY ]:`,
    rejectUrl,
    `--------------------------------------------------`,
    `You can also review inside /swap-admin -> Partners & BDMs.`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        // Populate both template parameter conventions used across NovaP2P templates
        name: params.fullName,
        email: params.email,
        number: params.telegramUsername,
        from_name: params.fullName,
        from_email: params.email,
        reply_to: params.email,
        to_email: adminEmail,
        to_name: 'Nova Swap Admin',
        subject: `New ${params.role === 'bdm' ? 'BDM' : 'Partner'} Application — ${params.fullName}`,
        form_source: `Nova Swap ${params.role === 'bdm' ? 'BDM' : 'Partner'} Application`,
        approve_url: approveUrl,
        reject_url: rejectUrl,
        message: detailsLines,
      },
      publicKey
    );
    return { sent: true };
  } catch (err: any) {
    const errMsg = err?.text || err?.message || 'EmailJS failed to send notification';
    console.warn('Admin application EmailJS send error:', errMsg);
    return { sent: false, error: String(errMsg) };
  }
}

export async function sendApplicantDecisionEmail(params: {
  decision: 'approved' | 'rejected';
  role: 'partner' | 'bdm';
  applicantEmail: string;
  applicantName: string;
  walletAddress: string;
  rejectionReason?: string | null;
}): Promise<EmailSendResult> {
  const { serviceId, decisionTemplateId, publicKey, adminEmail } = getEmailJsConfig();
  const origin = getSiteOrigin();
  const roleTitle = params.role === 'bdm' ? 'Business Development Manager (BDM)' : 'Partner';
  const dashboardPath = params.role === 'bdm' ? '/bdm-dashboard' : '/partner-dashboard';
  const applyPath = params.role === 'bdm' ? '/become-bdm' : '/become-partner';
  const dashboardUrl = `${origin}${dashboardPath}`;
  const applyUrl = `${origin}${applyPath}`;
  const referralLink = `${origin}/swap?ref=${params.walletAddress}`;

  const subject =
    params.decision === 'approved'
      ? `Approved: Your Nova Swap ${roleTitle} Dashboard is Now Active!`
      : `Update on Your Nova Swap ${roleTitle} Application`;

  const message =
    params.decision === 'approved'
      ? [
          `Hello ${params.applicantName || 'Creator'},`,
          ``,
          `Congratulations! Your Nova Swap ${roleTitle} application has been APPROVED and your dashboard is now active.`,
          ``,
          `Registered Wallet: ${params.walletAddress}`,
          `Your Dashboard Link: ${dashboardUrl}`,
          `Your Unique Referral Link: ${referralLink}`,
          ``,
          params.role === 'bdm'
            ? `Commission Tier: 10% BDM Override on your managed Partners' volume + 20% Commission on your direct referrals.`
            : `Commission Tier: 20% of the 0.5% platform trading fee (0.1% of referred swap volume) for life.`,
          ``,
          `Next Step: Visit ${dashboardUrl} and connect your registered wallet (${params.walletAddress}) to access live stats and request payouts.`,
          ``,
          `Welcome to Nova Swap!`,
          `Nova Swap Affiliate Team`,
        ].join('\n')
      : [
          `Hello ${params.applicantName || 'Applicant'},`,
          ``,
          `Thank you for applying to the Nova Swap ${roleTitle} Program (${params.walletAddress}).`,
          ``,
          `After reviewing your application, we are unable to approve it at this time for the following reason / query:`,
          `--------------------------------------------------`,
          `${params.rejectionReason || 'Your channels or verification requirements did not meet current criteria.'}`,
          `--------------------------------------------------`,
          ``,
          `You can address the query above and re-submit your updated application anytime at:`,
          applyUrl,
          ``,
          `If you have questions, simply reply to this email or contact ${adminEmail}.`,
          ``,
          `Best regards,`,
          `Nova Swap Affiliate Team`,
        ].join('\n');

  try {
    await emailjs.send(
      serviceId,
      decisionTemplateId,
      {
        name: 'Nova Swap Affiliate Team',
        email: params.applicantEmail,
        number: params.walletAddress,
        from_name: 'Nova Swap Affiliate Team',
        from_email: adminEmail,
        reply_to: adminEmail,
        to_email: params.applicantEmail,
        to_name: params.applicantName || 'Applicant',
        subject,
        form_source: 'Nova Swap Affiliate Review Decision',
        decision_status: params.decision,
        dashboard_url: dashboardUrl,
        rejection_reason: params.rejectionReason || '',
        message,
      },
      publicKey
    );
    return { sent: true };
  } catch (err: any) {
    const errMsg = err?.text || err?.message || 'EmailJS failed to send applicant decision email';
    console.warn('Applicant decision EmailJS send error:', errMsg);
    return { sent: false, error: String(errMsg) };
  }
}

export function buildDecisionMailtoLink(params: {
  decision: 'approved' | 'rejected';
  role: 'partner' | 'bdm';
  applicantEmail: string;
  applicantName: string;
  walletAddress: string;
  rejectionReason?: string | null;
}): string {
  const origin = getSiteOrigin();
  const roleTitle = params.role === 'bdm' ? 'BDM' : 'Partner';
  const dashboardUrl = `${origin}${params.role === 'bdm' ? '/bdm-dashboard' : '/partner-dashboard'}`;
  const subject =
    params.decision === 'approved'
      ? `Approved: Your Nova Swap ${roleTitle} Dashboard is Active`
      : `Nova Swap ${roleTitle} Application Update`;
  const body =
    params.decision === 'approved'
      ? `Hi ${params.applicantName},\n\nYour Nova Swap ${roleTitle} application has been approved! Connect your wallet (${params.walletAddress}) at ${dashboardUrl} to access your dashboard.\n\nReferral Link: ${origin}/swap?ref=${params.walletAddress}`
      : `Hi ${params.applicantName},\n\nYour Nova Swap ${roleTitle} application (${params.walletAddress}) was not approved at this time.\n\nReason / Query:\n${params.rejectionReason || ''}\n\nYou may re-apply with updated details anytime.`;

  return `mailto:${encodeURIComponent(params.applicantEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

