// server/index.ts
import express from "express";

// server/api.ts
import { Router as Router2 } from "express";

// server/db.ts
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var dataDir = path.resolve(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
var dbPath = path.join(dataDir, "nova_swap.db");
var db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
function initDb() {
  db.exec(`
    -- 1. Campaign configurations
    CREATE TABLE IF NOT EXISTS swap_campaigns (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'ended'
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_budget_usd REAL NOT NULL DEFAULT 50000.0,
      spent_budget_usd REAL NOT NULL DEFAULT 0.0,
      min_swap_usd REAL NOT NULL DEFAULT 1.0,
      referral_reward_usd REAL NOT NULL DEFAULT 5.0,
      referral_qualifying_vol_usd REAL NOT NULL DEFAULT 2000.0,
      cashback_enabled INTEGER NOT NULL DEFAULT 1, -- 1 = active (5% cashback on Nova fee)
      cashback_percentage REAL NOT NULL DEFAULT 5.0,
      rules_content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 2. Campaign milestone definitions
    CREATE TABLE IF NOT EXISTS swap_campaign_milestones (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      milestone_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      target_volume_usd REAL NOT NULL,
      reward_amount_usd REAL NOT NULL,
      reward_description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(campaign_id, milestone_number),
      FOREIGN KEY (campaign_id) REFERENCES swap_campaigns(id) ON DELETE CASCADE
    );

    -- 3. Campaign users & verified wallets
    CREATE TABLE IF NOT EXISTS swap_campaign_users (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL, -- lowercase
      chain_id INTEGER,
      signature TEXT,
      verified_at TEXT,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by_user_id TEXT,
      total_volume_usd REAL NOT NULL DEFAULT 0.0,
      eligible_swaps_count INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT,
      last_active_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(campaign_id, wallet_address),
      FOREIGN KEY (campaign_id) REFERENCES swap_campaigns(id) ON DELETE CASCADE
    );

    -- 4. Verified swap transactions
    CREATE TABLE IF NOT EXISTS swap_transactions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL, -- lowercase
      chain_id INTEGER NOT NULL,
      tx_hash TEXT NOT NULL, -- lowercase
      lifi_route_id TEXT,
      from_token_symbol TEXT,
      from_token_address TEXT,
      to_token_symbol TEXT,
      to_token_address TEXT,
      from_amount TEXT,
      to_amount TEXT,
      volume_usd REAL NOT NULL,
      execution_status TEXT NOT NULL DEFAULT 'DONE', -- 'DONE', 'FAILED', 'PENDING'
      verification_status TEXT NOT NULL DEFAULT 'VERIFIED', -- 'VERIFIED', 'REJECTED', 'PENDING'
      verification_source TEXT NOT NULL DEFAULT 'lifi_status_api',
      verified_at TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(chain_id, tx_hash),
      FOREIGN KEY (user_id) REFERENCES swap_campaign_users(id) ON DELETE CASCADE
    );

    -- 5. Referral relationships and tracking
    CREATE TABLE IF NOT EXISTS swap_referrals (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      referrer_user_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      visitor_ip TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'connected', -- 'visited', 'connected', 'qualified', 'rewarded', 'rejected'
      qualifying_volume_usd REAL NOT NULL DEFAULT 0.0,
      reward_amount_usd REAL NOT NULL DEFAULT 0.0,
      qualified_at TEXT,
      rewarded_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(campaign_id, referred_user_id),
      FOREIGN KEY (referrer_user_id) REFERENCES swap_campaign_users(id),
      FOREIGN KEY (referred_user_id) REFERENCES swap_campaign_users(id)
    );

    -- 6. User rewards (milestone, referral, cashback)
    CREATE TABLE IF NOT EXISTS swap_rewards (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      milestone_id TEXT,
      reward_type TEXT NOT NULL, -- 'milestone', 'referral', 'cashback'
      amount_usd REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unlocked', -- 'locked', 'unlocked', 'requested', 'under_review', 'approved', 'paid', 'rejected', 'frozen'
      unlocked_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES swap_campaign_users(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES swap_campaign_milestones(id) ON DELETE SET NULL
    );

    -- 7. Dedicated Cashback Ledger
    CREATE TABLE IF NOT EXISTS swap_cashback_ledger (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      transaction_id TEXT NOT NULL UNIQUE,
      swap_volume_usd REAL NOT NULL,
      nova_fee_usd REAL NOT NULL,
      cashback_rate REAL NOT NULL,
      cashback_amount_usd REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'credited', -- 'credited', 'claimed', 'voided'
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES swap_campaign_users(id),
      FOREIGN KEY (transaction_id) REFERENCES swap_transactions(id)
    );

    -- 8. Reward claims submitted by users
    CREATE TABLE IF NOT EXISTS swap_reward_claims (
      id TEXT PRIMARY KEY,
      reward_id TEXT,
      user_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      requested_amount_usd REAL NOT NULL,
      payout_address TEXT NOT NULL,
      preferred_network TEXT,
      preferred_token TEXT,
      cashback_amount_usd REAL NOT NULL DEFAULT 0.0,
      milestone_amount_usd REAL NOT NULL DEFAULT 0.0,
      referral_amount_usd REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'paid', 'rejected', 'frozen'
      rejection_reason TEXT,
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (reward_id) REFERENCES swap_rewards(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES swap_campaign_users(id) ON DELETE CASCADE
    );

    -- 9. Payout execution records
    CREATE TABLE IF NOT EXISTS swap_reward_payouts (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL UNIQUE,
      reward_id TEXT,
      user_id TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      payout_network TEXT NOT NULL,
      payout_token TEXT NOT NULL,
      payout_tx_hash TEXT NOT NULL,
      paid_by_admin TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES swap_reward_claims(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES swap_rewards(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES swap_campaign_users(id) ON DELETE CASCADE
    );

    -- 10. Analytics & event logs
    CREATE TABLE IF NOT EXISTS swap_campaign_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      user_id TEXT,
      wallet_address TEXT,
      event_name TEXT NOT NULL,
      event_data TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    -- 11. Admin audit logs
    CREATE TABLE IF NOT EXISTS swap_admin_audit_logs (
      id TEXT PRIMARY KEY,
      admin_identifier TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON swap_campaign_users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_users_referral ON swap_campaign_users(referral_code);
    CREATE INDEX IF NOT EXISTS idx_tx_wallet ON swap_transactions(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_tx_hash ON swap_transactions(tx_hash);
    CREATE INDEX IF NOT EXISTS idx_tx_chain ON swap_transactions(chain_id);
    CREATE INDEX IF NOT EXISTS idx_rewards_user ON swap_rewards(user_id);
    CREATE INDEX IF NOT EXISTS idx_cashback_user ON swap_cashback_ledger(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_status ON swap_reward_claims(status);
    CREATE INDEX IF NOT EXISTS idx_events_name ON swap_campaign_events(event_name);

    -- 12. Affiliate Program Applications (Partner & BDM)
    CREATE TABLE IF NOT EXISTS affiliate_applications (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL, -- 'partner' | 'bdm'
      wallet_address TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      telegram_username TEXT NOT NULL,
      twitter_link TEXT NOT NULL,
      youtube_link TEXT,
      telegram_channel_link TEXT NOT NULL,
      audience_size TEXT,
      marketing_experience TEXT,
      manageable_partners_count TEXT,
      message TEXT,
      bdm_wallet_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
      admin_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 13. Approved Affiliates (Partners & BDMs)
    CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL, -- 'partner' | 'bdm'
      application_id TEXT,
      full_name TEXT,
      email TEXT,
      telegram_username TEXT,
      bdm_wallet_address TEXT, -- For Partner role: mapped BDM wallet address
      status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'pending_activation' | 'inactive'
      commission_rate REAL NOT NULL DEFAULT 0.20, -- 20% of 0.5% platform fee
      override_rate REAL NOT NULL DEFAULT 0.10, -- 10% of 0.5% platform fee
      total_referred_volume_usd REAL NOT NULL DEFAULT 0.0,
      total_earnings_usd REAL NOT NULL DEFAULT 0.0,
      pending_balance_usd REAL NOT NULL DEFAULT 0.0,
      paid_balance_usd REAL NOT NULL DEFAULT 0.0,
      active_users_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 14. Affiliate User Referral Attribution
    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      id TEXT PRIMARY KEY,
      referred_wallet_address TEXT UNIQUE NOT NULL,
      referrer_wallet_address TEXT NOT NULL,
      referrer_role TEXT NOT NULL, -- 'partner' | 'bdm'
      bdm_wallet_address TEXT, -- Nullable; set if referrer is a Partner under a BDM
      total_volume_usd REAL NOT NULL DEFAULT 0.0,
      swaps_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_swap_at TEXT
    );

    -- 15. Affiliate Commissions & BDM Override Ledger
    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id TEXT PRIMARY KEY,
      affiliate_wallet_address TEXT NOT NULL,
      affiliate_role TEXT NOT NULL, -- 'partner' | 'bdm'
      commission_type TEXT NOT NULL, -- 'direct_partner' | 'direct_bdm' | 'bdm_override'
      source_partner_wallet TEXT,
      referred_user_wallet TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      swap_volume_usd REAL NOT NULL,
      platform_fee_usd REAL NOT NULL,
      commission_rate REAL NOT NULL,
      commission_amount_usd REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid'
      payout_id TEXT,
      created_at TEXT NOT NULL
    );

    -- 16. Affiliate Payout Requests
    CREATE TABLE IF NOT EXISTS affiliate_payouts (
      id TEXT PRIMARY KEY,
      affiliate_wallet_address TEXT NOT NULL,
      affiliate_role TEXT NOT NULL, -- 'partner' | 'bdm'
      amount_usd REAL NOT NULL,
      payout_address TEXT NOT NULL,
      preferred_network TEXT NOT NULL,
      preferred_token TEXT NOT NULL DEFAULT 'USDT',
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'paid' | 'rejected'
      tx_hash TEXT,
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT
    );

    -- Affiliate Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_aff_apps_wallet ON affiliate_applications(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_aff_apps_status ON affiliate_applications(status);
    CREATE INDEX IF NOT EXISTS idx_affiliates_wallet ON affiliates(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_affiliates_bdm ON affiliates(bdm_wallet_address);
    CREATE INDEX IF NOT EXISTS idx_aff_refs_referred ON affiliate_referrals(referred_wallet_address);
    CREATE INDEX IF NOT EXISTS idx_aff_refs_referrer ON affiliate_referrals(referrer_wallet_address);
    CREATE INDEX IF NOT EXISTS idx_aff_comm_wallet ON affiliate_commissions(affiliate_wallet_address);
    CREATE INDEX IF NOT EXISTS idx_aff_comm_tx ON affiliate_commissions(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_aff_payouts_wallet ON affiliate_payouts(affiliate_wallet_address);
  `);
  try {
    const tableInfo = db.prepare("PRAGMA table_info(swap_reward_claims)").all();
    const columnNames = tableInfo.map((col) => col.name);
    if (!columnNames.includes("cashback_amount_usd")) {
      db.exec("ALTER TABLE swap_reward_claims ADD COLUMN cashback_amount_usd REAL NOT NULL DEFAULT 0.0;");
    }
    if (!columnNames.includes("milestone_amount_usd")) {
      db.exec("ALTER TABLE swap_reward_claims ADD COLUMN milestone_amount_usd REAL NOT NULL DEFAULT 0.0;");
    }
    if (!columnNames.includes("referral_amount_usd")) {
      db.exec("ALTER TABLE swap_reward_claims ADD COLUMN referral_amount_usd REAL NOT NULL DEFAULT 0.0;");
    }
  } catch (err) {
  }
  const campaignId = "campaign_genesis_001";
  const existingCampaign = db.prepare("SELECT id FROM swap_campaigns WHERE slug = ?").get("genesis");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1e3).toISOString();
  if (!existingCampaign) {
    const insertCampaign = db.prepare(`
      INSERT INTO swap_campaigns (
        id, slug, title, description, status, start_date, end_date,
        total_budget_usd, spent_budget_usd, min_swap_usd,
        referral_reward_usd, referral_qualifying_vol_usd, cashback_enabled,
        cashback_percentage, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCampaign.run(
      campaignId,
      "genesis",
      "Nova Swap Genesis Campaign",
      "Complete your swaps and earn amazing rewards!",
      "active",
      now,
      endDate,
      5e4,
      // $50,000 budget
      0,
      1,
      // $1 minimum eligible swap
      5,
      // $5.00 USDT referral bonus
      2e3,
      // $2,000 volume required for referral qualification
      1,
      // 5% cashback active
      5,
      // 5% cashback percentage
      now,
      now
    );
  } else {
    db.prepare(`
      UPDATE swap_campaigns
      SET min_swap_usd = 1.0,
          referral_reward_usd = 5.0,
          referral_qualifying_vol_usd = 2000.0,
          cashback_enabled = 1,
          cashback_percentage = 5.0,
          description = 'Complete your swaps and earn amazing rewards!'
      WHERE slug = 'genesis'
    `).run();
  }
  const targetCampaignId = existingCampaign ? existingCampaign.id : campaignId;
  const upsertMilestone = db.prepare(`
    INSERT INTO swap_campaign_milestones (
      id, campaign_id, milestone_number, title, target_volume_usd,
      reward_amount_usd, reward_description, is_active, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id, milestone_number) DO UPDATE SET
      title = excluded.title,
      target_volume_usd = excluded.target_volume_usd,
      reward_amount_usd = excluded.reward_amount_usd,
      reward_description = excluded.reward_description,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order
  `);
  upsertMilestone.run(
    "ms_genesis_1",
    targetCampaignId,
    1,
    "Milestone 1",
    1e4,
    25,
    "$25 USDT Bonus Reward on reaching $10,000 swap volume",
    1,
    1,
    now
  );
  upsertMilestone.run(
    "ms_genesis_2",
    targetCampaignId,
    2,
    "Milestone 2",
    25e3,
    50,
    "$50 USDT Bonus Reward on reaching $25,000 swap volume",
    1,
    2,
    now
  );
  upsertMilestone.run(
    "ms_genesis_3",
    targetCampaignId,
    3,
    "Milestone 3",
    5e4,
    100,
    "$100 USDT Bonus Reward on reaching $50,000 swap volume",
    1,
    3,
    now
  );
}
initDb();

// server/notifications.ts
async function sendAdminClaimNotification(payload) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || "admin@novap2p.com";
  try {
    const eventId = "evt_" + Math.random().toString(36).substring(2, 12);
    db.prepare(`
      INSERT INTO swap_campaign_events (
        id, campaign_id, user_id, wallet_address, event_name, event_data, created_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).run(
      eventId,
      "campaign_genesis_001",
      payload.walletAddress,
      "claim_request_submitted",
      JSON.stringify({
        claimId: payload.claimId,
        amountUSD: payload.requestedAmountUSD,
        payoutAddress: payload.payoutAddress,
        network: payload.preferredNetwork,
        token: payload.preferredToken,
        breakdown: {
          cashback: payload.cashbackAmountUSD,
          milestones: payload.milestoneAmountUSD,
          referrals: payload.referralAmountUSD
        },
        adminRecipient: adminEmail
      }),
      (/* @__PURE__ */ new Date()).toISOString()
    );
  } catch (err) {
    console.error("Failed to log in-app admin notification:", err);
  }
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpHost && smtpUser && smtpPass) {
      console.log(`[Email Notification] Sending claim alert email for ${payload.claimId} to ${adminEmail}`);
    } else {
      console.log(`[Admin Notification] Configured Admin Email: ${adminEmail} | Claim ID: ${payload.claimId} for $${payload.requestedAmountUSD.toFixed(2)} USDT by ${payload.walletAddress}`);
    }
  } catch (emailErr) {
    console.warn("[Email Notification] Notification email delivery skipped/failed (claim safely recorded):", emailErr);
  }
}

