import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from './db.ts';

// ---------------------------------------------------------------------------
// SMTP MAILER (Hostinger mailbox: support@novap2p.com)
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'support@novap2p.com';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || 'support@novap2p.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || `"Nova Swap" <${SMTP_USER}>`;

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Fail fast instead of holding the applicant's request open for minutes
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

/** Explains common SMTP failures in plain language for the server log. */
function describeSmtpError(err: any): string {
  const code = err?.code || '';
  const detail = `${code} ${err?.responseCode || ''} ${err?.response || err?.message || ''}`.trim();
  if (code === 'EAUTH') return `login rejected - SMTP_PASS (or SMTP_USER=${SMTP_USER}) is wrong. [${detail}]`;
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET') return `cannot reach ${SMTP_HOST}:${SMTP_PORT}. [${detail}]`;
  return detail;
}

if (!SMTP_PASS) {
  console.warn('[Email] SMTP_PASS is not set. Application and decision emails will not be sent until it is configured.');
} else {
  // Check the mailbox login once at startup so a wrong password shows up immediately in the server log
  getTransporter()
    ?.verify()
    .then(() => console.log(`[Email] SMTP login OK (${SMTP_USER} via ${SMTP_HOST}:${SMTP_PORT}). Admin emails go to ${ADMIN_EMAIL}.`))
    .catch((err) => console.error(`[Email] SMTP login FAILED: ${describeSmtpError(err)}`));
}

export interface EmailSendResult {
  sent: boolean;
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Converts the plain-text body to simple HTML, turning URLs into clickable links. */
function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4F7DF3;word-break:break-all;">$1</a>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${linked}</div>`;
}

async function sendMail(params: { to: string; subject: string; text: string; html?: string; replyTo?: string }): Promise<EmailSendResult> {
  const t = getTransporter();
  if (!t) {
    return { sent: false, error: 'Email service is not configured (SMTP_PASS missing).' };
  }
  try {
    await t.sendMail({
      from: MAIL_FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || textToHtml(params.text),
      replyTo: params.replyTo,
    });
    console.log(`[Email] Sent "${params.subject}" to ${params.to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[Email] Send to ${params.to} failed: ${describeSmtpError(err)}`);
    return { sent: false, error: 'Email delivery failed.' };
  }
}

// ---------------------------------------------------------------------------
// AFFILIATE APPLICATION EMAILS
// ---------------------------------------------------------------------------

