import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import {
  verifyAdmin as verifyAffiliateAdmin,
  signReviewToken,
  verifyReviewToken,
  consumeSignedChallenge,
  isValidWalletAddress,
  sendServerError,
} from './auth.ts';
import { sendAdminAffiliateApplicationEmail, sendApplicantDecisionEmail } from './notifications.ts';

export const affiliateRouter = Router();

/** Public site origin used in email links (APP_URL env, else the request host). */
function getSiteOrigin(req: Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(configured)) return configured;
  const host = req.get('host');
  return host ? `${req.protocol}://${host}` : 'https://novap2p.com';
}

/** Sends the applicant decision email and reports whether it was delivered. */
async function notifyApplicant(req: Request, result: ReviewDecisionResult): Promise<boolean> {
  const emailResult = await sendApplicantDecisionEmail({
    siteOrigin: getSiteOrigin(req),
    decision: result.status,
    role: result.role,
    applicantEmail: result.applicantEmail,
    applicantName: result.applicantName,
    walletAddress: result.walletAddress,
    rejectionReason: result.rejectionReason,
  });
  return emailResult.sent;
}

interface ReviewDecisionResult {
  success: boolean;
  status: 'approved' | 'rejected';
  role: 'partner' | 'bdm';
  walletAddress: string;
  applicantEmail: string;
  applicantName: string;
  rejectionReason: string | null;
}

function processApplicationDecision(params: {
  appRecord: any;
  action: 'approve' | 'reject';
  assignRole?: string;
  bdmWalletAddress?: string;
  adminNotes?: string;
}): ReviewDecisionResult {
  return db.transaction(() => applyApplicationDecision(params))();
}

