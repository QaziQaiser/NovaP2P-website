// Application and decision emails are sent by the server (Hostinger SMTP).
// This module only builds a manual mailto fallback for when automatic delivery fails.

function getSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://novap2p.com';
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

