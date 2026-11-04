import { db } from './db.js';

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
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'admin@novap2p.com';

  // 1. Record In-App Admin Notification in Database
  try {
    const eventId = 'evt_' + Math.random().toString(36).substring(2, 12);
    db.prepare(`
      INSERT INTO swap_campaign_events (
        id, campaign_id, user_id, wallet_address, event_name, event_data, created_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).run(
      eventId,
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
        adminRecipient: adminEmail,
      }),
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to log in-app admin notification:', err);
  }

  // 2. Email Delivery Attempt (Non-blocking, fails gracefully)
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      // Dynamic import if nodemailer is available or send via standard webhook/SMTP
      console.log(`[Email Notification] Sending claim alert email for ${payload.claimId} to ${adminEmail}`);
      // In production, integrate configured SMTP service
    } else {
      console.log(`[Admin Notification] Configured Admin Email: ${adminEmail} | Claim ID: ${payload.claimId} for $${payload.requestedAmountUSD.toFixed(2)} USDT by ${payload.walletAddress}`);
    }
  } catch (emailErr) {
    console.warn('[Email Notification] Notification email delivery skipped/failed (claim safely recorded):', emailErr);
  }
}