function applyApplicationDecision(params: {
  appRecord: any;
  action: 'approve' | 'reject';
  assignRole?: string;
  bdmWalletAddress?: string;
  adminNotes?: string;
}): ReviewDecisionResult {
  const { appRecord, action, assignRole, bdmWalletAddress, adminNotes } = params;
  const now = new Date().toISOString();
  const cleanWallet = String(appRecord.wallet_address).toLowerCase();

  if (action === 'reject') {
    const cleanReason = adminNotes ? String(adminNotes).trim() : '';
    db.prepare(`
      UPDATE affiliate_applications
      SET status = 'rejected', admin_notes = ?, reviewed_by = 'admin', reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(cleanReason || null, now, now, appRecord.id);

    return {
      success: true,
      status: 'rejected',
      role: appRecord.role,
      walletAddress: cleanWallet,
      applicantEmail: appRecord.email,
      applicantName: appRecord.full_name,
      rejectionReason: cleanReason || null,
    };
  }

  const targetRole = assignRole === 'bdm' || assignRole === 'partner' ? assignRole : appRecord.role;
  const mappedBdm = bdmWalletAddress
    ? String(bdmWalletAddress).trim().toLowerCase()
    : appRecord.bdm_wallet_address || null;

  db.prepare(`
    UPDATE affiliate_applications
    SET status = 'approved', role = ?, bdm_wallet_address = ?, admin_notes = ?, reviewed_by = 'admin', reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(targetRole, mappedBdm, adminNotes ? String(adminNotes).trim() : null, now, now, appRecord.id);

  const existing = db
    .prepare('SELECT id FROM affiliates WHERE LOWER(wallet_address) = ?')
    .get(cleanWallet) as any;

  if (!existing) {
    db.prepare(`
      INSERT INTO affiliates (
        id, wallet_address, role, application_id, full_name, email,
        telegram_username, bdm_wallet_address, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      'aff_' + crypto.randomUUID(),
      cleanWallet,
      targetRole,
      appRecord.id,
      appRecord.full_name,
      appRecord.email,
      appRecord.telegram_username,
      targetRole === 'partner' ? mappedBdm : null,
      now,
      now
    );
  } else {
    db.prepare(`
      UPDATE affiliates
      SET role = ?, bdm_wallet_address = ?, status = 'active', updated_at = ?
      WHERE id = ?
    `).run(targetRole, targetRole === 'partner' ? mappedBdm : null, now, existing.id);
  }

  return {
    success: true,
    status: 'approved',
    role: targetRole,
    walletAddress: cleanWallet,
    applicantEmail: appRecord.email,
    applicantName: appRecord.full_name,
    rejectionReason: null,
  };
}

/**
 * Helper: Bind a trader wallet to an approved Partner or BDM wallet
 * when they visit or connect via ?ref=WALLETADDRESS
 */
export function bindAffiliateReferral(referredWallet: string, referrerWallet: string): boolean {
  try {
    const cleanReferred = referredWallet.trim().toLowerCase();
    const cleanReferrer = referrerWallet.trim().toLowerCase();

    if (!cleanReferred || !cleanReferrer || cleanReferred === cleanReferrer) {
      return false;
    }
    if (!isValidWalletAddress(referredWallet.trim()) || !isValidWalletAddress(referrerWallet.trim())) {
      return false;
    }

    // Check if referrer is an active approved Partner or BDM
    const affiliate = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?')
      .get(cleanReferrer, 'active') as any;

    if (!affiliate) {
      return false;
    }

    // Ensure user is not already attributed (first-touch lifetime attribution)
    const existingAttribution = db
      .prepare('SELECT id FROM affiliate_referrals WHERE LOWER(referred_wallet_address) = ?')
      .get(cleanReferred);

    if (existingAttribution) {
      return false;
    }

    const now = new Date().toISOString();
    const refId = 'affref_' + crypto.randomUUID();
    const bdmWallet =
      affiliate.role === 'partner' && affiliate.bdm_wallet_address
        ? String(affiliate.bdm_wallet_address).toLowerCase()
        : null;

    db.prepare(`
      INSERT INTO affiliate_referrals (
        id, referred_wallet_address, referrer_wallet_address, referrer_role,
        bdm_wallet_address, total_volume_usd, swaps_count, created_at, last_swap_at
      ) VALUES (?, ?, ?, ?, ?, 0.0, 0, ?, NULL)
    `).run(refId, cleanReferred, cleanReferrer, affiliate.role, bdmWallet, now);

    db.prepare(`
      UPDATE affiliates
      SET active_users_count = active_users_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now, affiliate.id);

    return true;
  } catch (err) {
    console.warn('[Affiliate] bindAffiliateReferral warning:', err);
    return false;
  }
}

/**
 * Helper: Process Partner & BDM commission calculations whenever a swap succeeds.
 * Commission Rules:
 * - Platform Fee: 0.5% of swap volume
 * - Partner: 20% of fee (0.10% of volume), lifetime
 * - BDM Override: 10% of fee (0.05% of volume) on volume from their Partners
 * - Special Case: User trades via BDM's own link -> BDM gets full 20% (0.10% of volume)
 * - Cashback Separation: Only credited to commissions ledger, NEVER to cashback ledger
 */
export function processAffiliateSwapCommission(params: {
  traderWallet: string;
  transactionId: string;
  volumeUSD: number;
  verifiedAt?: string;
}): void {
  try {
    db.transaction(() => creditAffiliateSwapCommission(params))();
  } catch (err) {
    console.warn('[Affiliate] processAffiliateSwapCommission error:', err);
  }
}

function creditAffiliateSwapCommission(params: {
  traderWallet: string;
  transactionId: string;
  volumeUSD: number;
  verifiedAt?: string;
}): void {
  {
    const cleanTrader = params.traderWallet.trim().toLowerCase();
    if (!cleanTrader || params.volumeUSD <= 0 || !params.transactionId) return;

    // Prevent duplicate commission processing for the same transaction
    const existingComm = db
      .prepare('SELECT id FROM affiliate_commissions WHERE transaction_id = ?')
      .get(params.transactionId);
    if (existingComm) return;

    // Find attribution
    const attribution = db
      .prepare('SELECT * FROM affiliate_referrals WHERE LOWER(referred_wallet_address) = ?')
      .get(cleanTrader) as any;

    if (!attribution) return;

    // Never allow self-commission
    if (attribution.referrer_wallet_address.toLowerCase() === cleanTrader) return;

    const now = params.verifiedAt || new Date().toISOString();
    const platformFeeUSD = Number((params.volumeUSD * 0.005).toFixed(6)); // 0.5% platform fee

    // Update referral lifetime volume
    db.prepare(`
      UPDATE affiliate_referrals
      SET total_volume_usd = total_volume_usd + ?, swaps_count = swaps_count + 1, last_swap_at = ?
      WHERE id = ?
    `).run(params.volumeUSD, now, attribution.id);

    const referrer = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?')
      .get(attribution.referrer_wallet_address.toLowerCase(), 'active') as any;

    if (!referrer) return;

    // 1. Direct commission (20% of platform fee = 0.10% of volume) for Partner or Direct-BDM
    const directRate = 0.2;
    const directCommissionUSD = Number((platformFeeUSD * directRate).toFixed(4));
    const commissionType = referrer.role === 'bdm' ? 'direct_bdm' : 'direct_partner';

    if (directCommissionUSD > 0) {
      db.prepare(`
        INSERT INTO affiliate_commissions (
          id, affiliate_wallet_address, affiliate_role, commission_type,
          source_partner_wallet, referred_user_wallet, transaction_id,
          swap_volume_usd, platform_fee_usd, commission_rate, commission_amount_usd,
          status, payout_id, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)
      `).run(
        'comm_' + crypto.randomUUID(),
        referrer.wallet_address,
        referrer.role,
        commissionType,
        cleanTrader,
        params.transactionId,
        params.volumeUSD,
        platformFeeUSD,
        directRate,
        directCommissionUSD,
        now
      );

      db.prepare(`
        UPDATE affiliates
        SET total_referred_volume_usd = total_referred_volume_usd + ?,
            total_earnings_usd = total_earnings_usd + ?,
            pending_balance_usd = pending_balance_usd + ?,
            updated_at = ?
        WHERE id = ?
      `).run(params.volumeUSD, directCommissionUSD, directCommissionUSD, now, referrer.id);
    }

    // 2. BDM Override (10% of platform fee = 0.05% of volume) if referrer is a Partner linked to a BDM
    const bdmWallet = referrer.bdm_wallet_address || attribution.bdm_wallet_address;
    if (referrer.role === 'partner' && bdmWallet && bdmWallet.toLowerCase() !== cleanTrader) {
      const bdm = db
        .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND role = ? AND status = ?')
        .get(bdmWallet.toLowerCase(), 'bdm', 'active') as any;

      if (bdm) {
        const overrideRate = 0.1;
        const overrideCommissionUSD = Number((platformFeeUSD * overrideRate).toFixed(4));

        if (overrideCommissionUSD > 0) {
          db.prepare(`
            INSERT INTO affiliate_commissions (
              id, affiliate_wallet_address, affiliate_role, commission_type,
              source_partner_wallet, referred_user_wallet, transaction_id,
              swap_volume_usd, platform_fee_usd, commission_rate, commission_amount_usd,
              status, payout_id, created_at
            ) VALUES (?, ?, 'bdm', 'bdm_override', ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)
          `).run(
            'comm_' + crypto.randomUUID(),
            bdm.wallet_address,
            referrer.wallet_address,
            cleanTrader,
            params.transactionId,
            params.volumeUSD,
            platformFeeUSD,
            overrideRate,
            overrideCommissionUSD,
            now
          );

          db.prepare(`
            UPDATE affiliates
            SET total_referred_volume_usd = total_referred_volume_usd + ?,
                total_earnings_usd = total_earnings_usd + ?,
                pending_balance_usd = pending_balance_usd + ?,
                updated_at = ?
            WHERE id = ?
          `).run(params.volumeUSD, overrideCommissionUSD, overrideCommissionUSD, now, bdm.id);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PUBLIC / AFFILIATE ENDPOINTS
// ---------------------------------------------------------------------------

// 1. Check connected wallet's Affiliate Role & Application Status
affiliateRouter.get('/status/:walletAddress', (req: Request, res: Response) => {
  try {
    const cleanWallet = String(req.params.walletAddress || '').trim().toLowerCase();
    if (!cleanWallet) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const affiliate = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ?')
      .get(cleanWallet) as any;

    const latestApplicationRow = db
      .prepare('SELECT * FROM affiliate_applications WHERE LOWER(wallet_address) = ? ORDER BY created_at DESC LIMIT 1')
      .get(cleanWallet) as any;

    // Public endpoint: never expose applicant contact email
    const latestApplication = latestApplicationRow ? { ...latestApplicationRow, email: undefined } : null;

    if (affiliate) {
      return res.json({
        walletAddress: cleanWallet,
        isApproved: affiliate.status === 'active',
        status: affiliate.status,
        role: affiliate.role, // 'partner' | 'bdm'
        affiliate: { ...affiliate, email: undefined },
        application: latestApplication || null,
      });
    }

    return res.json({
      walletAddress: cleanWallet,
      isApproved: false,
      status: latestApplication ? latestApplication.status : 'none',
      role: latestApplication ? latestApplication.role : null,
      affiliate: null,
      application: latestApplication || null,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// 2. Submit Partner or BDM Application
affiliateRouter.post('/apply', async (req: Request, res: Response) => {
  try {
    const {
      role,
      walletAddress,
      fullName,
      email,
      telegramUsername,
      twitterLink,
      youtubeLink,
      telegramChannelLink,
      audienceSize,
      marketingExperience,
      manageablePartnersCount,
      message,
      bdmWalletAddress,
      signature,
      signedMessage,
    } = req.body;

    const cleanRole = role === 'bdm' ? 'bdm' : 'partner';
    const cleanWallet = String(walletAddress || '').trim().toLowerCase();

    if (!cleanWallet || !fullName || !email || !telegramUsername || !twitterLink || !telegramChannelLink) {
      return res.status(400).json({ error: 'Please complete all required application fields' });
    }

    if (!isValidWalletAddress(String(walletAddress).trim())) {
      return res.status(400).json({ error: 'Please connect a valid wallet address.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Prove ownership of the applying wallet
    const signatureError = consumeSignedChallenge({
      address: String(walletAddress).trim(),
      purpose: 'affiliate_apply',
      message: signedMessage,
      signature,
    });
    if (signatureError) {
      return res.status(401).json({ error: signatureError });
    }

    // Check if already approved
    const existingAffiliate = db
      .prepare('SELECT id, role, status FROM affiliates WHERE LOWER(wallet_address) = ?')
      .get(cleanWallet) as any;

    if (existingAffiliate) {
      return res.status(400).json({
        error: `This wallet is already registered as an approved ${existingAffiliate.role.toUpperCase()}.`,
        role: existingAffiliate.role,
      });
    }

    // Check if pending application already exists
    const existingPending = db
      .prepare('SELECT id, role FROM affiliate_applications WHERE LOWER(wallet_address) = ? AND status = ?')
      .get(cleanWallet, 'pending') as any;

    if (existingPending) {
      return res.status(400).json({
        error: `An application for this wallet (${existingPending.role.toUpperCase()}) is already pending review.`,
      });
    }

    const now = new Date().toISOString();
    const appId = 'app_' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO affiliate_applications (
        id, role, wallet_address, full_name, email, telegram_username,
        twitter_link, youtube_link, telegram_channel_link, audience_size,
        marketing_experience, manageable_partners_count, message, bdm_wallet_address,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      appId,
      cleanRole,
      cleanWallet,
      String(fullName).trim(),
      String(email).trim(),
      String(telegramUsername).trim(),
      String(twitterLink).trim(),
      youtubeLink ? String(youtubeLink).trim() : null,
      String(telegramChannelLink).trim(),
      audienceSize ? String(audienceSize).trim() : null,
      marketingExperience ? String(marketingExperience).trim() : null,
      manageablePartnersCount ? String(manageablePartnersCount).trim() : null,
      message ? String(message).trim() : null,
      bdmWalletAddress ? String(bdmWalletAddress).trim().toLowerCase() : null,
      now,
      now
    );

    // Record in campaign events for audit visibility
    try {
      db.prepare(`
        INSERT INTO swap_campaign_events (
          id, campaign_id, wallet_address, event_name, event_data, created_at
        ) VALUES (?, 'campaign_genesis_001', ?, ?, ?, ?)
      `).run(
        'evt_' + crypto.randomUUID(),
        cleanWallet,
        `affiliate_${cleanRole}_applied`,
        JSON.stringify({ appId, fullName, email, telegramUsername }),
        now
      );
    } catch {
      // Non-blocking audit log
    }

    // Email the admin (support@novap2p.com) with signed Approve / Reject links. The review token never leaves the server.
    const reviewToken = signReviewToken(appId);
    let adminNotified = false;
    if (reviewToken) {
      const emailResult = await sendAdminAffiliateApplicationEmail({
        siteOrigin: getSiteOrigin(req),
        applicationId: appId,
        reviewToken,
        role: cleanRole,
        walletAddress: cleanWallet,
        fullName: String(fullName).trim(),
        email: String(email).trim(),
        telegramUsername: String(telegramUsername).trim(),
        twitterLink: String(twitterLink).trim(),
        youtubeLink: youtubeLink ? String(youtubeLink).trim() : null,
        telegramChannelLink: String(telegramChannelLink).trim(),
        audienceSize: audienceSize ? String(audienceSize).trim() : null,
        marketingExperience: marketingExperience ? String(marketingExperience).trim() : null,
        manageablePartnersCount: manageablePartnersCount ? String(manageablePartnersCount).trim() : null,
        message: message ? String(message).trim() : null,
      });
      adminNotified = emailResult.sent;
    } else {
      console.warn(`[Affiliate] Application ${appId} saved, but admin email skipped: SWAP_ADMIN_KEY not configured (needed for review links).`);
    }

    res.json({
      success: true,
      applicationId: appId,
      adminNotified,
      role: cleanRole,
      status: 'pending',
      message: `Your ${cleanRole === 'bdm' ? 'BDM' : 'Partner'} application has been submitted and will be reviewed within 24 hours.`,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// 3. Track Affiliate ?ref=WALLET visit / bind on connection
affiliateRouter.post('/track-ref', (req: Request, res: Response) => {
  try {
    const { refWallet, traderWallet } = req.body;
    if (!refWallet) {
      return res.status(400).json({ error: 'refWallet is required' });
    }

    const cleanRef = String(refWallet).trim().toLowerCase();
    if (!isValidWalletAddress(String(refWallet).trim())) {
      return res.json({ success: true, valid: false, referrerRole: null, bound: false });
    }
    const affiliate = db
      .prepare('SELECT id, wallet_address, role, status FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?')
      .get(cleanRef, 'active') as any;

    let bound = false;
    if (affiliate && traderWallet) {
      bound = bindAffiliateReferral(String(traderWallet), cleanRef);
    }

    res.json({
      success: true,
      valid: !!affiliate,
      referrerRole: affiliate?.role || null,
      bound,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// 4. Partner Dashboard Data
affiliateRouter.get('/partner/dashboard/:walletAddress', (req: Request, res: Response) => {
  try {
    const cleanWallet = String(req.params.walletAddress || '').trim().toLowerCase();
    const partner = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND role = ?')
      .get(cleanWallet, 'partner') as any;

    if (!partner) {
      return res.status(403).json({ error: 'Wallet is not an approved Partner' });
    }

    const commissions = db
      .prepare(`
        SELECT * FROM affiliate_commissions
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all(cleanWallet) as any[];

    const referrals = db
      .prepare(`
        SELECT * FROM affiliate_referrals
        WHERE LOWER(referrer_wallet_address) = ?
        ORDER BY total_volume_usd DESC, created_at DESC
        LIMIT 100
      `)
      .all(cleanWallet) as any[];

    const payouts = db
      .prepare(`
        SELECT * FROM affiliate_payouts
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 50
      `)
      .all(cleanWallet) as any[];

    const activeUsers = referrals.length;
    const referralsThisMonth = referrals.filter((r) => {
      const created = new Date(r.created_at).getTime();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return created >= thirtyDaysAgo;
    }).length;

    res.json({
      partner: {
        walletAddress: partner.wallet_address,
        fullName: partner.full_name,
        telegramUsername: partner.telegram_username,
        status: partner.status,
        bdmWalletAddress: partner.bdm_wallet_address,
        referralLink: `https://novap2p.com/swap?ref=${partner.wallet_address}`,
        commissionRatePct: 20, // 20% of 0.5% fee
        effectiveVolumePct: 0.1, // 0.10% of volume
        createdAt: partner.created_at,
      },
      stats: {
        totalEarningsUSD: Number((partner.total_earnings_usd || 0).toFixed(4)),
        pendingBalanceUSD: Number((partner.pending_balance_usd || 0).toFixed(4)),
        paidBalanceUSD: Number((partner.paid_balance_usd || 0).toFixed(4)),
        referredVolumeUSD: Number((partner.total_referred_volume_usd || 0).toFixed(2)),
        activeUsers,
        referralsThisMonth,
        minWithdrawalUSD: 100,
      },
      commissions: commissions.map((c) => ({
        id: c.id,
        date: c.created_at,
        referredUser: c.referred_user_wallet,
        swapVolumeUSD: c.swap_volume_usd,
        platformFeeUSD: c.platform_fee_usd,
        commissionRatePct: Number((c.commission_rate * 100).toFixed(2)),
        effectiveVolumePct: Number((c.commission_rate * 0.5).toFixed(2)),
        commissionAmountUSD: c.commission_amount_usd,
        status: c.status, // 'paid' | 'pending'
      })),
      referrals: referrals.map((r) => ({
        id: r.id,
        walletAddress: r.referred_wallet_address,
        totalVolumeUSD: r.total_volume_usd,
        swapsCount: r.swaps_count,
        joinedAt: r.created_at,
        lastSwapAt: r.last_swap_at,
      })),
      payouts,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// 5. BDM Dashboard Data
affiliateRouter.get('/bdm/dashboard/:walletAddress', (req: Request, res: Response) => {
  try {
    const cleanWallet = String(req.params.walletAddress || '').trim().toLowerCase();
    const bdm = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND role = ?')
      .get(cleanWallet, 'bdm') as any;

    if (!bdm) {
      return res.status(403).json({ error: 'Wallet is not an approved BDM' });
    }

    // Managed Partners under this BDM
    const managedPartners = db
      .prepare(`
        SELECT * FROM affiliates
        WHERE LOWER(bdm_wallet_address) = ? AND role = 'partner'
        ORDER BY total_referred_volume_usd DESC, created_at DESC
      `)
      .all(cleanWallet) as any[];

    const partnerRows = managedPartners.map((p) => {
      const overrideRow = db
        .prepare(`
          SELECT COALESCE(SUM(commission_amount_usd), 0) as total_override
          FROM affiliate_commissions
          WHERE LOWER(affiliate_wallet_address) = ?
            AND commission_type = 'bdm_override'
            AND LOWER(source_partner_wallet) = ?
        `)
        .get(cleanWallet, p.wallet_address.toLowerCase()) as any;

      return {
        id: p.id,
        walletAddress: p.wallet_address,
        fullName: p.full_name,
        telegramUsername: p.telegram_username,
        referredVolumeUSD: Number((p.total_referred_volume_usd || 0).toFixed(2)),
        partnerEarningsUSD: Number((p.total_earnings_usd || 0).toFixed(4)),
        bdmOverrideUSD: Number((overrideRow?.total_override || 0).toFixed(4)),
        activeUsersCount: p.active_users_count || 0,
        status: p.status, // 'active' | 'pending_activation' | 'inactive'
        joinedAt: p.created_at,
      };
    });

    const partnersOnlyVolumeUSD = partnerRows.reduce((sum, p) => sum + p.referredVolumeUSD, 0);
    const directBdmRow = db
      .prepare(`
        SELECT COALESCE(SUM(total_volume_usd), 0) as direct_volume
        FROM affiliate_referrals
        WHERE LOWER(referrer_wallet_address) = ? AND referrer_role = 'bdm'
      `)
      .get(cleanWallet) as any;
    const directBdmVolumeUSD = Number((directBdmRow?.direct_volume || 0).toFixed(2));
    const totalManagedVolumeUSD = partnersOnlyVolumeUSD + directBdmVolumeUSD;
    const activePartnersCount = partnerRows.filter((p) => p.status === 'active').length;

    const commissions = db
      .prepare(`
        SELECT * FROM affiliate_commissions
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all(cleanWallet) as any[];

    const payouts = db
      .prepare(`
        SELECT * FROM affiliate_payouts
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 50
      `)
      .all(cleanWallet) as any[];

    res.json({
      bdm: {
        walletAddress: bdm.wallet_address,
        fullName: bdm.full_name,
        telegramUsername: bdm.telegram_username,
        status: bdm.status,
        referralLink: `https://novap2p.com/swap?ref=${bdm.wallet_address}`,
        directCommissionRatePct: 20, // 20% of fee on direct BDM link
        overrideRatePct: 10, // 10% of fee on managed partners
        createdAt: bdm.created_at,
      },
      stats: {
        totalManagedVolumeUSD: Number(totalManagedVolumeUSD.toFixed(2)),
        partnersOnlyVolumeUSD: Number(partnersOnlyVolumeUSD.toFixed(2)),
        totalEarningsUSD: Number((bdm.total_earnings_usd || 0).toFixed(4)),
        pendingPayoutUSD: Number((bdm.pending_balance_usd || 0).toFixed(4)),
        paidBalanceUSD: Number((bdm.paid_balance_usd || 0).toFixed(4)),
        activePartnersCount,
        totalPartnersCount: partnerRows.length,
        minWithdrawalUSD: 100,
      },
      partners: partnerRows,
      commissions: commissions.map((c) => ({
        id: c.id,
        date: c.created_at,
        commissionType: c.commission_type,
        sourcePartnerWallet: c.source_partner_wallet,
        referredUser: c.referred_user_wallet,
        swapVolumeUSD: c.swap_volume_usd,
        commissionRatePct: Number((c.commission_rate * 100).toFixed(2)),
        commissionAmountUSD: c.commission_amount_usd,
        status: c.status,
      })),
      payouts,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// 6. Request Affiliate Payout (Partner or BDM, minimum $100)
affiliateRouter.post('/payout/request', (req: Request, res: Response) => {
  try {
    const { walletAddress, payoutAddress, preferredNetwork, preferredToken, signature, signedMessage } = req.body;
    const cleanWallet = String(walletAddress || '').trim().toLowerCase();

    if (!cleanWallet || !payoutAddress || !preferredNetwork) {
      return res.status(400).json({ error: 'Wallet address, payout destination, and network are required' });
    }

    if (String(payoutAddress).trim().length < 20 || String(payoutAddress).trim().length > 128) {
      return res.status(400).json({ error: 'Please enter a valid payout wallet address.' });
    }

    // Only the affiliate's own wallet can request (and choose the destination of) a payout
    const signatureError = consumeSignedChallenge({
      address: String(walletAddress).trim(),
      purpose: 'affiliate_payout',
      message: signedMessage,
      signature,
    });
    if (signatureError) {
      return res.status(401).json({ error: signatureError });
    }

    const affiliate = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?')
      .get(cleanWallet, 'active') as any;

    if (!affiliate) {
      return res.status(403).json({ error: 'Active approved affiliate account required' });
    }

    const availableBalance = Number((affiliate.pending_balance_usd || 0).toFixed(2));
    if (availableBalance < 100) {
      return res.status(400).json({
        error: `Minimum payout is $100.00. Your current pending balance is $${availableBalance.toFixed(2)}.`,
      });
    }

    const now = new Date().toISOString();
    const payoutId = 'affpay_' + crypto.randomUUID();

    db.transaction(() => {
    db.prepare(`
      INSERT INTO affiliate_payouts (
        id, affiliate_wallet_address, affiliate_role, amount_usd,
        payout_address, preferred_network, preferred_token,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      payoutId,
      cleanWallet,
      affiliate.role,
      availableBalance,
      String(payoutAddress).trim(),
      String(preferredNetwork).trim(),
      preferredToken ? String(preferredToken).trim() : 'USDT',
      now,
      now
    );

    // Deduct pending balance and link pending commissions to this payout
    db.prepare(`
      UPDATE affiliates
      SET pending_balance_usd = 0.0, updated_at = ?
      WHERE id = ?
    `).run(now, affiliate.id);

    db.prepare(`
      UPDATE affiliate_commissions
      SET payout_id = ?
      WHERE LOWER(affiliate_wallet_address) = ? AND status = 'pending' AND payout_id IS NULL
    `).run(payoutId, cleanWallet);
    })();

    res.json({
      success: true,
      payoutId,
      amountUSD: availableBalance,
      status: 'pending',
      message: 'Payout request submitted! Processing takes within 24 hours.',
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// ---------------------------------------------------------------------------
// ADMIN ENDPOINTS (Future/Integrated Admin Panel Approvals)
// ---------------------------------------------------------------------------

// Admin Overview: Applications, Affiliates, Payouts
affiliateRouter.get('/admin/overview', verifyAffiliateAdmin, (req: Request, res: Response) => {
  try {
    const applications = db
      .prepare('SELECT * FROM affiliate_applications ORDER BY created_at DESC')
      .all();

    const affiliates = db
      .prepare('SELECT * FROM affiliates ORDER BY total_referred_volume_usd DESC, created_at DESC')
      .all();

    const payouts = db
      .prepare('SELECT * FROM affiliate_payouts ORDER BY created_at DESC')
      .all();

    res.json({
      applications,
      affiliates,
      payouts,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// Admin: Approve or Reject Affiliate Application
affiliateRouter.post('/admin/applications/:id/review', verifyAffiliateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, assignRole, bdmWalletAddress, adminNotes } = req.body; // action: 'approve' | 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const appRecord = db
      .prepare('SELECT * FROM affiliate_applications WHERE id = ?')
      .get(id) as any;

    if (!appRecord) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (action === 'reject' && (!adminNotes || !String(adminNotes).trim())) {
      return res.status(400).json({ error: 'Please provide a rejection reason / query for the applicant.' });
    }

    const result = processApplicationDecision({
      appRecord,
      action,
      assignRole,
      bdmWalletAddress,
      adminNotes,
    });

    const applicantNotified = await notifyApplicant(req, result);
    return res.json({ ...result, applicantNotified });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// Signed Email Link: Fetch Application Details for Review Page (/affiliate-review)
affiliateRouter.get('/review-info', (req: Request, res: Response) => {
  try {
    const id = String(req.query.id || '').trim();
    const token = String(req.query.token || '').trim();

    if (!verifyReviewToken(id, token)) {
      return res.status(403).json({ error: 'Invalid or expired review link.' });
    }

    const appRecord = db
      .prepare('SELECT * FROM affiliate_applications WHERE id = ?')
      .get(id) as any;

    if (!appRecord) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    return res.json({
      application: appRecord,
    });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// Signed Email Link: Approve or Reject directly from Email Review Link
affiliateRouter.post('/review-action', async (req: Request, res: Response) => {
  try {
    const { id, token, action, assignRole, bdmWalletAddress, adminNotes } = req.body;

    if (!verifyReviewToken(String(id || ''), String(token || ''))) {
      return res.status(403).json({ error: 'Invalid or expired review signature.' });
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Action must be approve or reject.' });
    }

    const appRecord = db
      .prepare('SELECT * FROM affiliate_applications WHERE id = ?')
      .get(String(id)) as any;

    if (!appRecord) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    // Email links are single-use: once reviewed, further changes go through the admin panel
    if (appRecord.status !== 'pending') {
      return res.status(409).json({ error: `This application has already been ${appRecord.status}. Use the admin panel (/swap-admin) to make further changes.` });
    }

    if (action === 'reject' && (!adminNotes || !String(adminNotes).trim())) {
      return res.status(400).json({ error: 'Rejection reason / query is required before rejecting.' });
    }

    const result = processApplicationDecision({
      appRecord,
      action,
      assignRole,
      bdmWalletAddress,
      adminNotes,
    });

    const applicantNotified = await notifyApplicant(req, result);
    return res.json({ ...result, applicantNotified });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// Admin: Update Affiliate Status or BDM Mapping
affiliateRouter.post('/admin/affiliates/:walletAddress/update', verifyAffiliateAdmin, (req: Request, res: Response) => {
  try {
    const cleanWallet = String(req.params.walletAddress || '').trim().toLowerCase();
    const { status, bdmWalletAddress } = req.body;

    const existing = db
      .prepare('SELECT * FROM affiliates WHERE LOWER(wallet_address) = ?')
      .get(cleanWallet) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    const now = new Date().toISOString();
    const newStatus = status || existing.status;
    const newBdm = bdmWalletAddress !== undefined
      ? (bdmWalletAddress ? String(bdmWalletAddress).trim().toLowerCase() : null)
      : existing.bdm_wallet_address;

    db.prepare(`
      UPDATE affiliates
      SET status = ?, bdm_wallet_address = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, newBdm, now, existing.id);

    res.json({ success: true });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

// Admin: Pay Affiliate Payout Request
affiliateRouter.post('/admin/payouts/:id/pay', verifyAffiliateAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { txHash, adminNotes } = req.body;

    const payout = db
      .prepare('SELECT * FROM affiliate_payouts WHERE id = ?')
      .get(id) as any;

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    if (payout.status === 'paid') {
      return res.status(400).json({ error: 'This payout has already been marked as paid.' });
    }

    const now = new Date().toISOString();

    db.transaction(() => {
    db.prepare(`
      UPDATE affiliate_payouts
      SET status = 'paid', tx_hash = ?, admin_notes = ?, paid_at = ?, updated_at = ?
      WHERE id = ?
    `).run(txHash || null, adminNotes || null, now, now, id);

    db.prepare(`
      UPDATE affiliates
      SET paid_balance_usd = paid_balance_usd + ?, updated_at = ?
      WHERE LOWER(wallet_address) = ?
    `).run(payout.amount_usd, now, payout.affiliate_wallet_address.toLowerCase());

    db.prepare(`
      UPDATE affiliate_commissions
      SET status = 'paid'
      WHERE payout_id = ?
    `).run(id);
    })();

    res.json({ success: true, status: 'paid' });
  } catch (err: any) {
    sendServerError(res, err, 'affiliate api');
  }
});