export async function sendAdminAffiliateApplicationEmail(params: {
  siteOrigin: string;
  applicationId: string;
  reviewToken: string;
  role: 'partner' | 'bdm';
  walletAddress: string;
  fullName: string;
  email: string;
  telegramUsername: string;
  twitterLink: string;
  youtubeLink?: string | null;
  telegramChannelLink: string;
  audienceSize?: string | null;
  marketingExperience?: string | null;
  manageablePartnersCount?: string | null;
  message?: string | null;
}): Promise<EmailSendResult> {
  const baseReviewUrl = `${params.siteOrigin}/affiliate-review?id=${encodeURIComponent(params.applicationId)}&token=${encodeURIComponent(params.reviewToken)}`;
  const approveUrl = `${baseReviewUrl}&action=approve`;
  const rejectUrl = `${baseReviewUrl}&action=reject`;
  const roleLabel = params.role === 'bdm' ? 'Business Development Manager (BDM)' : 'Partner';

  const text = [
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

  // HTML version: one field per row with bold labels, plus green Approve / red Reject buttons.
  // Table layout + inline styles so it renders the same in Gmail, Outlook and mobile mail apps.
  const fieldRows: Array<[string, string | null | undefined, boolean?]> = [
    ['Application ID', params.applicationId],
    ['Role', roleLabel],
    ['Wallet Address', params.walletAddress],
    ['Full Name', params.fullName],
    ['Email', params.email],
    ['Telegram', params.telegramUsername],
    ['Twitter / X', params.twitterLink, true],
    ['YouTube', params.youtubeLink, true],
    ['Telegram Channel / Group', params.telegramChannelLink, true],
    ['Estimated Audience Size', params.audienceSize],
    ['Marketing Experience', params.marketingExperience],
    ['Manageable Partners', params.manageablePartnersCount],
    ['Applicant Message', params.message],
  ];

  const rowsHtml = fieldRows
    .filter(([, value]) => value)
    .map(([label, value, isLink]) => {
      const safe = escapeHtml(String(value));
      const valueHtml =
        isLink && /^https?:\/\//i.test(String(value))
          ? `<a href="${safe}" style="color:#4F7DF3;text-decoration:none;word-break:break-all;">${safe}</a>`
          : `<span style="word-break:break-word;white-space:pre-wrap;">${safe}</span>`;
      return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;font-weight:700;color:#111827;width:38%;vertical-align:top;">${escapeHtml(label)}:</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;color:#374151;vertical-align:top;">${valueHtml}</td>
        </tr>`;
    })
    .join('');

  const button = (href: string, label: string, color: string) =>
    `<td align="center" style="padding:6px;">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;background:${color};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:13px 16px;border-radius:10px;min-width:120px;text-align:center;white-space:nowrap;">${label}</a>
      </td>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#4F7DF3;padding:20px 24px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">Nova Swap</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;">New ${escapeHtml(roleLabel)} Application</div>
        </td></tr>
        <tr><td style="padding:16px 12px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">
            ${rowsHtml}
          </table>
        </td></tr>
        <tr><td style="padding:20px 24px 8px;text-align:center;font-weight:700;color:#111827;font-size:15px;">Quick Admin Actions</td></tr>
        <tr><td align="center" style="padding:0 8px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${button(approveUrl, '&#10003; Approve', '#16a34a')}
            ${button(rejectUrl, '&#10007; Reject', '#dc2626')}
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 24px 22px;text-align:center;color:#6b7280;font-size:12px;">
          You can also review this application inside /swap-admin &rarr; Partners &amp; BDMs.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendMail({
    to: ADMIN_EMAIL,
    subject: `New ${params.role === 'bdm' ? 'BDM' : 'Partner'} Application — ${params.fullName}`,
    text,
    html,
    replyTo: params.email,
  });
}

export async function sendApplicantDecisionEmail(params: {
  siteOrigin: string;
  decision: 'approved' | 'rejected';
  role: 'partner' | 'bdm';
  applicantEmail: string;
  applicantName: string;
  walletAddress: string;
  rejectionReason?: string | null;
}): Promise<EmailSendResult> {
  if (!params.applicantEmail) {
    return { sent: false, error: 'Applicant email address is missing.' };
  }
  const origin = params.siteOrigin;
  const roleTitle = params.role === 'bdm' ? 'Business Development Manager (BDM)' : 'Partner';
  const dashboardUrl = `${origin}${params.role === 'bdm' ? '/bdm-dashboard' : '/partner-dashboard'}`;
  const applyUrl = `${origin}${params.role === 'bdm' ? '/become-bdm' : '/become-partner'}`;
  const referralLink = `${origin}/swap?ref=${params.walletAddress}`;

  const subject =
    params.decision === 'approved'
      ? `Approved: Your Nova Swap ${roleTitle} Dashboard is Now Active!`
      : `Update on Your Nova Swap ${roleTitle} Application`;

  const text =
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
          `If you have questions, simply reply to this email or contact ${ADMIN_EMAIL}.`,
          ``,
          `Best regards,`,
          `Nova Swap Affiliate Team`,
        ].join('\n');

  return sendMail({ to: params.applicantEmail, subject, text, replyTo: ADMIN_EMAIL });
}

// ---------------------------------------------------------------------------
// REWARD CLAIM NOTIFICATION (in-app admin event log)
// ---------------------------------------------------------------------------

interface ClaimNotificationPayload {
  claimId: string;
  walletAddress: string;
  requestedAmountUSD: number;
  payoutAddress: string;
  preferredNetwork: string;
  preferredToken: string;
  cashbackAmountUSD: number;
  milestoneAmountUSD: number;
  referralAmountUSD: number;
  createdAt: string;
}

export async function sendAdminClaimNotification(payload: ClaimNotificationPayload): Promise<void> {
  // Record In-App Admin Notification in Database
  try {
    db.prepare(`
      INSERT INTO swap_campaign_events (
        id, campaign_id, user_id, wallet_address, event_name, event_data, created_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).run(
      'evt_' + crypto.randomUUID(),
      'campaign_genesis_001',
      payload.walletAddress,
      'claim_request_submitted',
      JSON.stringify({
        claimId: payload.claimId,
        amountUSD: payload.requestedAmountUSD,
        payoutAddress: payload.payoutAddress,
        network: payload.preferredNetwork,
        token: payload.preferredToken,
        breakdown: {
          cashback: payload.cashbackAmountUSD,
          milestones: payload.milestoneAmountUSD,
          referrals: payload.referralAmountUSD,
        },
        adminRecipient: ADMIN_EMAIL,
      }),
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to log in-app admin notification:', err);
  }

  console.log(`[Admin Notification] Claim ID: ${payload.claimId} for $${payload.requestedAmountUSD.toFixed(2)} USDT by ${payload.walletAddress}`);
}