// server/affiliateApi.ts
import { Router } from "express";
import crypto from "crypto";
var affiliateRouter = Router();
var ADMIN_KEY = process.env.SWAP_ADMIN_KEY || "nova-genesis-admin-2026";
function verifyAffiliateAdmin(req, res, next) {
  const authHeader = req.headers["x-admin-key"] || req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (token !== ADMIN_KEY) {
    return res.status(403).json({ error: "Invalid admin credentials" });
  }
  next();
}
function signReviewToken(appId) {
  return crypto.createHmac("sha256", ADMIN_KEY).update(`review:${appId}`).digest("hex");
}
function verifyReviewToken(appId, token) {
  if (!appId || !token) return false;
  const expected = signReviewToken(appId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(token).trim(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function processApplicationDecision(params) {
  const { appRecord, action, assignRole, bdmWalletAddress, adminNotes } = params;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const cleanWallet = String(appRecord.wallet_address).toLowerCase();
  if (action === "reject") {
    const cleanReason = adminNotes ? String(adminNotes).trim() : "";
    db.prepare(`
      UPDATE affiliate_applications
      SET status = 'rejected', admin_notes = ?, reviewed_by = 'admin', reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(cleanReason || null, now, now, appRecord.id);
    return {
      success: true,
      status: "rejected",
      role: appRecord.role,
      walletAddress: cleanWallet,
      applicantEmail: appRecord.email,
      applicantName: appRecord.full_name,
      rejectionReason: cleanReason || null
    };
  }
  const targetRole = assignRole === "bdm" || assignRole === "partner" ? assignRole : appRecord.role;
  const mappedBdm = bdmWalletAddress ? String(bdmWalletAddress).trim().toLowerCase() : appRecord.bdm_wallet_address || null;
  db.prepare(`
    UPDATE affiliate_applications
    SET status = 'approved', role = ?, bdm_wallet_address = ?, admin_notes = ?, reviewed_by = 'admin', reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(targetRole, mappedBdm, adminNotes ? String(adminNotes).trim() : null, now, now, appRecord.id);
  const existing = db.prepare("SELECT id FROM affiliates WHERE LOWER(wallet_address) = ?").get(cleanWallet);
  if (!existing) {
    db.prepare(`
      INSERT INTO affiliates (
        id, wallet_address, role, application_id, full_name, email,
        telegram_username, bdm_wallet_address, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      "aff_" + crypto.randomUUID(),
      cleanWallet,
      targetRole,
      appRecord.id,
      appRecord.full_name,
      appRecord.email,
      appRecord.telegram_username,
      targetRole === "partner" ? mappedBdm : null,
      now,
      now
    );
  } else {
    db.prepare(`
      UPDATE affiliates
      SET role = ?, bdm_wallet_address = ?, status = 'active', updated_at = ?
      WHERE id = ?
    `).run(targetRole, targetRole === "partner" ? mappedBdm : null, now, existing.id);
  }
  return {
    success: true,
    status: "approved",
    role: targetRole,
    walletAddress: cleanWallet,
    applicantEmail: appRecord.email,
    applicantName: appRecord.full_name,
    rejectionReason: null
  };
}
function bindAffiliateReferral(referredWallet, referrerWallet) {
  try {
    const cleanReferred = referredWallet.trim().toLowerCase();
    const cleanReferrer = referrerWallet.trim().toLowerCase();
    if (!cleanReferred || !cleanReferrer || cleanReferred === cleanReferrer) {
      return false;
    }
    const affiliate = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?").get(cleanReferrer, "active");
    if (!affiliate) {
      return false;
    }
    const existingAttribution = db.prepare("SELECT id FROM affiliate_referrals WHERE LOWER(referred_wallet_address) = ?").get(cleanReferred);
    if (existingAttribution) {
      return false;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const refId = "affref_" + crypto.randomUUID();
    const bdmWallet = affiliate.role === "partner" && affiliate.bdm_wallet_address ? String(affiliate.bdm_wallet_address).toLowerCase() : null;
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
    console.warn("[Affiliate] bindAffiliateReferral warning:", err);
    return false;
  }
}
function processAffiliateSwapCommission(params) {
  try {
    const cleanTrader = params.traderWallet.trim().toLowerCase();
    if (!cleanTrader || params.volumeUSD <= 0 || !params.transactionId) return;
    const existingComm = db.prepare("SELECT id FROM affiliate_commissions WHERE transaction_id = ?").get(params.transactionId);
    if (existingComm) return;
    const attribution = db.prepare("SELECT * FROM affiliate_referrals WHERE LOWER(referred_wallet_address) = ?").get(cleanTrader);
    if (!attribution) return;
    if (attribution.referrer_wallet_address.toLowerCase() === cleanTrader) return;
    const now = params.verifiedAt || (/* @__PURE__ */ new Date()).toISOString();
    const platformFeeUSD = Number((params.volumeUSD * 5e-3).toFixed(6));
    db.prepare(`
      UPDATE affiliate_referrals
      SET total_volume_usd = total_volume_usd + ?, swaps_count = swaps_count + 1, last_swap_at = ?
      WHERE id = ?
    `).run(params.volumeUSD, now, attribution.id);
    const referrer = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?").get(attribution.referrer_wallet_address.toLowerCase(), "active");
    if (!referrer) return;
    const directRate = 0.2;
    const directCommissionUSD = Number((platformFeeUSD * directRate).toFixed(4));
    const commissionType = referrer.role === "bdm" ? "direct_bdm" : "direct_partner";
    if (directCommissionUSD > 0) {
      db.prepare(`
        INSERT INTO affiliate_commissions (
          id, affiliate_wallet_address, affiliate_role, commission_type,
          source_partner_wallet, referred_user_wallet, transaction_id,
          swap_volume_usd, platform_fee_usd, commission_rate, commission_amount_usd,
          status, payout_id, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)
      `).run(
        "comm_" + crypto.randomUUID(),
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
    const bdmWallet = referrer.bdm_wallet_address || attribution.bdm_wallet_address;
    if (referrer.role === "partner" && bdmWallet && bdmWallet.toLowerCase() !== cleanTrader) {
      const bdm = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND role = ? AND status = ?").get(bdmWallet.toLowerCase(), "bdm", "active");
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
            "comm_" + crypto.randomUUID(),
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
  } catch (err) {
    console.warn("[Affiliate] processAffiliateSwapCommission error:", err);
  }
}
affiliateRouter.get("/status/:walletAddress", (req, res) => {
  try {
    const cleanWallet = String(req.params.walletAddress || "").trim().toLowerCase();
    if (!cleanWallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    const affiliate = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ?").get(cleanWallet);
    const latestApplication = db.prepare("SELECT * FROM affiliate_applications WHERE LOWER(wallet_address) = ? ORDER BY created_at DESC LIMIT 1").get(cleanWallet);
    if (affiliate) {
      return res.json({
        walletAddress: cleanWallet,
        isApproved: affiliate.status === "active",
        status: affiliate.status,
        role: affiliate.role,
        // 'partner' | 'bdm'
        affiliate,
        application: latestApplication || null
      });
    }
    return res.json({
      walletAddress: cleanWallet,
      isApproved: false,
      status: latestApplication ? latestApplication.status : "none",
      role: latestApplication ? latestApplication.role : null,
      affiliate: null,
      application: latestApplication || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/apply", (req, res) => {
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
      bdmWalletAddress
    } = req.body;
    const cleanRole = role === "bdm" ? "bdm" : "partner";
    const cleanWallet = String(walletAddress || "").trim().toLowerCase();
    if (!cleanWallet || !fullName || !email || !telegramUsername || !twitterLink || !telegramChannelLink) {
      return res.status(400).json({ error: "Please complete all required application fields" });
    }
    const existingAffiliate = db.prepare("SELECT id, role, status FROM affiliates WHERE LOWER(wallet_address) = ?").get(cleanWallet);
    if (existingAffiliate) {
      return res.status(400).json({
        error: `This wallet is already registered as an approved ${existingAffiliate.role.toUpperCase()}.`,
        role: existingAffiliate.role
      });
    }
    const existingPending = db.prepare("SELECT id, role FROM affiliate_applications WHERE LOWER(wallet_address) = ? AND status = ?").get(cleanWallet, "pending");
    if (existingPending) {
      return res.status(400).json({
        error: `An application for this wallet (${existingPending.role.toUpperCase()}) is already pending review.`
      });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const appId = "app_" + crypto.randomUUID();
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
      fullName.trim(),
      email.trim(),
      telegramUsername.trim(),
      twitterLink.trim(),
      youtubeLink ? String(youtubeLink).trim() : null,
      telegramChannelLink.trim(),
      audienceSize ? String(audienceSize).trim() : null,
      marketingExperience ? String(marketingExperience).trim() : null,
      manageablePartnersCount ? String(manageablePartnersCount).trim() : null,
      message ? String(message).trim() : null,
      bdmWalletAddress ? String(bdmWalletAddress).trim().toLowerCase() : null,
      now,
      now
    );
    try {
      db.prepare(`
        INSERT INTO swap_campaign_events (
          id, campaign_id, wallet_address, event_name, event_data, created_at
        ) VALUES (?, 'campaign_genesis_001', ?, ?, ?, ?)
      `).run(
        "evt_" + crypto.randomUUID(),
        cleanWallet,
        `affiliate_${cleanRole}_applied`,
        JSON.stringify({ appId, fullName, email, telegramUsername }),
        now
      );
    } catch {
    }
    res.json({
      success: true,
      applicationId: appId,
      reviewToken: signReviewToken(appId),
      role: cleanRole,
      status: "pending",
      message: `Your ${cleanRole === "bdm" ? "BDM" : "Partner"} application has been submitted and will be reviewed within 24 hours.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/track-ref", (req, res) => {
  try {
    const { refWallet, traderWallet } = req.body;
    if (!refWallet) {
      return res.status(400).json({ error: "refWallet is required" });
    }
    const cleanRef = String(refWallet).trim().toLowerCase();
    const affiliate = db.prepare("SELECT id, wallet_address, role, status FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?").get(cleanRef, "active");
    let bound = false;
    if (affiliate && traderWallet) {
      bound = bindAffiliateReferral(String(traderWallet), cleanRef);
    }
    res.json({
      success: true,
      valid: !!affiliate,
      referrerRole: affiliate?.role || null,
      bound
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.get("/partner/dashboard/:walletAddress", (req, res) => {
  try {
    const cleanWallet = String(req.params.walletAddress || "").trim().toLowerCase();
    const partner = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND role = ?").get(cleanWallet, "partner");
    if (!partner) {
      return res.status(403).json({ error: "Wallet is not an approved Partner" });
    }
    const commissions = db.prepare(`
        SELECT * FROM affiliate_commissions
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 100
      `).all(cleanWallet);
    const referrals = db.prepare(`
        SELECT * FROM affiliate_referrals
        WHERE LOWER(referrer_wallet_address) = ?
        ORDER BY total_volume_usd DESC, created_at DESC
        LIMIT 100
      `).all(cleanWallet);
    const payouts = db.prepare(`
        SELECT * FROM affiliate_payouts
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(cleanWallet);
    const activeUsers = referrals.length;
    const referralsThisMonth = referrals.filter((r) => {
      const created = new Date(r.created_at).getTime();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1e3;
      return created >= thirtyDaysAgo;
    }).length;
    res.json({
      partner: {
        walletAddress: partner.wallet_address,
        fullName: partner.full_name,
        email: partner.email,
        telegramUsername: partner.telegram_username,
        status: partner.status,
        bdmWalletAddress: partner.bdm_wallet_address,
        referralLink: `https://novap2p.com/swap?ref=${partner.wallet_address}`,
        commissionRatePct: 20,
        // 20% of 0.5% fee
        effectiveVolumePct: 0.1,
        // 0.10% of volume
        createdAt: partner.created_at
      },
      stats: {
        totalEarningsUSD: Number((partner.total_earnings_usd || 0).toFixed(4)),
        pendingBalanceUSD: Number((partner.pending_balance_usd || 0).toFixed(4)),
        paidBalanceUSD: Number((partner.paid_balance_usd || 0).toFixed(4)),
        referredVolumeUSD: Number((partner.total_referred_volume_usd || 0).toFixed(2)),
        activeUsers,
        referralsThisMonth,
        minWithdrawalUSD: 100
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
        status: c.status
        // 'paid' | 'pending'
      })),
      referrals: referrals.map((r) => ({
        id: r.id,
        walletAddress: r.referred_wallet_address,
        totalVolumeUSD: r.total_volume_usd,
        swapsCount: r.swaps_count,
        joinedAt: r.created_at,
        lastSwapAt: r.last_swap_at
      })),
      payouts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.get("/bdm/dashboard/:walletAddress", (req, res) => {
  try {
    const cleanWallet = String(req.params.walletAddress || "").trim().toLowerCase();
    const bdm = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND role = ?").get(cleanWallet, "bdm");
    if (!bdm) {
      return res.status(403).json({ error: "Wallet is not an approved BDM" });
    }
    const managedPartners = db.prepare(`
        SELECT * FROM affiliates
        WHERE LOWER(bdm_wallet_address) = ? AND role = 'partner'
        ORDER BY total_referred_volume_usd DESC, created_at DESC
      `).all(cleanWallet);
    const partnerRows = managedPartners.map((p) => {
      const overrideRow = db.prepare(`
          SELECT COALESCE(SUM(commission_amount_usd), 0) as total_override
          FROM affiliate_commissions
          WHERE LOWER(affiliate_wallet_address) = ?
            AND commission_type = 'bdm_override'
            AND LOWER(source_partner_wallet) = ?
        `).get(cleanWallet, p.wallet_address.toLowerCase());
      return {
        id: p.id,
        walletAddress: p.wallet_address,
        fullName: p.full_name,
        telegramUsername: p.telegram_username,
        referredVolumeUSD: Number((p.total_referred_volume_usd || 0).toFixed(2)),
        partnerEarningsUSD: Number((p.total_earnings_usd || 0).toFixed(4)),
        bdmOverrideUSD: Number((overrideRow?.total_override || 0).toFixed(4)),
        activeUsersCount: p.active_users_count || 0,
        status: p.status,
        // 'active' | 'pending_activation' | 'inactive'
        joinedAt: p.created_at
      };
    });
    const partnersOnlyVolumeUSD = partnerRows.reduce((sum, p) => sum + p.referredVolumeUSD, 0);
    const directBdmRow = db.prepare(`
        SELECT COALESCE(SUM(total_volume_usd), 0) as direct_volume
        FROM affiliate_referrals
        WHERE LOWER(referrer_wallet_address) = ? AND referrer_role = 'bdm'
      `).get(cleanWallet);
    const directBdmVolumeUSD = Number((directBdmRow?.direct_volume || 0).toFixed(2));
    const totalManagedVolumeUSD = partnersOnlyVolumeUSD + directBdmVolumeUSD;
    const activePartnersCount = partnerRows.filter((p) => p.status === "active").length;
    const commissions = db.prepare(`
        SELECT * FROM affiliate_commissions
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 100
      `).all(cleanWallet);
    const payouts = db.prepare(`
        SELECT * FROM affiliate_payouts
        WHERE LOWER(affiliate_wallet_address) = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(cleanWallet);
    res.json({
      bdm: {
        walletAddress: bdm.wallet_address,
        fullName: bdm.full_name,
        email: bdm.email,
        telegramUsername: bdm.telegram_username,
        status: bdm.status,
        referralLink: `https://novap2p.com/swap?ref=${bdm.wallet_address}`,
        directCommissionRatePct: 20,
        // 20% of fee on direct BDM link
        overrideRatePct: 10,
        // 10% of fee on managed partners
        createdAt: bdm.created_at
      },
      stats: {
        totalManagedVolumeUSD: Number(totalManagedVolumeUSD.toFixed(2)),
        partnersOnlyVolumeUSD: Number(partnersOnlyVolumeUSD.toFixed(2)),
        totalEarningsUSD: Number((bdm.total_earnings_usd || 0).toFixed(4)),
        pendingPayoutUSD: Number((bdm.pending_balance_usd || 0).toFixed(4)),
        paidBalanceUSD: Number((bdm.paid_balance_usd || 0).toFixed(4)),
        activePartnersCount,
        totalPartnersCount: partnerRows.length,
        minWithdrawalUSD: 100
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
        status: c.status
      })),
      payouts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/payout/request", (req, res) => {
  try {
    const { walletAddress, payoutAddress, preferredNetwork, preferredToken } = req.body;
    const cleanWallet = String(walletAddress || "").trim().toLowerCase();
    if (!cleanWallet || !payoutAddress || !preferredNetwork) {
      return res.status(400).json({ error: "Wallet address, payout destination, and network are required" });
    }
    const affiliate = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?").get(cleanWallet, "active");
    if (!affiliate) {
      return res.status(403).json({ error: "Active approved affiliate account required" });
    }
    const availableBalance = Number((affiliate.pending_balance_usd || 0).toFixed(2));
    if (availableBalance < 100) {
      return res.status(400).json({
        error: `Minimum payout is $100.00. Your current pending balance is $${availableBalance.toFixed(2)}.`
      });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payoutId = "affpay_" + crypto.randomUUID();
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
      preferredToken ? String(preferredToken).trim() : "USDT",
      now,
      now
    );
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
    res.json({
      success: true,
      payoutId,
      amountUSD: availableBalance,
      status: "pending",
      message: "Payout request submitted! Processing takes within 24 hours."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.get("/admin/overview", verifyAffiliateAdmin, (req, res) => {
  try {
    const applications = db.prepare("SELECT * FROM affiliate_applications ORDER BY created_at DESC").all();
    const affiliates = db.prepare("SELECT * FROM affiliates ORDER BY total_referred_volume_usd DESC, created_at DESC").all();
    const payouts = db.prepare("SELECT * FROM affiliate_payouts ORDER BY created_at DESC").all();
    res.json({
      applications,
      affiliates,
      payouts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/admin/applications/:id/review", verifyAffiliateAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { action, assignRole, bdmWalletAddress, adminNotes } = req.body;
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Invalid action" });
    }
    const appRecord = db.prepare("SELECT * FROM affiliate_applications WHERE id = ?").get(id);
    if (!appRecord) {
      return res.status(404).json({ error: "Application not found" });
    }
    if (action === "reject" && (!adminNotes || !String(adminNotes).trim())) {
      return res.status(400).json({ error: "Please provide a rejection reason / query for the applicant." });
    }
    const result = processApplicationDecision({
      appRecord,
      action,
      assignRole,
      bdmWalletAddress,
      adminNotes
    });
    return res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.get("/review-info", (req, res) => {
  try {
    const id = String(req.query.id || "").trim();
    const token = String(req.query.token || "").trim();
    if (!verifyReviewToken(id, token)) {
      return res.status(403).json({ error: "Invalid or expired review link." });
    }
    const appRecord = db.prepare("SELECT * FROM affiliate_applications WHERE id = ?").get(id);
    if (!appRecord) {
      return res.status(404).json({ error: "Application not found." });
    }
    return res.json({
      application: appRecord
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/review-action", (req, res) => {
  try {
    const { id, token, action, assignRole, bdmWalletAddress, adminNotes } = req.body;
    if (!verifyReviewToken(String(id || ""), String(token || ""))) {
      return res.status(403).json({ error: "Invalid or expired review signature." });
    }
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Action must be approve or reject." });
    }
    const appRecord = db.prepare("SELECT * FROM affiliate_applications WHERE id = ?").get(String(id));
    if (!appRecord) {
      return res.status(404).json({ error: "Application not found." });
    }
    if (action === "reject" && (!adminNotes || !String(adminNotes).trim())) {
      return res.status(400).json({ error: "Rejection reason / query is required before rejecting." });
    }
    const result = processApplicationDecision({
      appRecord,
      action,
      assignRole,
      bdmWalletAddress,
      adminNotes
    });
    return res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/admin/affiliates/:walletAddress/update", verifyAffiliateAdmin, (req, res) => {
  try {
    const cleanWallet = String(req.params.walletAddress || "").trim().toLowerCase();
    const { status, bdmWalletAddress } = req.body;
    const existing = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ?").get(cleanWallet);
    if (!existing) {
      return res.status(404).json({ error: "Affiliate not found" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newStatus = status || existing.status;
    const newBdm = bdmWalletAddress !== void 0 ? bdmWalletAddress ? String(bdmWalletAddress).trim().toLowerCase() : null : existing.bdm_wallet_address;
    db.prepare(`
      UPDATE affiliates
      SET status = ?, bdm_wallet_address = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, newBdm, now, existing.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
affiliateRouter.post("/admin/payouts/:id/pay", verifyAffiliateAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { txHash, adminNotes } = req.body;
    const payout = db.prepare("SELECT * FROM affiliate_payouts WHERE id = ?").get(id);
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
    res.json({ success: true, status: "paid" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server/api.ts
import { ethers } from "ethers";
import crypto2 from "crypto";
var apiRouter = Router2();
var ADMIN_KEY2 = process.env.SWAP_ADMIN_KEY || "nova-genesis-admin-2026";
var ENABLED_CHAINS = [1, 56, 137, 42161, 10, 8453];
var pendingNonces = /* @__PURE__ */ new Map();
function getOrCreateNonce(walletAddress) {
  const normalized = walletAddress.toLowerCase();
  const now = Date.now();
  const existing = pendingNonces.get(normalized);
  if (existing && now - existing.timestamp < 10 * 60 * 1e3) {
    return existing.nonce;
  }
  const nonce = crypto2.randomBytes(16).toString("hex");
  pendingNonces.set(normalized, { nonce, timestamp: now });
  return nonce;
}
function verifyAdmin(req, res, next) {
  const authHeader = req.headers["x-admin-key"] || req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (token !== ADMIN_KEY2) {
    return res.status(403).json({ error: "Invalid admin credentials" });
  }
  next();
}
apiRouter.get("/campaign", (req, res) => {
  try {
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE status != ? ORDER BY created_at DESC LIMIT 1").get("ended");
    if (!campaign) {
      return res.status(404).json({ error: "No active campaign found" });
    }
    const milestones = db.prepare(`
      SELECT * FROM swap_campaign_milestones 
      WHERE campaign_id = ? AND is_active = 1 
      ORDER BY sort_order ASC, target_volume_usd ASC
    `).all(campaign.id);
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT wallet_address) as total_swappers,
        COALESCE(SUM(total_volume_usd), 0) as total_verified_volume,
        COALESCE(SUM(eligible_swaps_count), 0) as total_swaps_count
      FROM swap_campaign_users
      WHERE campaign_id = ?
    `).get(campaign.id);
    const remainingBudget = Math.max(0, campaign.total_budget_usd - campaign.spent_budget_usd);
    const now = Date.now();
    const end = new Date(campaign.end_date).getTime();
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (1e3 * 60 * 60 * 24)));
    res.json({
      campaign: {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        daysRemaining,
        minSwapUSD: campaign.min_swap_usd,
        totalBudgetUSD: campaign.total_budget_usd,
        spentBudgetUSD: campaign.spent_budget_usd,
        remainingBudgetUSD: remainingBudget,
        referralRewardUSD: campaign.referral_reward_usd,
        referralQualifyingVolUSD: campaign.referral_qualifying_vol_usd,
        cashbackEnabled: Boolean(campaign.cashback_enabled),
        cashbackPercentage: campaign.cashback_percentage,
        enabledChains: ENABLED_CHAINS
      },
      milestones: milestones.map((m) => ({
        id: m.id,
        milestoneNumber: m.milestone_number,
        title: m.title,
        targetVolumeUSD: m.target_volume_usd,
        rewardAmountUSD: m.reward_amount_usd,
        rewardDescription: m.reward_description
      })),
      stats: {
        totalSwappers: stats.total_swappers || 0,
        totalVerifiedVolumeUSD: stats.total_verified_volume || 0,
        totalSwapsCount: stats.total_swaps_count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/track-referral", (req, res) => {
  try {
    const { refCode } = req.body;
    if (!refCode) {
      return res.status(400).json({ error: "Referral code is required" });
    }
    const cleanCode = String(refCode).trim().toUpperCase();
    const referrer = db.prepare("SELECT id, wallet_address FROM swap_campaign_users WHERE UPPER(referral_code) = ?").get(cleanCode);
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, user_id, event_name, event_data, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_" + crypto2.randomUUID(),
      "campaign_genesis_001",
      referrer ? referrer.id : null,
      "referral_captured",
      JSON.stringify({ refCode: cleanCode, valid: !!referrer }),
      String(ip || ""),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.json({
      success: true,
      valid: !!referrer,
      referrerCode: cleanCode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/events", (req, res) => {
  try {
    const { eventName, walletAddress, eventData } = req.body;
    if (!eventName) {
      return res.status(400).json({ error: "Event name is required" });
    }
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, wallet_address, event_name, event_data, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_" + crypto2.randomUUID(),
      "campaign_genesis_001",
      walletAddress ? String(walletAddress).toLowerCase() : null,
      eventName,
      eventData ? JSON.stringify(eventData) : null,
      String(ip || ""),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/auth/nonce", (req, res) => {
  try {
    const { address } = req.query;
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Wallet address required" });
    }
    const nonce = getOrCreateNonce(address);
    const message = `Sign this message to verify wallet ownership for Nova Swap Genesis Campaign.

Wallet: ${address.toLowerCase()}
Nonce: ${nonce}
Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}`;
    res.json({ nonce, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/auth/verify", async (req, res) => {
  try {
    const { address, signature, message, chainId, refCode } = req.body;
    if (!address || !signature || !message) {
      return res.status(400).json({ error: "Address, signature and message are required" });
    }
    const normalizedAddress = address.toLowerCase();
    let recoveredAddress = "";
    try {
      recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    } catch (e) {
      return res.status(400).json({ error: "Signature verification failed: " + e.message });
    }
    if (recoveredAddress !== normalizedAddress) {
      return res.status(400).json({ error: "Recovered address does not match claimed wallet address" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const campaignId = "campaign_genesis_001";
    let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
    if (!user) {
      let newRefCode = "";
      while (true) {
        newRefCode = "NP" + crypto2.randomBytes(3).toString("hex").toUpperCase();
        const exists = db.prepare("SELECT id FROM swap_campaign_users WHERE referral_code = ?").get(newRefCode);
        if (!exists) break;
      }
      let referredByUserId = null;
      if (refCode) {
        const cleanRefCode = String(refCode).trim().toUpperCase();
        const referrer = db.prepare("SELECT id, wallet_address FROM swap_campaign_users WHERE UPPER(referral_code) = ?").get(cleanRefCode);
        if (referrer && referrer.wallet_address.toLowerCase() !== normalizedAddress) {
          referredByUserId = referrer.id;
        }
        bindAffiliateReferral(normalizedAddress, String(refCode));
      }
      const userId = "usr_" + crypto2.randomUUID();
      db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        campaignId,
        normalizedAddress,
        chainId ? Number(chainId) : 1,
        signature,
        now,
        newRefCode,
        referredByUserId,
        0,
        0,
        0,
        now,
        now
      );
      if (referredByUserId) {
        const ip2 = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        db.prepare(`
          INSERT OR IGNORE INTO swap_referrals (
            id, campaign_id, referrer_user_id, referred_user_id, referral_code,
            visitor_ip, status, qualifying_volume_usd, reward_amount_usd, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "ref_" + crypto2.randomUUID(),
          campaignId,
          referredByUserId,
          userId,
          refCode,
          String(ip2 || ""),
          "connected",
          0,
          0,
          now
        );
      }
      user = db.prepare("SELECT * FROM swap_campaign_users WHERE id = ?").get(userId);
    } else {
      db.prepare(`
        UPDATE swap_campaign_users 
        SET signature = ?, verified_at = ?, chain_id = ?, last_active_at = ?
        WHERE id = ?
      `).run(signature, now, chainId ? Number(chainId) : user.chain_id, now, user.id);
    }
    pendingNonces.delete(normalizedAddress);
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, user_id, wallet_address, event_name, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("evt_" + crypto2.randomUUID(), campaignId, user.id, normalizedAddress, "wallet_connected", String(ip || ""), now);
    res.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        chainId: user.chain_id,
        referralCode: user.referral_code,
        referralLink: `https://novap2p.com/?ref=${user.referral_code}`,
        totalVolumeUSD: user.total_volume_usd,
        eligibleSwapsCount: user.eligible_swaps_count,
        verifiedAt: user.verified_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function recordSwapTransactionInternal(params) {
  const existingTx = db.prepare("SELECT id FROM swap_transactions WHERE chain_id = ? AND tx_hash = ?").get(params.numericChainId, params.normalizedTxHash);
  if (existingTx) {
    return { success: false, newlyUnlocked: [], duplicate: true };
  }
  const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(params.campaignId);
  const minSwapUSD = campaign ? campaign.min_swap_usd : 1;
  if (params.volumeUSD < minSwapUSD) {
    return { success: false, newlyUnlocked: [], belowMin: true };
  }
  const now = params.verifiedAt || (/* @__PURE__ */ new Date()).toISOString();
  const txId = "tx_" + crypto2.randomUUID();
  db.prepare(`
    INSERT INTO swap_transactions (
      id, campaign_id, user_id, wallet_address, chain_id, tx_hash,
      lifi_route_id, from_token_symbol, from_token_address, to_token_symbol,
      to_token_address, from_amount, to_amount, volume_usd, execution_status,
      verification_status, verification_source, verified_at, raw_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    txId,
    params.campaignId,
    params.userId,
    params.normalizedAddress,
    params.numericChainId,
    params.normalizedTxHash,
    params.lifiRouteId || null,
    typeof params.fromToken === "string" ? params.fromToken : params.fromToken?.symbol || null,
    params.fromToken?.address || null,
    typeof params.toToken === "string" ? params.toToken : params.toToken?.symbol || null,
    params.toToken?.address || null,
    params.fromAmount ? String(params.fromAmount) : null,
    params.toAmount ? String(params.toAmount) : null,
    params.volumeUSD,
    "DONE",
    "VERIFIED",
    params.verificationSource || "lifi_api",
    now,
    params.rawRouteData ? JSON.stringify(params.rawRouteData) : null,
    now
  );
  const user = db.prepare("SELECT * FROM swap_campaign_users WHERE id = ?").get(params.userId);
  const newTotalVolume = Number(((user?.total_volume_usd || 0) + params.volumeUSD).toFixed(4));
  const newSwapsCount = (user?.eligible_swaps_count || 0) + 1;
  db.prepare(`
    UPDATE swap_campaign_users 
    SET total_volume_usd = ?, eligible_swaps_count = ?, last_active_at = ?
    WHERE id = ?
  `).run(newTotalVolume, newSwapsCount, now, params.userId);
  if (campaign && campaign.cashback_enabled) {
    const novaFeeCollectedUSD = params.volumeUSD * 5e-3;
    const cashbackRate = (campaign.cashback_percentage || 5) / 100;
    const creditedCashbackUSD = Number((novaFeeCollectedUSD * cashbackRate).toFixed(4));
    if (creditedCashbackUSD > 0) {
      const cbId = "cb_" + crypto2.randomUUID();
      db.prepare(`
        INSERT INTO swap_cashback_ledger (
          id, campaign_id, user_id, wallet_address, transaction_id,
          swap_volume_usd, nova_fee_usd, cashback_rate, cashback_amount_usd,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'credited', ?)
      `).run(
        cbId,
        params.campaignId,
        params.userId,
        params.normalizedAddress,
        txId,
        params.volumeUSD,
        novaFeeCollectedUSD,
        cashbackRate,
        creditedCashbackUSD,
        now
      );
      const cbRewardId = "rwd_cb_" + crypto2.randomUUID();
      db.prepare(`
        INSERT INTO swap_rewards (
          id, campaign_id, user_id, milestone_id, reward_type,
          amount_usd, status, unlocked_at, created_at
        ) VALUES (?, ?, ?, NULL, 'cashback', ?, 'unlocked', ?, ?)
      `).run(cbRewardId, params.campaignId, params.userId, creditedCashbackUSD, now, now);
    }
  }
  const milestones = db.prepare(`
    SELECT * FROM swap_campaign_milestones 
    WHERE campaign_id = ? AND is_active = 1
  `).all(params.campaignId);
  const newlyUnlocked = [];
  milestones.forEach((m) => {
    if (newTotalVolume >= m.target_volume_usd) {
      const existingReward = db.prepare(`
        SELECT id FROM swap_rewards WHERE user_id = ? AND milestone_id = ?
      `).get(params.userId, m.id);
      if (!existingReward) {
        const rewardId = "rwd_" + crypto2.randomUUID();
        db.prepare(`
          INSERT INTO swap_rewards (
            id, campaign_id, user_id, milestone_id, reward_type,
            amount_usd, status, unlocked_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          rewardId,
          params.campaignId,
          params.userId,
          m.id,
          "milestone",
          m.reward_amount_usd,
          "unlocked",
          now,
          now
        );
        newlyUnlocked.push(m.title);
      }
    }
  });
  if (user?.referred_by_user_id) {
    const referral = db.prepare(`
      SELECT * FROM swap_referrals 
      WHERE campaign_id = ? AND referred_user_id = ?
    `).get(params.campaignId, params.userId);
    if (referral && referral.status === "connected") {
      if (newTotalVolume >= campaign.referral_qualifying_vol_usd) {
        const refRewardAmount = campaign.referral_reward_usd || 5;
        db.prepare(`
          UPDATE swap_referrals 
          SET status = 'qualified', qualifying_volume_usd = ?, reward_amount_usd = ?, qualified_at = ?
          WHERE id = ?
        `).run(newTotalVolume, refRewardAmount, now, referral.id);
        const refRewardId = "rwd_ref_" + crypto2.randomUUID();
        db.prepare(`
          INSERT INTO swap_rewards (
            id, campaign_id, user_id, milestone_id, reward_type,
            amount_usd, status, unlocked_at, created_at
          ) VALUES (?, ?, ?, NULL, 'referral', ?, 'unlocked', ?, ?)
        `).run(refRewardId, params.campaignId, user.referred_by_user_id, refRewardAmount, now, now);
      }
    }
  }
  processAffiliateSwapCommission({
    traderWallet: params.normalizedAddress,
    transactionId: txId,
    volumeUSD: params.volumeUSD,
    verifiedAt: now
  });
  return { success: true, newlyUnlocked, txId };
}
var userSyncCache = /* @__PURE__ */ new Map();
async function syncUserTransfersFromLiFi(walletAddress, campaignId = "campaign_genesis_001") {
  const normalized = walletAddress.toLowerCase();
  const now = Date.now();
  const lastSync = userSyncCache.get(normalized) || 0;
  if (now - lastSync < 3500) return;
  userSyncCache.set(normalized, now);
  try {
    let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalized);
    if (!user) {
      let newRefCode = "";
      while (true) {
        newRefCode = "NOVA" + crypto2.randomBytes(3).toString("hex").toUpperCase();
        const exists = db.prepare("SELECT id FROM swap_campaign_users WHERE referral_code = ?").get(newRefCode);
        if (!exists) break;
      }
      const userId = "usr_" + crypto2.randomUUID();
      const isoNow = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        campaignId,
        normalized,
        1,
        "auto_connected",
        isoNow,
        newRefCode,
        null,
        0,
        0,
        0,
        isoNow,
        isoNow
      );
      user = db.prepare("SELECT * FROM swap_campaign_users WHERE id = ?").get(userId);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e3);
    const lifiRes = await fetch(`https://li.quest/v1/analytics/transfers?wallet=${encodeURIComponent(normalized)}`, {
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (lifiRes.ok) {
      const data = await lifiRes.json();
      const transfers = Array.isArray(data?.transfers) ? data.transfers : [];
      for (const t of transfers) {
        if (t.status !== "DONE") continue;
        const txHash = (t.sending?.txHash || t.receiving?.txHash || t.transactionId || "").toLowerCase();
        if (!txHash) continue;
        const chainId = Number(t.sending?.chainId || t.receiving?.chainId || 56);
        const volumeUSD = parseFloat(t.sending?.amountUSD || t.receiving?.amountUSD || "0");
        if (isNaN(volumeUSD) || volumeUSD <= 0) continue;
        const fromToken = t.sending?.token?.symbol || "USDT";
        const fromTokenAddress = t.sending?.token?.address;
        const toToken = t.receiving?.token?.symbol || "BNB";
        const toTokenAddress = t.receiving?.token?.address;
        const fromAmount = t.sending?.amount;
        const toAmount = t.receiving?.amount;
        const verifiedAt = t.sending?.timestamp ? new Date(t.sending.timestamp * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        recordSwapTransactionInternal({
          campaignId,
          userId: user.id,
          normalizedAddress: normalized,
          numericChainId: chainId,
          normalizedTxHash: txHash,
          volumeUSD,
          fromToken: { symbol: fromToken, address: fromTokenAddress },
          toToken: { symbol: toToken, address: toTokenAddress },
          fromAmount,
          toAmount,
          lifiRouteId: t.transactionId || null,
          verificationSource: "lifi_analytics_api",
          verifiedAt
        });
      }
    }
  } catch (err) {
    console.warn(`[LI.FI Sync] Auto-sync skipped for ${normalized}:`, err?.message || err);
  }
}
apiRouter.get("/user/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }
    const normalizedAddress = walletAddress.toLowerCase();
    const campaignId = "campaign_genesis_001";
    await syncUserTransfersFromLiFi(normalizedAddress, campaignId);
    let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
    if (!user) {
      let newRefCode = "";
      while (true) {
        newRefCode = "NOVA" + crypto2.randomBytes(3).toString("hex").toUpperCase();
        const exists = db.prepare("SELECT id FROM swap_campaign_users WHERE referral_code = ?").get(newRefCode);
        if (!exists) break;
      }
      const userId = "usr_" + crypto2.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        campaignId,
        normalizedAddress,
        1,
        "auto_connected",
        now,
        newRefCode,
        null,
        0,
        0,
        0,
        now,
        now
      );
      user = db.prepare("SELECT * FROM swap_campaign_users WHERE id = ?").get(userId);
    }
    const milestones = db.prepare(`
      SELECT * FROM swap_campaign_milestones 
      WHERE campaign_id = ? AND is_active = 1 
      ORDER BY sort_order ASC, target_volume_usd ASC
    `).all(campaignId);
    const rewards = db.prepare(`
      SELECT r.*, c.id as claim_id, c.status as claim_status, c.payout_address, c.preferred_network, c.preferred_token,
             p.payout_tx_hash, p.payout_network as paid_network, p.paid_at
      FROM swap_rewards r
      LEFT JOIN swap_reward_claims c ON c.reward_id = r.id
      LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
      WHERE r.user_id = ?
    `).all(user.id);
    const rewardsMap = /* @__PURE__ */ new Map();
    rewards.forEach((r) => {
      if (r.milestone_id) rewardsMap.set(r.milestone_id, r);
    });
    let nextMilestone = null;
    let completedCount = 0;
    const milestoneProgress = milestones.map((m) => {
      const isReached = user.total_volume_usd >= m.target_volume_usd;
      const rewardRecord = rewardsMap.get(m.id);
      let status = "locked";
      if (rewardRecord) {
        if (rewardRecord.status === "paid" || rewardRecord.claim_status === "paid") status = "paid";
        else if (rewardRecord.claim_status === "approved") status = "approved";
        else if (rewardRecord.claim_status === "under_review") status = "under_review";
        else if (rewardRecord.claim_status === "pending") status = "requested";
        else if (rewardRecord.status === "unlocked") status = "unlocked";
        else if (rewardRecord.status === "rejected") status = "rejected";
      } else if (isReached) {
        status = "unlocked";
      } else {
        status = "in_progress";
      }
      if (isReached) completedCount++;
      if (!isReached && !nextMilestone) {
        nextMilestone = {
          milestoneNumber: m.milestone_number,
          targetVolumeUSD: m.target_volume_usd,
          remainingVolumeUSD: Math.max(0, m.target_volume_usd - user.total_volume_usd)
        };
      }
      return {
        id: m.id,
        milestoneNumber: m.milestone_number,
        title: m.title,
        targetVolumeUSD: m.target_volume_usd,
        rewardAmountUSD: m.reward_amount_usd,
        rewardDescription: m.reward_description,
        isCompleted: isReached,
        status,
        rewardRecord: rewardRecord ? {
          id: rewardRecord.id,
          amountUSD: rewardRecord.amount_usd,
          status: rewardRecord.status,
          claimId: rewardRecord.claim_id,
          payoutTxHash: rewardRecord.payout_tx_hash,
          paidNetwork: rewardRecord.paid_network,
          paidAt: rewardRecord.paid_at
        } : null
      };
    });
    const referralStats = db.prepare(`
      SELECT 
        COUNT(*) as total_referred_users,
        COALESCE(SUM(CASE WHEN status IN ('qualified', 'rewarded') THEN 1 ELSE 0 END), 0) as qualified_referrals,
        COALESCE(SUM(reward_amount_usd), 0) as total_referral_rewards
      FROM swap_referrals
      WHERE referrer_user_id = ?
    `).get(user.id);
    const cashbackRow = db.prepare(`
      SELECT COALESCE(SUM(cashback_amount_usd), 0) as total_cashback
      FROM swap_cashback_ledger
      WHERE user_id = ?
    `).get(user.id);
    const totalCashbackUSD = Number((cashbackRow?.total_cashback || 0).toFixed(2));
    const milestoneBonusRow = db.prepare(`
      SELECT COALESCE(SUM(amount_usd), 0) as total_milestone_bonus
      FROM swap_rewards
      WHERE user_id = ? AND reward_type = 'milestone' AND status IN ('unlocked', 'requested', 'approved', 'paid')
    `).get(user.id);
    const milestoneBonusUSD = Number((milestoneBonusRow?.total_milestone_bonus || 0).toFixed(2));
    const referralBonusUSD = Number((referralStats?.total_referral_rewards || 0).toFixed(2));
    const totalBonusUSD = Number((milestoneBonusUSD + referralBonusUSD).toFixed(2));
    const totalAccumulatedRewardsUSD = Number((totalCashbackUSD + totalBonusUSD).toFixed(2));
    const claimThresholdUSD = 500;
    const progressPercent = Math.min(100, Math.round(totalAccumulatedRewardsUSD / claimThresholdUSD * 100));
    const isClaimEligible = totalAccumulatedRewardsUSD >= claimThresholdUSD;
    const userClaims = db.prepare(`
      SELECT c.*, p.payout_tx_hash, p.payout_network as paid_network, p.paid_at
      FROM swap_reward_claims c
      LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(user.id);
    const activeClaim = userClaims.length > 0 ? userClaims[0] : null;
    const transactions = db.prepare(`
      SELECT id, chain_id, tx_hash, from_token_symbol, to_token_symbol, from_amount, to_amount, volume_usd, execution_status, verified_at
      FROM swap_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(user.id);
    res.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        chainId: user.chain_id,
        referralCode: user.referral_code,
        referralLink: `https://novap2p.com/?ref=${user.referral_code}`,
        totalVolumeUSD: user.total_volume_usd,
        eligibleSwapsCount: user.eligible_swaps_count,
        isFlagged: Boolean(user.is_flagged)
      },
      progress: {
        totalVolumeUSD: user.total_volume_usd,
        eligibleSwapsCount: user.eligible_swaps_count,
        completedMilestonesCount: completedCount,
        totalMilestonesCount: milestones.length,
        nextMilestone: nextMilestone || {
          milestoneNumber: milestones.length,
          targetVolumeUSD: milestones[milestones.length - 1]?.target_volume_usd || 0,
          remainingVolumeUSD: 0
        }
      },
      milestones: milestoneProgress,
      cashbackStats: {
        totalCashbackUSD,
        cashbackPercentage: 5
      },
      bonusStats: {
        milestoneBonusUSD,
        referralBonusUSD,
        totalBonusUSD
      },
      claimStats: {
        claimThresholdUSD,
        totalAccumulatedRewardsUSD,
        progressPercent,
        isClaimEligible,
        remainingToClaimUSD: Math.max(0, claimThresholdUSD - totalAccumulatedRewardsUSD),
        activeClaim: activeClaim ? {
          id: activeClaim.id,
          status: activeClaim.status,
          requestedAmountUSD: activeClaim.requested_amount_usd,
          payoutAddress: activeClaim.payout_address,
          preferredNetwork: activeClaim.preferred_network,
          preferredToken: activeClaim.preferred_token,
          payoutTxHash: activeClaim.payout_tx_hash,
          paidNetwork: activeClaim.paid_network,
          paidAt: activeClaim.paid_at,
          rejectionReason: activeClaim.rejection_reason,
          createdAt: activeClaim.created_at
        } : null
      },
      referralStats: {
        referredUsersCount: referralStats?.total_referred_users || 0,
        qualifiedReferralsCount: referralStats?.qualified_referrals || 0,
        earnedRewardsUSD: referralStats?.total_referral_rewards || 0
      },
      transactions: transactions.map((tx) => ({
        id: tx.id,
        chainId: tx.chain_id,
        txHash: tx.tx_hash,
        fromToken: tx.from_token_symbol,
        toToken: tx.to_token_symbol,
        fromAmount: tx.from_amount,
        toAmount: tx.to_amount,
        volumeUSD: tx.volume_usd,
        status: tx.execution_status,
        verifiedAt: tx.verified_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/submit-transaction", async (req, res) => {
  try {
    const {
      walletAddress,
      chainId,
      txHash,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      volumeUSD,
      lifiRouteId,
      rawRouteData
    } = req.body;
    if (!walletAddress || !chainId || !txHash) {
      return res.status(400).json({ error: "walletAddress, chainId and txHash are required" });
    }
    const normalizedAddress = walletAddress.toLowerCase();
    const normalizedTxHash = txHash.toLowerCase();
    const numericChainId = Number(chainId);
    if (!numericChainId || isNaN(numericChainId) || numericChainId <= 0) {
      return res.status(400).json({ error: `Invalid Chain ID ${chainId}` });
    }
    const campaignId = "campaign_genesis_001";
    let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
    if (!user) {
      let newRefCode = "";
      while (true) {
        newRefCode = "NOVA" + crypto2.randomBytes(3).toString("hex").toUpperCase();
        const exists = db.prepare("SELECT id FROM swap_campaign_users WHERE referral_code = ?").get(newRefCode);
        if (!exists) break;
      }
      const userId = "usr_" + crypto2.randomUUID();
      const now2 = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        campaignId,
        normalizedAddress,
        numericChainId,
        "auto_connected",
        now2,
        newRefCode,
        null,
        0,
        0,
        0,
        now2,
        now2
      );
      user = db.prepare("SELECT * FROM swap_campaign_users WHERE id = ?").get(userId);
    }
    const existingTx = db.prepare("SELECT id FROM swap_transactions WHERE chain_id = ? AND tx_hash = ?").get(numericChainId, normalizedTxHash);
    if (existingTx) {
      return res.status(409).json({ error: "Transaction hash has already been credited for this chain" });
    }
    let verifiedVolume = typeof volumeUSD === "number" && volumeUSD > 0 ? volumeUSD : 0;
    let lifiVerified = false;
    try {
      const lifiStatusRes = await fetch(`https://li.quest/v1/status?txHash=${normalizedTxHash}&fromChain=${numericChainId}`, {
        headers: { "Accept": "application/json" }
      });
      if (lifiStatusRes.ok) {
        const lifiData = await lifiStatusRes.json();
        if (lifiData.status === "DONE") {
          lifiVerified = true;
          if (lifiData.sending?.amountUSD) {
            verifiedVolume = parseFloat(lifiData.sending.amountUSD);
          }
        }
      }
    } catch (e) {
    }
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(campaignId);
    const minSwapUSD = campaign ? campaign.min_swap_usd : 1;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = recordSwapTransactionInternal({
      campaignId,
      userId: user.id,
      normalizedAddress,
      numericChainId,
      normalizedTxHash,
      volumeUSD: verifiedVolume,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      lifiRouteId,
      rawRouteData,
      verificationSource: lifiVerified ? "lifi_status_api" : "validated_route",
      verifiedAt: now
    });
    if (result.duplicate) {
      return res.status(409).json({ error: "Transaction hash has already been credited for this chain" });
    }
    if (result.belowMin) {
      return res.status(400).json({
        error: `Swap volume ($${verifiedVolume.toFixed(2)}) is below minimum eligible threshold of $${minSwapUSD.toFixed(2)}`
      });
    }
    const updatedUser = db.prepare("SELECT * FROM swap_campaign_users WHERE id = ?").get(user.id);
    res.json({
      success: true,
      verifiedVolume,
      totalVolumeUSD: updatedUser.total_volume_usd,
      eligibleSwapsCount: updatedUser.eligible_swaps_count,
      newlyUnlockedMilestones: result.newlyUnlocked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/rewards/request", async (req, res) => {
  try {
    const { walletAddress, rewardId, payoutAddress, preferredNetwork, preferredToken, claimAmountUSD } = req.body;
    if (!walletAddress || !payoutAddress) {
      return res.status(400).json({ error: "walletAddress and payoutAddress are required" });
    }
    const normalizedAddress = walletAddress.toLowerCase();
    const user = db.prepare("SELECT id, campaign_id FROM swap_campaign_users WHERE wallet_address = ?").get(normalizedAddress);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const pendingClaim = db.prepare(`
      SELECT id FROM swap_reward_claims 
      WHERE user_id = ? AND status IN ('pending', 'under_review')
    `).get(user.id);
    if (pendingClaim) {
      return res.status(400).json({ error: "You already have an active claim under review. Please wait for admin approval before submitting another claim." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const claimId = "clm_" + crypto2.randomUUID();
    if (rewardId && rewardId !== "threshold_500" && rewardId !== "accumulated_rewards") {
      const reward = db.prepare("SELECT * FROM swap_rewards WHERE id = ? AND user_id = ?").get(rewardId, user.id);
      if (!reward) {
        return res.status(404).json({ error: "Reward record not found for this wallet" });
      }
      if (reward.status !== "unlocked") {
        return res.status(400).json({ error: `Reward cannot be requested in status: ${reward.status}` });
      }
      const submitClaim = db.transaction(() => {
        db.prepare("UPDATE swap_rewards SET status = 'requested' WHERE id = ?").run(reward.id);
        db.prepare(`
          INSERT INTO swap_reward_claims (
            id, reward_id, user_id, campaign_id, requested_amount_usd,
            payout_address, preferred_network, preferred_token,
            cashback_amount_usd, milestone_amount_usd, referral_amount_usd,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          claimId,
          reward.id,
          user.id,
          user.campaign_id,
          reward.amount_usd,
          payoutAddress.trim(),
          preferredNetwork || "BNB Smart Chain",
          preferredToken || "USDT",
          reward.reward_type === "cashback" ? reward.amount_usd : 0,
          reward.reward_type === "milestone" ? reward.amount_usd : 0,
          reward.reward_type === "referral" ? reward.amount_usd : 0,
          now,
          now
        );
      });
      submitClaim();
      sendAdminClaimNotification({
        claimId,
        walletAddress: normalizedAddress,
        requestedAmountUSD: reward.amount_usd,
        payoutAddress: payoutAddress.trim(),
        preferredNetwork: preferredNetwork || "BNB Smart Chain",
        preferredToken: preferredToken || "USDT",
        cashbackAmountUSD: reward.reward_type === "cashback" ? reward.amount_usd : 0,
        milestoneAmountUSD: reward.reward_type === "milestone" ? reward.amount_usd : 0,
        referralAmountUSD: reward.reward_type === "referral" ? reward.amount_usd : 0,
        createdAt: now
      }).catch(() => {
      });
      return res.json({
        success: true,
        claimId,
        status: "pending",
        message: "Reward claim submitted successfully. Admin has been notified for verification and manual payout."
      });
    }
    const unlockedRewards = db.prepare(`
      SELECT * FROM swap_rewards WHERE user_id = ? AND status = 'unlocked'
    `).all(user.id);
    let totalCashback = 0;
    let totalMilestones = 0;
    let totalReferrals = 0;
    unlockedRewards.forEach((r) => {
      if (r.reward_type === "cashback") totalCashback += r.amount_usd;
      else if (r.reward_type === "milestone") totalMilestones += r.amount_usd;
      else if (r.reward_type === "referral") totalReferrals += r.amount_usd;
    });
    const totalEligible = totalCashback + totalMilestones + totalReferrals;
    const requestedAmount = claimAmountUSD && typeof claimAmountUSD === "number" && claimAmountUSD > 0 ? Math.min(claimAmountUSD, totalEligible) : totalEligible;
    if (requestedAmount <= 0) {
      return res.status(400).json({ error: "No available unlocked reward balance to claim." });
    }
    const submitThresholdClaim = db.transaction(() => {
      db.prepare(`
        UPDATE swap_rewards SET status = 'requested' WHERE user_id = ? AND status = 'unlocked'
      `).run(user.id);
      db.prepare(`
        INSERT INTO swap_reward_claims (
          id, reward_id, user_id, campaign_id, requested_amount_usd,
          payout_address, preferred_network, preferred_token,
          cashback_amount_usd, milestone_amount_usd, referral_amount_usd,
          status, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        claimId,
        user.id,
        user.campaign_id,
        requestedAmount,
        payoutAddress.trim(),
        preferredNetwork || "BNB Smart Chain",
        preferredToken || "USDT",
        totalCashback,
        totalMilestones,
        totalReferrals,
        now,
        now
      );
    });
    submitThresholdClaim();
    sendAdminClaimNotification({
      claimId,
      walletAddress: normalizedAddress,
      requestedAmountUSD: requestedAmount,
      payoutAddress: payoutAddress.trim(),
      preferredNetwork: preferredNetwork || "BNB Smart Chain",
      preferredToken: preferredToken || "USDT",
      cashbackAmountUSD: totalCashback,
      milestoneAmountUSD: totalMilestones,
      referralAmountUSD: totalReferrals,
      createdAt: now
    }).catch(() => {
    });
    res.json({
      success: true,
      claimId,
      status: "pending",
      requestedAmountUSD: requestedAmount,
      message: "Genesis Rewards claim submitted successfully. Admin has been notified for verification and manual payout."
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/login", (req, res) => {
  const { adminKey } = req.body;
  if (!adminKey || adminKey !== ADMIN_KEY2) {
    return res.status(403).json({ error: "Invalid admin passkey" });
  }
  res.json({ success: true, token: ADMIN_KEY2 });
});
apiRouter.get("/admin/overview", verifyAdmin, (req, res) => {
  try {
    const campaignId = "campaign_genesis_001";
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(campaignId);
    const userStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT id) as total_users,
        COALESCE(SUM(total_volume_usd), 0) as total_volume,
        COALESCE(SUM(eligible_swaps_count), 0) as total_swaps,
        COUNT(CASE WHEN eligible_swaps_count > 1 THEN 1 END) as repeat_swappers
      FROM swap_campaign_users
      WHERE campaign_id = ?
    `).get(campaignId);
    const eventStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN event_name = 'campaign_page_view' THEN 1 END) as page_views,
        COUNT(DISTINCT CASE WHEN event_name = 'campaign_page_view' THEN ip_address END) as unique_visitors,
        COUNT(CASE WHEN event_name = 'wallet_connect_clicked' THEN 1 END) as connect_attempts,
        COUNT(CASE WHEN event_name = 'wallet_connected' THEN 1 END) as connected_wallets,
        COUNT(CASE WHEN event_name = 'swap_initiated' THEN 1 END) as swaps_initiated
      FROM swap_campaign_events
      WHERE campaign_id = ?
    `).get(campaignId);
    const txStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN execution_status = 'DONE' THEN 1 END) as successful_swaps,
        COUNT(CASE WHEN execution_status = 'FAILED' THEN 1 END) as failed_swaps
      FROM swap_transactions
      WHERE campaign_id = ?
    `).get(campaignId);
    const referralStats = db.prepare(`
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN status IN ('qualified', 'rewarded') THEN 1 END) as qualified_referrals
      FROM swap_referrals
      WHERE campaign_id = ?
    `).get(campaignId);
    const rewardStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'unlocked' THEN 1 END) as unlocked_count,
        COUNT(CASE WHEN status IN ('requested', 'under_review') THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_usd ELSE 0 END), 0) as total_paid_amount
      FROM swap_rewards
      WHERE campaign_id = ?
    `).get(campaignId);
    const remainingBudget = campaign ? Math.max(0, campaign.total_budget_usd - (rewardStats.total_paid_amount || 0)) : 0;
    res.json({
      campaign,
      analytics: {
        pageViews: eventStats.page_views || 0,
        uniqueVisitors: eventStats.unique_visitors || 0,
        connectAttempts: eventStats.connect_attempts || 0,
        connectedWallets: userStats.total_users || 0,
        swapsInitiated: eventStats.swaps_initiated || 0,
        successfulSwaps: txStats.successful_swaps || 0,
        failedSwaps: txStats.failed_swaps || 0,
        totalVerifiedVolumeUSD: userStats.total_volume || 0,
        repeatSwappers: userStats.repeat_swappers || 0,
        referralVisits: referralStats.total_referrals || 0,
        qualifiedReferrals: referralStats.qualified_referrals || 0,
        milestonesUnlocked: rewardStats.unlocked_count || 0,
        pendingClaims: rewardStats.pending_requests || 0,
        approvedClaims: rewardStats.approved_count || 0,
        paidClaims: rewardStats.paid_count || 0,
        totalPaidAmountUSD: rewardStats.total_paid_amount || 0,
        totalBudgetUSD: campaign?.total_budget_usd || 1e4,
        remainingBudgetUSD: remainingBudget
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.put("/admin/campaign", verifyAdmin, (req, res) => {
  try {
    const {
      title,
      description,
      status,
      startDate,
      endDate,
      totalBudgetUSD,
      minSwapUSD,
      referralRewardUSD,
      referralQualifyingVolUSD,
      cashbackEnabled,
      cashbackPercentage
    } = req.body;
    const campaignId = "campaign_genesis_001";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(`
      UPDATE swap_campaigns
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          total_budget_usd = COALESCE(?, total_budget_usd),
          min_swap_usd = COALESCE(?, min_swap_usd),
          referral_reward_usd = COALESCE(?, referral_reward_usd),
          referral_qualifying_vol_usd = COALESCE(?, referral_qualifying_vol_usd),
          cashback_enabled = COALESCE(?, cashback_enabled),
          cashback_percentage = COALESCE(?, cashback_percentage),
          updated_at = ?
      WHERE id = ?
    `).run(
      title,
      description,
      status,
      startDate,
      endDate,
      totalBudgetUSD,
      minSwapUSD,
      referralRewardUSD,
      referralQualifyingVolUSD,
      cashbackEnabled !== void 0 ? cashbackEnabled ? 1 : 0 : null,
      cashbackPercentage,
      now,
      campaignId
    );
    db.prepare(`
      INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
      VALUES (?, 'admin', 'update_campaign_settings', 'campaign', ?, ?, ?, ?)
    `).run("log_" + crypto2.randomUUID(), campaignId, JSON.stringify(req.body), String(req.ip || ""), now);
    res.json({ success: true, message: "Campaign settings updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/milestones", verifyAdmin, (req, res) => {
  try {
    const { id, milestoneNumber, title, targetVolumeUSD, rewardAmountUSD, rewardDescription, isActive, sortOrder } = req.body;
    const campaignId = "campaign_genesis_001";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (id) {
      db.prepare(`
        UPDATE swap_campaign_milestones
        SET milestone_number = COALESCE(?, milestone_number),
            title = COALESCE(?, title),
            target_volume_usd = COALESCE(?, target_volume_usd),
            reward_amount_usd = COALESCE(?, reward_amount_usd),
            reward_description = COALESCE(?, reward_description),
            is_active = COALESCE(?, is_active),
            sort_order = COALESCE(?, sort_order)
        WHERE id = ?
      `).run(
        milestoneNumber,
        title,
        targetVolumeUSD,
        rewardAmountUSD,
        rewardDescription,
        isActive !== void 0 ? isActive ? 1 : 0 : null,
        sortOrder,
        id
      );
    } else {
      const newId = "ms_" + crypto2.randomUUID();
      db.prepare(`
        INSERT INTO swap_campaign_milestones (
          id, campaign_id, milestone_number, title, target_volume_usd,
          reward_amount_usd, reward_description, is_active, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        campaignId,
        milestoneNumber || 1,
        title || "New Milestone",
        targetVolumeUSD || 100,
        rewardAmountUSD || 1,
        rewardDescription || "Milestone reward",
        isActive !== void 0 ? isActive ? 1 : 0 : 1,
        sortOrder || 1,
        now
      );
    }
    res.json({ success: true, message: "Milestone saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.delete("/admin/milestones/:id", verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM swap_campaign_milestones WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/claims", verifyAdmin, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT c.*, u.wallet_address, u.total_volume_usd, u.eligible_swaps_count, u.is_flagged,
             r.reward_type, m.title as milestone_title, m.target_volume_usd as milestone_target,
             p.payout_tx_hash, p.payout_network as paid_network, p.payout_token as paid_token, p.paid_at
      FROM swap_reward_claims c
      JOIN swap_campaign_users u ON u.id = c.user_id
      JOIN swap_rewards r ON r.id = c.reward_id
      LEFT JOIN swap_campaign_milestones m ON m.id = r.milestone_id
      LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== "all") {
      query += " AND c.status = ?";
      params.push(status);
    }
    if (search) {
      query += " AND (u.wallet_address LIKE ? OR c.payout_address LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    query += " ORDER BY c.created_at DESC";
    const claims = db.prepare(query).all(...params);
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/claims/:id/review", verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason, adminNotes } = req.body;
    if (!["approve", "reject", "freeze"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use 'approve', 'reject' or 'freeze'" });
    }
    const claim = db.prepare("SELECT * FROM swap_reward_claims WHERE id = ?").get(id);
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let newStatus = "pending";
    let rewardStatus = "requested";
    if (action === "approve") {
      newStatus = "approved";
      rewardStatus = "approved";
    } else if (action === "reject") {
      newStatus = "rejected";
      rewardStatus = "rejected";
    } else if (action === "freeze") {
      newStatus = "frozen";
      rewardStatus = "frozen";
    }
    db.transaction(() => {
      db.prepare(`
        UPDATE swap_reward_claims
        SET status = ?, rejection_reason = ?, admin_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(newStatus, rejectionReason || null, adminNotes || null, now, claim.id);
      db.prepare(`
        UPDATE swap_rewards
        SET status = ?
        WHERE id = ?
      `).run(rewardStatus, claim.reward_id);
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', ?, 'claim', ?, ?, ?, ?)
      `).run(
        "log_" + crypto2.randomUUID(),
        `claim_${action}`,
        claim.id,
        JSON.stringify({ action, rejectionReason, adminNotes }),
        String(req.ip || ""),
        now
      );
    })();
    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/claims/:id/pay", verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { payoutNetwork, payoutToken, payoutTxHash, notes } = req.body;
    if (!payoutNetwork || !payoutToken || !payoutTxHash) {
      return res.status(400).json({ error: "payoutNetwork, payoutToken and payoutTxHash are required" });
    }
    const claim = db.prepare("SELECT * FROM swap_reward_claims WHERE id = ?").get(id);
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }
    if (claim.status === "paid") {
      return res.status(400).json({ error: "Claim has already been marked as paid" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payoutId = "pay_" + crypto2.randomUUID();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO swap_reward_payouts (
          id, claim_id, reward_id, user_id, amount_usd,
          payout_network, payout_token, payout_tx_hash,
          paid_by_admin, paid_at, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)
      `).run(
        payoutId,
        claim.id,
        claim.reward_id,
        claim.user_id,
        claim.requested_amount_usd,
        payoutNetwork,
        payoutToken,
        payoutTxHash.trim(),
        now,
        notes || null,
        now
      );
      db.prepare("UPDATE swap_reward_claims SET status = 'paid', updated_at = ? WHERE id = ?").run(now, claim.id);
      db.prepare("UPDATE swap_rewards SET status = 'paid' WHERE id = ?").run(claim.reward_id);
      db.prepare(`
        UPDATE swap_campaigns
        SET spent_budget_usd = spent_budget_usd + ?
        WHERE id = ?
      `).run(claim.requested_amount_usd, claim.campaign_id);
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', 'record_payout', 'payout', ?, ?, ?, ?)
      `).run(
        "log_" + crypto2.randomUUID(),
        payoutId,
        JSON.stringify({ claimId: claim.id, amountUSD: claim.requested_amount_usd, payoutTxHash, payoutNetwork }),
        String(req.ip || ""),
        now
      );
    })();
    res.json({ success: true, payoutId, message: "Payout recorded and status updated to Paid" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/users", verifyAdmin, (req, res) => {
  try {
    const { search, flagged } = req.query;
    let query = `
      SELECT u.*, 
        (SELECT COUNT(*) FROM swap_referrals WHERE referrer_user_id = u.id) as referrals_count,
        (SELECT COUNT(*) FROM swap_rewards WHERE user_id = u.id AND status = 'paid') as rewards_paid_count
      FROM swap_campaign_users u
      WHERE 1=1
    `;
    const params = [];
    if (flagged === "true") {
      query += " AND u.is_flagged = 1";
    }
    if (search) {
      query += " AND (u.wallet_address LIKE ? OR u.referral_code LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    query += " ORDER BY u.total_volume_usd DESC LIMIT 100";
    const users = db.prepare(query).all(...params);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/users/:id/flag", verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { isFlagged, flagReason } = req.body;
    db.prepare(`
      UPDATE swap_campaign_users
      SET is_flagged = ?, flag_reason = ?
      WHERE id = ?
    `).run(isFlagged ? 1 : 0, flagReason || null, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/audit-logs", verifyAdmin, (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM swap_admin_audit_logs ORDER BY created_at DESC LIMIT 100").all();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/export/:type", verifyAdmin, (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let filename = `swap_${type}_${Date.now()}.csv`;
    if (type === "users") {
      data = db.prepare("SELECT wallet_address, chain_id, total_volume_usd, eligible_swaps_count, referral_code, is_flagged, verified_at, created_at FROM swap_campaign_users ORDER BY total_volume_usd DESC").all();
    } else if (type === "transactions") {
      data = db.prepare("SELECT wallet_address, chain_id, tx_hash, from_token_symbol, to_token_symbol, volume_usd, execution_status, verified_at FROM swap_transactions ORDER BY created_at DESC").all();
    } else if (type === "claims") {
      data = db.prepare(`
        SELECT c.id, u.wallet_address, c.requested_amount_usd, c.payout_address, c.preferred_network, c.preferred_token, c.status, p.payout_tx_hash, p.paid_at, c.created_at
        FROM swap_reward_claims c
        JOIN swap_campaign_users u ON u.id = c.user_id
        LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
        ORDER BY c.created_at DESC
      `).all();
    } else if (type === "referrals") {
      data = db.prepare(`
        SELECT r.id, u1.wallet_address as referrer_wallet, u2.wallet_address as referred_wallet, r.referral_code, r.status, r.qualifying_volume_usd, r.reward_amount_usd, r.created_at
        FROM swap_referrals r
        JOIN swap_campaign_users u1 ON u1.id = r.referrer_user_id
        JOIN swap_campaign_users u2 ON u2.id = r.referred_user_id
        ORDER BY r.created_at DESC
      `).all();
    } else {
      return res.status(400).json({ error: "Invalid export type. Use users, transactions, claims, or referrals." });
    }
    if (data.length === 0) {
      return res.send("No data available");
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [headers, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// server/index.ts
var apiApp = express();
apiApp.use(express.json());
apiApp.use("/swap", apiRouter);
apiApp.use("/affiliate", affiliateRouter);
var index_default = apiApp;
export {
  apiApp,
  index_default as default
};
