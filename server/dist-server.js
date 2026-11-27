// server/index.ts
import "dotenv/config";
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
var dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, "../data");
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
  try {
    const rewardCols = db.prepare("PRAGMA table_info(swap_rewards)").all().map((col) => col.name);
    if (!rewardCols.includes("claim_id")) {
      db.exec("ALTER TABLE swap_rewards ADD COLUMN claim_id TEXT;");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_rewards_claim ON swap_rewards(claim_id);");
  } catch (err) {
    console.error("[DB] swap_rewards.claim_id migration failed:", err);
  }
  try {
    const campaignCols = db.prepare("PRAGMA table_info(swap_campaigns)").all().map((col) => col.name);
    if (!campaignCols.includes("claim_threshold_usd")) {
      db.exec("ALTER TABLE swap_campaigns ADD COLUMN claim_threshold_usd REAL NOT NULL DEFAULT 500.0;");
    }
    if (!campaignCols.includes("rewards_heading")) {
      db.exec("ALTER TABLE swap_campaigns ADD COLUMN rewards_heading TEXT NOT NULL DEFAULT 'Genesis Rewards';");
    }
    if (!campaignCols.includes("rewards_badge_text")) {
      db.exec("ALTER TABLE swap_campaigns ADD COLUMN rewards_badge_text TEXT NOT NULL DEFAULT 'Detailed Rewards and Progress (After Wallet Connect)';");
    }
    if (!campaignCols.includes("reset_at")) {
      db.exec("ALTER TABLE swap_campaigns ADD COLUMN reset_at TEXT;");
    }
  } catch (err) {
    console.error("[DB] swap_campaigns display settings migration failed:", err);
  }
  try {
    const affCols = db.prepare("PRAGMA table_info(affiliates)").all().map((col) => col.name);
    if (!affCols.includes("custom_rate_pct")) {
      db.exec("ALTER TABLE affiliates ADD COLUMN custom_rate_pct REAL;");
    }
    if (!affCols.includes("custom_override_pct")) {
      db.exec("ALTER TABLE affiliates ADD COLUMN custom_override_pct REAL;");
    }
  } catch (err) {
    console.error("[DB] affiliates custom rate migration failed:", err);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_settings (
      key TEXT PRIMARY KEY,
      value REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const seedSetting = db.prepare("INSERT OR IGNORE INTO affiliate_settings (key, value, updated_at) VALUES (?, ?, ?)");
  const seededAt = (/* @__PURE__ */ new Date()).toISOString();
  seedSetting.run("partner_rate_pct", 20, seededAt);
  seedSetting.run("bdm_direct_rate_pct", 20, seededAt);
  seedSetting.run("bdm_override_rate_pct", 10, seededAt);
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
  }
  const targetCampaignId = existingCampaign ? existingCampaign.id : campaignId;
  const milestoneCount = db.prepare("SELECT COUNT(*) as n FROM swap_campaign_milestones WHERE campaign_id = ?").get(targetCampaignId)?.n || 0;
  if (milestoneCount > 0) return;
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
import crypto from "crypto";
import nodemailer from "nodemailer";
var ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || "support@novap2p.com";
var SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
var SMTP_PORT = Number(process.env.SMTP_PORT || 465);
var SMTP_USER = process.env.SMTP_USER || "support@novap2p.com";
var SMTP_PASS = process.env.SMTP_PASS || "";
var MAIL_FROM = process.env.MAIL_FROM || `"Nova Swap" <${SMTP_USER}>`;
var transporter = null;
function getTransporter() {
  if (!SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Fail fast instead of holding the applicant's request open for minutes
      connectionTimeout: 15e3,
      greetingTimeout: 15e3,
      socketTimeout: 2e4
    });
  }
  return transporter;
}
function describeSmtpError(err) {
  const code = err?.code || "";
  const detail = `${code} ${err?.responseCode || ""} ${err?.response || err?.message || ""}`.trim();
  if (code === "EAUTH") return `login rejected - SMTP_PASS (or SMTP_USER=${SMTP_USER}) is wrong. [${detail}]`;
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET") return `cannot reach ${SMTP_HOST}:${SMTP_PORT}. [${detail}]`;
  return detail;
}
if (!SMTP_PASS) {
  console.warn("[Email] SMTP_PASS is not set. Application and decision emails will not be sent until it is configured.");
} else {
  getTransporter()?.verify().then(() => console.log(`[Email] SMTP login OK (${SMTP_USER} via ${SMTP_HOST}:${SMTP_PORT}). Admin emails go to ${ADMIN_EMAIL}.`)).catch((err) => console.error(`[Email] SMTP login FAILED: ${describeSmtpError(err)}`));
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function textToHtml(text) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4F7DF3;word-break:break-all;">$1</a>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${linked}</div>`;
}
async function sendMail(params) {
  const t = getTransporter();
  if (!t) {
    return { sent: false, error: "Email service is not configured (SMTP_PASS missing)." };
  }
  try {
    await t.sendMail({
      from: MAIL_FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || textToHtml(params.text),
      replyTo: params.replyTo,
      headers: params.headers
    });
    console.log(`[Email] Sent "${params.subject}" to ${params.to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[Email] Send to ${params.to} failed: ${describeSmtpError(err)}`);
    return { sent: false, error: "Email delivery failed." };
  }
}
async function sendAdminAffiliateApplicationEmail(params) {
  const baseReviewUrl = `${params.siteOrigin}/affiliate-review?id=${encodeURIComponent(params.applicationId)}&token=${encodeURIComponent(params.reviewToken)}`;
  const approveUrl = `${baseReviewUrl}&action=approve`;
  const rejectUrl = `${baseReviewUrl}&action=reject`;
  const roleLabel = params.role === "bdm" ? "Business Development Manager (BDM)" : "Partner";
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
    `You can also review inside /swap-admin -> Partners & BDMs.`
  ].filter((line) => line !== null).join("\n");
  const fieldRows = [
    ["Application ID", params.applicationId],
    ["Role", roleLabel],
    ["Wallet Address", params.walletAddress],
    ["Full Name", params.fullName],
    ["Email", params.email],
    ["Telegram", params.telegramUsername],
    ["Twitter / X", params.twitterLink, true],
    ["YouTube", params.youtubeLink, true],
    ["Telegram Channel / Group", params.telegramChannelLink, true],
    ["Estimated Audience Size", params.audienceSize],
    ["Marketing Experience", params.marketingExperience],
    ["Manageable Partners", params.manageablePartnersCount],
    ["Applicant Message", params.message]
  ];
  const rowsHtml = fieldRows.filter(([, value]) => value).map(([label, value, isLink]) => {
    const safe = escapeHtml(String(value));
    const valueHtml = isLink && /^https?:\/\//i.test(String(value)) ? `<a href="${safe}" style="color:#4F7DF3;text-decoration:none;word-break:break-all;">${safe}</a>` : `<span style="word-break:break-word;white-space:pre-wrap;">${safe}</span>`;
    return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;font-weight:700;color:#111827;width:38%;vertical-align:top;">${escapeHtml(label)}:</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;color:#374151;vertical-align:top;">${valueHtml}</td>
        </tr>`;
  }).join("");
  const button = (href, label, color) => `<td align="center" style="padding:6px;">
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
            ${button(approveUrl, "&#10003; Approve", "#16a34a")}
            ${button(rejectUrl, "&#10007; Reject", "#dc2626")}
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
    subject: `New ${params.role === "bdm" ? "BDM" : "Partner"} Application \u2014 ${params.fullName}`,
    text,
    html,
    replyTo: params.email
  });
}
async function sendApplicantDecisionEmail(params) {
  if (!params.applicantEmail) {
    return { sent: false, error: "Applicant email address is missing." };
  }
  const origin = params.siteOrigin;
  const roleTitle = params.role === "bdm" ? "Business Development Manager (BDM)" : "Partner";
  const dashboardUrl = `${origin}${params.role === "bdm" ? "/bdm-dashboard" : "/partner-dashboard"}`;
  const applyUrl = `${origin}${params.role === "bdm" ? "/become-bdm" : "/become-partner"}`;
  const referralLink = `${origin}/swap?ref=${params.walletAddress}`;
  const subject = params.decision === "approved" ? `Approved: Your Nova Swap ${roleTitle} Dashboard is Now Active!` : `Update on Your Nova Swap ${roleTitle} Application`;
  const text = params.decision === "approved" ? [
    `Hello ${params.applicantName || "Creator"},`,
    ``,
    `Congratulations! Your Nova Swap ${roleTitle} application has been APPROVED and your dashboard is now active.`,
    ``,
    `Registered Wallet: ${params.walletAddress}`,
    `Your Dashboard Link: ${dashboardUrl}`,
    `Your Unique Referral Link: ${referralLink}`,
    ``,
    params.role === "bdm" ? `Commission Tier: 10% BDM Override on your managed Partners' volume + 20% Commission on your direct referrals.` : `Commission Tier: 20% of the 0.5% platform trading fee (0.1% of referred swap volume) for life.`,
    ``,
    `Next Step: Visit ${dashboardUrl} and connect your registered wallet (${params.walletAddress}) to access live stats and request payouts.`,
    ``,
    `Welcome to Nova Swap!`,
    `Nova Swap Affiliate Team`
  ].join("\n") : [
    `Hello ${params.applicantName || "Applicant"},`,
    ``,
    `Thank you for applying to the Nova Swap ${roleTitle} Program (${params.walletAddress}).`,
    ``,
    `After reviewing your application, we are unable to approve it at this time for the following reason / query:`,
    `--------------------------------------------------`,
    `${params.rejectionReason || "Your channels or verification requirements did not meet current criteria."}`,
    `--------------------------------------------------`,
    ``,
    `You can address the query above and re-submit your updated application anytime at:`,
    applyUrl,
    ``,
    `If you have questions, simply reply to this email or contact ${ADMIN_EMAIL}.`,
    ``,
    `Best regards,`,
    `Nova Swap Affiliate Team`
  ].join("\n");
  return sendMail({ to: params.applicantEmail, subject, text, replyTo: ADMIN_EMAIL });
}
async function sendAdminClaimNotification(payload) {
  try {
    db.prepare(`
      INSERT INTO swap_campaign_events (
        id, campaign_id, user_id, wallet_address, event_name, event_data, created_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).run(
      "evt_" + crypto.randomUUID(),
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
        adminRecipient: ADMIN_EMAIL
      }),
      (/* @__PURE__ */ new Date()).toISOString()
    );
  } catch (err) {
    console.error("Failed to log in-app admin notification:", err);
  }
  console.log(`[Admin Notification] Claim ID: ${payload.claimId} for $${payload.requestedAmountUSD.toFixed(2)} USDT by ${payload.walletAddress}`);
}

// server/affiliateApi.ts
import { Router } from "express";
import crypto3 from "crypto";

// server/auth.ts
import crypto2 from "crypto";
import { ethers } from "ethers";
import bs58 from "bs58";
var ADMIN_KEY = (process.env.SWAP_ADMIN_KEY || "").trim();
if (!ADMIN_KEY) {
  console.warn("[Nova Server] SWAP_ADMIN_KEY is not set. Admin endpoints and email review links are disabled until it is configured.");
}
function safeEqual(a, b) {
  const ha = crypto2.createHash("sha256").update(String(a)).digest();
  const hb = crypto2.createHash("sha256").update(String(b)).digest();
  return crypto2.timingSafeEqual(ha, hb);
}
function isValidAdminKey(candidate) {
  if (!ADMIN_KEY || typeof candidate !== "string" || !candidate) return false;
  return safeEqual(candidate, ADMIN_KEY);
}
function verifyAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: "Admin access is disabled: SWAP_ADMIN_KEY is not configured on the server." });
  }
  const authHeader = req.headers["x-admin-key"] || req.headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!isValidAdminKey(token)) {
    return res.status(403).json({ error: "Invalid admin credentials" });
  }
  next();
}
var REVIEW_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1e3;
function reviewSecret() {
  return crypto2.createHash("sha256").update(`nova-review-links:${ADMIN_KEY}`).digest("hex");
}
function signReviewToken(appId, issuedAt = Date.now()) {
  if (!ADMIN_KEY) return "";
  const exp = issuedAt + REVIEW_TOKEN_TTL_MS;
  const mac = crypto2.createHmac("sha256", reviewSecret()).update(`review:${appId}:${exp}`).digest("hex");
  return `${exp}.${mac}`;
}
function verifyReviewToken(appId, token) {
  if (!ADMIN_KEY || !appId || !token) return false;
  const [expStr, mac] = String(token).trim().split(".");
  const exp = Number(expStr);
  if (!exp || !mac || Date.now() > exp) return false;
  const expected = crypto2.createHmac("sha256", reviewSecret()).update(`review:${appId}:${exp}`).digest("hex");
  return safeEqual(mac, expected);
}
var EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
var SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
var TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
function getWalletKind(address) {
  if (typeof address !== "string") return null;
  const a = address.trim();
  if (EVM_ADDRESS.test(a)) return "evm";
  if (TRON_ADDRESS.test(a)) return "tron";
  if (SOLANA_ADDRESS.test(a)) return "solana";
  return null;
}
function isValidWalletAddress(address) {
  return getWalletKind(address) !== null;
}
var PURPOSE_TITLES = {
  verify_wallet: "Verify wallet ownership for Nova Swap Genesis Campaign",
  reward_claim: "Confirm Nova Swap Genesis reward claim",
  affiliate_apply: "Confirm Nova Swap affiliate application",
  affiliate_payout: "Confirm Nova Swap affiliate payout request"
};
var CHALLENGE_TTL_MS = 10 * 60 * 1e3;
var challenges = /* @__PURE__ */ new Map();
function challengeKey(address, purpose) {
  return `${purpose}:${address.toLowerCase()}`;
}
function pruneChallenges() {
  const now = Date.now();
  for (const [key, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(key);
  }
}
function isSignaturePurpose(value) {
  return typeof value === "string" && value in PURPOSE_TITLES;
}
function issueChallenge(address, purpose) {
  pruneChallenges();
  const cleanAddress = address.trim();
  const nonce = crypto2.randomBytes(16).toString("hex");
  const displayAddress = cleanAddress.startsWith("0x") ? cleanAddress.toLowerCase() : cleanAddress;
  const message = [
    `${PURPOSE_TITLES[purpose]}.`,
    "",
    "This signature is free and does not send a transaction.",
    "",
    `Wallet: ${displayAddress}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}`
  ].join("\n");
  challenges.set(challengeKey(cleanAddress, purpose), {
    address: cleanAddress,
    purpose,
    message,
    expiresAt: Date.now() + CHALLENGE_TTL_MS
  });
  return { nonce, message };
}
function verifySolanaSignature(address, message, signature) {
  try {
    const pubKey = Buffer.from(bs58.decode(address));
    if (pubKey.length !== 32) return false;
    const sigBytes = /^(0x)?[0-9a-fA-F]{128}$/.test(signature) ? Buffer.from(signature.replace(/^0x/, ""), "hex") : Buffer.from(bs58.decode(signature));
    if (sigBytes.length !== 64) return false;
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pubKey]);
    const keyObject = crypto2.createPublicKey({ key: spki, format: "der", type: "spki" });
    return crypto2.verify(null, Buffer.from(message, "utf8"), keyObject, sigBytes);
  } catch {
    return false;
  }
}
function consumeSignedChallenge(params) {
  const { purpose } = params;
  const address = String(params.address || "").trim();
  const message = typeof params.message === "string" ? params.message : "";
  const signature = typeof params.signature === "string" ? params.signature.trim() : "";
  if (!address || !message || !signature) {
    return "Wallet signature is required. Please approve the signature request in your wallet.";
  }
  const key = challengeKey(address, purpose);
  const challenge = challenges.get(key);
  if (!challenge || challenge.expiresAt < Date.now()) {
    challenges.delete(key);
    return "Signature request expired. Please try again.";
  }
  if (challenge.message !== message) {
    return "Signed message does not match the server request. Please try again.";
  }
  const kind = getWalletKind(challenge.address);
  let valid = false;
  if (kind === "evm") {
    try {
      valid = ethers.verifyMessage(message, signature).toLowerCase() === challenge.address.toLowerCase();
    } catch {
      valid = false;
    }
  } else if (kind === "solana") {
    valid = verifySolanaSignature(challenge.address, message, signature);
  } else {
    return "Signature verification is supported for EVM and Solana wallets only.";
  }
  if (!valid) {
    return "Signature verification failed: the signature does not belong to this wallet.";
  }
  challenges.delete(key);
  return null;
}
function rateLimit(options) {
  const hits = /* @__PURE__ */ new Map();
  let lastSweep = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      lastSweep = now;
    }
    const key = `${req.ip || "unknown"}:${req.baseUrl}${req.path}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1e3)));
      return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    }
    next();
  };
}
function sendServerError(res, err, context) {
  console.error(`[Nova API] ${context}:`, err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
}

// server/affiliateApi.ts
var affiliateRouter = Router();
var PLATFORM_FEE_PCT = 0.5;
var DEFAULT_AFFILIATE_RATES = { partnerRatePct: 20, bdmDirectRatePct: 20, bdmOverrideRatePct: 10 };
function getAffiliateRates() {
  const rates = { ...DEFAULT_AFFILIATE_RATES };
  try {
    const rows = db.prepare("SELECT key, value FROM affiliate_settings").all();
    const byKey = {};
    rows.forEach((r) => {
      byKey[r.key] = Number(r.value);
    });
    const pick = (key, fallback) => Number.isFinite(byKey[key]) && byKey[key] >= 0 && byKey[key] <= 100 ? byKey[key] : fallback;
    rates.partnerRatePct = pick("partner_rate_pct", rates.partnerRatePct);
    rates.bdmDirectRatePct = pick("bdm_direct_rate_pct", rates.bdmDirectRatePct);
    rates.bdmOverrideRatePct = pick("bdm_override_rate_pct", rates.bdmOverrideRatePct);
  } catch (err) {
    console.warn("[Affiliate] Could not read affiliate rates, using defaults:", err);
  }
  return rates;
}
function getEffectiveAffiliateRates(aff, defaults = getAffiliateRates()) {
  const custom = (v) => v === null || v === void 0 || v === "" ? null : Number(v);
  const valid = (v) => v !== null && Number.isFinite(v) && v >= 0 && v <= 100;
  const directCustom = custom(aff?.custom_rate_pct);
  const overrideCustom = custom(aff?.custom_override_pct);
  const directDefault = aff?.role === "bdm" ? defaults.bdmDirectRatePct : defaults.partnerRatePct;
  return {
    directPct: valid(directCustom) ? directCustom : directDefault,
    overridePct: valid(overrideCustom) ? overrideCustom : defaults.bdmOverrideRatePct,
    directIsCustom: valid(directCustom),
    overrideIsCustom: valid(overrideCustom)
  };
}
function volumePct(ratePct) {
  return Number((ratePct * PLATFORM_FEE_PCT / 100).toFixed(4));
}
function getSiteOrigin(req) {
  const configured = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(configured)) return configured;
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : "https://novap2p.com";
}
async function notifyApplicant(req, result) {
  const emailResult = await sendApplicantDecisionEmail({
    siteOrigin: getSiteOrigin(req),
    decision: result.status,
    role: result.role,
    applicantEmail: result.applicantEmail,
    applicantName: result.applicantName,
    walletAddress: result.walletAddress,
    rejectionReason: result.rejectionReason
  });
  return emailResult.sent;
}
function processApplicationDecision(params) {
  return db.transaction(() => applyApplicationDecision(params))();
}
function applyApplicationDecision(params) {
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
      "aff_" + crypto3.randomUUID(),
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
    if (!isValidWalletAddress(referredWallet.trim()) || !isValidWalletAddress(referrerWallet.trim())) {
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
    const refId = "affref_" + crypto3.randomUUID();
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
    db.transaction(() => creditAffiliateSwapCommission(params))();
  } catch (err) {
    console.warn("[Affiliate] processAffiliateSwapCommission error:", err);
  }
}
function creditAffiliateSwapCommission(params) {
  {
    const cleanTrader = params.traderWallet.trim().toLowerCase();
    if (!cleanTrader || params.volumeUSD <= 0 || !params.transactionId) return;
    const existingComm = db.prepare("SELECT id FROM affiliate_commissions WHERE transaction_id = ?").get(params.transactionId);
    if (existingComm) return;
    const attribution = db.prepare("SELECT * FROM affiliate_referrals WHERE LOWER(referred_wallet_address) = ?").get(cleanTrader);
    if (!attribution) return;
    if (attribution.referrer_wallet_address.toLowerCase() === cleanTrader) return;
    const now = params.verifiedAt || (/* @__PURE__ */ new Date()).toISOString();
    const feePct = params.platformFeePct ?? PLATFORM_FEE_PCT;
    const platformFeeUSD = Number((params.volumeUSD * (feePct / 100)).toFixed(6));
    const rates = getAffiliateRates();
    db.prepare(`
      UPDATE affiliate_referrals
      SET total_volume_usd = total_volume_usd + ?, swaps_count = swaps_count + 1, last_swap_at = ?
      WHERE id = ?
    `).run(params.volumeUSD, now, attribution.id);
    const referrer = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ? AND status = ?").get(attribution.referrer_wallet_address.toLowerCase(), "active");
    if (!referrer) return;
    const directRate = getEffectiveAffiliateRates(referrer, rates).directPct / 100;
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
        "comm_" + crypto3.randomUUID(),
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
        const overrideRate = getEffectiveAffiliateRates(bdm, rates).overridePct / 100;
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
            "comm_" + crypto3.randomUUID(),
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
affiliateRouter.get("/status/:walletAddress", (req, res) => {
  try {
    const cleanWallet = String(req.params.walletAddress || "").trim().toLowerCase();
    if (!cleanWallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    const affiliate = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ?").get(cleanWallet);
    const latestApplicationRow = db.prepare("SELECT * FROM affiliate_applications WHERE LOWER(wallet_address) = ? ORDER BY created_at DESC LIMIT 1").get(cleanWallet);
    const latestApplication = latestApplicationRow ? { ...latestApplicationRow, email: void 0 } : null;
    if (affiliate) {
      return res.json({
        walletAddress: cleanWallet,
        isApproved: affiliate.status === "active",
        status: affiliate.status,
        role: affiliate.role,
        // 'partner' | 'bdm'
        affiliate: { ...affiliate, email: void 0 },
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
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/apply", async (req, res) => {
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
      signedMessage
    } = req.body;
    const cleanRole = role === "bdm" ? "bdm" : "partner";
    const cleanWallet = String(walletAddress || "").trim().toLowerCase();
    if (!cleanWallet || !fullName || !email || !telegramUsername || !twitterLink || !telegramChannelLink) {
      return res.status(400).json({ error: "Please complete all required application fields" });
    }
    if (!isValidWalletAddress(String(walletAddress).trim())) {
      return res.status(400).json({ error: "Please connect a valid wallet address." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    const signatureError = consumeSignedChallenge({
      address: String(walletAddress).trim(),
      purpose: "affiliate_apply",
      message: signedMessage,
      signature
    });
    if (signatureError) {
      return res.status(401).json({ error: signatureError });
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
    let referringBdm = null;
    if (cleanRole === "partner" && bdmWalletAddress) {
      const candidate = String(bdmWalletAddress).trim().toLowerCase();
      const activeBdm = candidate !== cleanWallet ? db.prepare("SELECT id FROM affiliates WHERE LOWER(wallet_address) = ? AND role = 'bdm' AND status = 'active'").get(candidate) : null;
      if (activeBdm) referringBdm = candidate;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const appId = "app_" + crypto3.randomUUID();
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
      referringBdm,
      now,
      now
    );
    try {
      db.prepare(`
        INSERT INTO swap_campaign_events (
          id, campaign_id, wallet_address, event_name, event_data, created_at
        ) VALUES (?, 'campaign_genesis_001', ?, ?, ?, ?)
      `).run(
        "evt_" + crypto3.randomUUID(),
        cleanWallet,
        `affiliate_${cleanRole}_applied`,
        JSON.stringify({ appId, fullName, email, telegramUsername }),
        now
      );
    } catch {
    }
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
        message: message ? String(message).trim() : null
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
      status: "pending",
      message: `Your ${cleanRole === "bdm" ? "BDM" : "Partner"} application has been submitted and will be reviewed within 24 hours.`
    });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/track-ref", (req, res) => {
  try {
    const { refWallet, traderWallet } = req.body;
    if (!refWallet) {
      return res.status(400).json({ error: "refWallet is required" });
    }
    const cleanRef = String(refWallet).trim().toLowerCase();
    if (!isValidWalletAddress(String(refWallet).trim())) {
      return res.json({ success: true, valid: false, referrerRole: null, bound: false });
    }
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
    sendServerError(res, err, "affiliate api");
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
        telegramUsername: partner.telegram_username,
        status: partner.status,
        bdmWalletAddress: partner.bdm_wallet_address,
        referralLink: `https://novap2p.com/swap?ref=${partner.wallet_address}`,
        commissionRatePct: getEffectiveAffiliateRates(partner).directPct,
        // % of the 0.5% fee (custom or default)
        effectiveVolumePct: volumePct(getEffectiveAffiliateRates(partner).directPct),
        // % of volume
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
        effectiveVolumePct: Number((c.commission_rate * PLATFORM_FEE_PCT).toFixed(4)),
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
    sendServerError(res, err, "affiliate api");
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
        telegramUsername: bdm.telegram_username,
        status: bdm.status,
        referralLink: `https://novap2p.com/swap?ref=${bdm.wallet_address}`,
        partnerInviteLink: `https://novap2p.com/become-partner?bdm=${bdm.wallet_address}`,
        directCommissionRatePct: getEffectiveAffiliateRates(bdm).directPct,
        // % of fee on direct BDM link (custom or default)
        overrideRatePct: getEffectiveAffiliateRates(bdm).overridePct,
        // % of fee on managed partners (custom or default)
        partnerRatePct: getAffiliateRates().partnerRatePct,
        // % of fee earned by managed partners
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
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/payout/request", (req, res) => {
  try {
    const { walletAddress, payoutAddress, preferredNetwork, preferredToken, signature, signedMessage } = req.body;
    const cleanWallet = String(walletAddress || "").trim().toLowerCase();
    if (!cleanWallet || !payoutAddress || !preferredNetwork) {
      return res.status(400).json({ error: "Wallet address, payout destination, and network are required" });
    }
    if (String(payoutAddress).trim().length < 20 || String(payoutAddress).trim().length > 128) {
      return res.status(400).json({ error: "Please enter a valid payout wallet address." });
    }
    const signatureError = consumeSignedChallenge({
      address: String(walletAddress).trim(),
      purpose: "affiliate_payout",
      message: signedMessage,
      signature
    });
    if (signatureError) {
      return res.status(401).json({ error: signatureError });
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
    const payoutId = "affpay_" + crypto3.randomUUID();
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
    })();
    res.json({
      success: true,
      payoutId,
      amountUSD: availableBalance,
      status: "pending",
      message: "Payout request submitted! Processing takes within 24 hours."
    });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.get("/rates", (req, res) => {
  try {
    const rates = getAffiliateRates();
    res.json({
      ...rates,
      platformFeePct: PLATFORM_FEE_PCT,
      partnerVolumePct: volumePct(rates.partnerRatePct),
      bdmDirectVolumePct: volumePct(rates.bdmDirectRatePct),
      bdmOverrideVolumePct: volumePct(rates.bdmOverrideRatePct)
    });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.put("/admin/rates", verifyAdmin, (req, res) => {
  try {
    const fields = [
      ["partnerRatePct", "partner_rate_pct"],
      ["bdmDirectRatePct", "bdm_direct_rate_pct"],
      ["bdmOverrideRatePct", "bdm_override_rate_pct"]
    ];
    const values = {};
    for (const [field] of fields) {
      const n = Number(req.body?.[field]);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({ error: "Each rate must be a number between 0 and 100." });
      }
      values[field] = Number(n.toFixed(2));
    }
    if (values.partnerRatePct + values.bdmOverrideRatePct > 100) {
      return res.status(400).json({ error: "Partner % plus BDM override % cannot exceed 100% of the platform fee." });
    }
    const before = getAffiliateRates();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const upsert = db.prepare(`
      INSERT INTO affiliate_settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    db.transaction(() => {
      for (const [field, key] of fields) upsert.run(key, values[field], now);
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', 'update_affiliate_rates', 'affiliate_settings', 'rates', ?, ?, ?)
      `).run("log_" + crypto3.randomUUID(), JSON.stringify({ before, after: values }), String(req.ip || ""), now);
    })();
    res.json({ success: true, rates: getAffiliateRates() });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.get("/admin/overview", verifyAdmin, (req, res) => {
  try {
    const applications = db.prepare("SELECT * FROM affiliate_applications ORDER BY created_at DESC").all();
    const affiliates = db.prepare("SELECT * FROM affiliates ORDER BY total_referred_volume_usd DESC, created_at DESC").all();
    const payouts = db.prepare("SELECT * FROM affiliate_payouts ORDER BY created_at DESC").all();
    res.json({
      applications,
      affiliates,
      payouts,
      rates: getAffiliateRates()
    });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/admin/applications/:id/review", verifyAdmin, async (req, res) => {
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
    const applicantNotified = await notifyApplicant(req, result);
    return res.json({ ...result, applicantNotified });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
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
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/review-action", async (req, res) => {
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
    if (appRecord.status !== "pending") {
      return res.status(409).json({ error: `This application has already been ${appRecord.status}. Use the admin panel (/swap-admin) to make further changes.` });
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
    const applicantNotified = await notifyApplicant(req, result);
    return res.json({ ...result, applicantNotified });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/admin/affiliates/:walletAddress/update", verifyAdmin, (req, res) => {
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
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/admin/affiliates/:walletAddress/rates", verifyAdmin, (req, res) => {
  try {
    const cleanWallet = String(req.params.walletAddress || "").trim().toLowerCase();
    const existing = db.prepare("SELECT * FROM affiliates WHERE LOWER(wallet_address) = ?").get(cleanWallet);
    if (!existing) {
      return res.status(404).json({ error: "Affiliate not found" });
    }
    const parse = (v) => {
      if (v === null || v === void 0 || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? Number(n.toFixed(2)) : "invalid";
    };
    const customRate = parse(req.body?.customRatePct);
    const customOverride = existing.role === "bdm" ? parse(req.body?.customOverridePct) : null;
    if (customRate === "invalid" || customOverride === "invalid") {
      return res.status(400).json({ error: "Custom % must be a number between 0 and 100 (or empty for the default)." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.transaction(() => {
      db.prepare("UPDATE affiliates SET custom_rate_pct = ?, custom_override_pct = ?, updated_at = ? WHERE id = ?").run(customRate, customOverride, now, existing.id);
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', 'set_affiliate_custom_rate', 'affiliate', ?, ?, ?, ?)
      `).run(
        "log_" + crypto3.randomUUID(),
        existing.wallet_address,
        JSON.stringify({
          before: { customRatePct: existing.custom_rate_pct, customOverridePct: existing.custom_override_pct },
          after: { customRatePct: customRate, customOverridePct: customOverride }
        }),
        String(req.ip || ""),
        now
      );
    })();
    const updated = db.prepare("SELECT * FROM affiliates WHERE id = ?").get(existing.id);
    res.json({ success: true, effective: getEffectiveAffiliateRates(updated) });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});
affiliateRouter.post("/admin/payouts/:id/pay", verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { txHash, adminNotes } = req.body;
    const payout = db.prepare("SELECT * FROM affiliate_payouts WHERE id = ?").get(id);
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }
    if (payout.status === "paid") {
      return res.status(400).json({ error: "This payout has already been marked as paid." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
    res.json({ success: true, status: "paid" });
  } catch (err) {
    sendServerError(res, err, "affiliate api");
  }
});

// server/api.ts
import crypto4 from "crypto";

// server/cowSync.ts
import { keccak256, toUtf8Bytes, formatUnits } from "ethers";
var COW_NETWORKS = {
  1: { api: "mainnet", rpc: "https://ethereum-rpc.publicnode.com" },
  42161: { api: "arbitrum_one", rpc: "https://arb1.arbitrum.io/rpc" },
  8453: { api: "base", rpc: "https://mainnet.base.org" },
  56: { api: "bnb", rpc: "https://bsc-dataseed.binance.org" },
  137: { api: "polygon", rpc: "https://polygon-bor-rpc.publicnode.com" },
  43114: { api: "avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc" },
  59144: { api: "linea", rpc: "https://rpc.linea.build" },
  100: { api: "xdai", rpc: "https://rpc.gnosischain.com" },
  57073: { api: "ink", rpc: "https://rpc-gel.inkonchain.com" },
  9745: { api: "plasma", rpc: "https://rpc.plasma.to" }
};
var NOVA_PARTNER_FEE_BPS = 25;
var NOVA_PARTNER_FEE_RECIPIENT = "0x9b708d93d1230DA9957F71D07beC6F9a1EE31C12";
var NOVA_APP_DATA = JSON.stringify({
  appCode: "NovaSwap",
  metadata: { partnerFee: { volumeBps: NOVA_PARTNER_FEE_BPS, recipient: NOVA_PARTNER_FEE_RECIPIENT } },
  version: "1.6.0"
});
var CURRENT_APP_DATA_HASH = keccak256(toUtf8Bytes(NOVA_APP_DATA)).toLowerCase();
var LEGACY_APP_DATA_HASH = "0x3230754c0e71ebfbe685c7060ed28119597134332029ad017f3e988113e15ab9";
async function getJson(url, timeoutMs = 8e3, init) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...init?.headers || {} }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
function novaFeePctOf(order) {
  const hash = String(order?.appData || "").toLowerCase();
  let full = null;
  try {
    full = order?.fullAppData ? JSON.parse(order.fullAppData) : null;
  } catch {
    full = null;
  }
  const isNova = hash === CURRENT_APP_DATA_HASH || hash === LEGACY_APP_DATA_HASH || full?.appCode === "NovaSwap";
  if (!isNova) return null;
  const fee = full?.metadata?.partnerFee;
  if (fee && String(fee.recipient || "").toLowerCase() === NOVA_PARTNER_FEE_RECIPIENT.toLowerCase()) {
    const bps = Number(fee.volumeBps ?? fee.bps ?? 0);
    return Number.isFinite(bps) && bps > 0 ? bps / 100 : 0;
  }
  return hash === CURRENT_APP_DATA_HASH ? NOVA_PARTNER_FEE_BPS / 100 : 0;
}
var tokenCache = /* @__PURE__ */ new Map();
async function tokenInfo(chainId, address) {
  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = tokenCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1e3) return hit.data;
  const d = await getJson(`https://li.quest/v1/token?chain=${chainId}&token=${address}`);
  const data = d && Number.isFinite(Number(d.decimals)) ? { symbol: String(d.symbol || ""), decimals: Number(d.decimals), priceUSD: Number(d.priceUSD || 0) } : null;
  tokenCache.set(key, { at: Date.now(), data });
  return data;
}
async function blockTime(chainId, blockNumber) {
  const net = COW_NETWORKS[chainId];
  if (!net || !blockNumber) return null;
  const d = await getJson(net.rpc, 6e3, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["0x" + blockNumber.toString(16), false] })
  });
  const ts = parseInt(d?.result?.timestamp, 16);
  return Number.isFinite(ts) && ts > 0 ? new Date(ts * 1e3).toISOString() : null;
}
async function fetchNovaLimitFills(owner, isAlreadyHandled) {
  const wallet = owner.toLowerCase();
  const perChain = await Promise.all(
    Object.entries(COW_NETWORKS).map(async ([id, net]) => {
      const chainId = Number(id);
      const orders = await getJson(`https://api.cow.fi/${net.api}/api/v1/account/${wallet}/orders?offset=0&limit=100`);
      if (!Array.isArray(orders)) return [];
      const fills = [];
      for (const o of orders) {
        if (String(o?.owner || "").toLowerCase() !== wallet) continue;
        if (!["fulfilled", "cancelled", "expired"].includes(String(o?.status))) continue;
        const novaFeePct = novaFeePctOf(o);
        if (novaFeePct === null) continue;
        const uid = String(o.uid || "").toLowerCase();
        if (!/^0x[0-9a-f]{112}$/.test(uid) || isAlreadyHandled(chainId, uid)) continue;
        const executedSell = BigInt(o.executedSellAmount || "0");
        const executedBuy = BigInt(o.executedBuyAmount || "0");
        if (executedSell <= 0n || executedBuy <= 0n) continue;
        const trades = await getJson(`https://api.cow.fi/${net.api}/api/v1/trades?orderUid=${uid}`);
        if (!Array.isArray(trades) || trades.length === 0) continue;
        const last = trades.reduce((a, b) => Number(b.blockNumber) > Number(a.blockNumber) ? b : a);
        const settlementTxHash = String(last.txHash || "").toLowerCase();
        if (!/^0x[0-9a-f]{64}$/.test(settlementTxHash)) continue;
        const [sellT, buyT] = await Promise.all([tokenInfo(chainId, o.sellToken), tokenInfo(chainId, o.buyToken)]);
        const sellUSD = sellT && sellT.priceUSD > 0 ? Number(formatUnits(executedSell, sellT.decimals)) * sellT.priceUSD : 0;
        const buyUSD = buyT && buyT.priceUSD > 0 ? Number(formatUnits(executedBuy, buyT.decimals)) * buyT.priceUSD : 0;
        const volumeUSD = sellUSD > 0 && buyUSD > 0 ? Math.min(sellUSD, buyUSD) : Math.max(sellUSD, buyUSD);
        if (!Number.isFinite(volumeUSD) || volumeUSD <= 0) continue;
        const filledAt = await blockTime(chainId, Number(last.blockNumber)) || String(o.creationDate || (/* @__PURE__ */ new Date()).toISOString());
        fills.push({
          chainId,
          orderUid: uid,
          settlementTxHash,
          volumeUSD: Number(volumeUSD.toFixed(4)),
          novaFeePct,
          fromToken: { symbol: sellT?.symbol || "", address: String(o.sellToken) },
          toToken: { symbol: buyT?.symbol || "", address: String(o.buyToken) },
          fromAmount: executedSell.toString(),
          toAmount: executedBuy.toString(),
          filledAt
        });
      }
      return fills;
    })
  );
  return perChain.flat();
}

// server/pdfTable.ts
var PAGE_W = 842;
var PAGE_H = 595;
var MARGIN = 32;
var CELL_PAD = 4;
var MONO_W = 0.6;
function pdfSafe(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/₮/g, "T").replace(/[–—]/g, "-").replace(/[^\x20-\x7e]/g, "?");
}
var esc = (s) => pdfSafe(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function fit(text, maxChars, shorten) {
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  if (shorten && maxChars >= 9) {
    const tail = Math.floor((maxChars - 2) / 2);
    return `${text.slice(0, maxChars - 2 - tail)}..${text.slice(-tail)}`;
  }
  return text.slice(0, maxChars - 3) + "...";
}
function buildTablePdf(input) {
  const usable = PAGE_W - MARGIN * 2;
  const cols = input.columns;
  const rows = input.rows.map((r) => r.map((c) => pdfSafe(String(c ?? ""))));
  const natural = cols.map((c, i2) => {
    const longest = rows.reduce((m, r) => Math.max(m, (r[i2] || "").length), 0);
    const cap = c.shorten ? 16 : 34;
    return Math.max(Math.min(c.label.length, 26), Math.min(longest, cap), 3);
  });
  let fs2 = 7.5;
  const widthAt = (size, chars2) => chars2.reduce((s, n) => s + n * MONO_W * size + CELL_PAD * 2, 0);
  while (fs2 > 5.5 && widthAt(fs2, natural) > usable) fs2 -= 0.5;
  const chars = [...natural];
  while (widthAt(fs2, chars) > usable) {
    const widest = chars.indexOf(Math.max(...chars));
    if (chars[widest] <= 6) break;
    chars[widest] -= 1;
  }
  const spare = usable - widthAt(fs2, chars);
  const widths = chars.map((n) => n * MONO_W * fs2 + CELL_PAD * 2 + spare / chars.length);
  const rowH = fs2 * 2;
  const headH = rowH + 2;
  const titleBlock = input.subtitle ? 44 : 32;
  const footer = 22;
  const perFirst = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 - titleBlock - headH - footer) / rowH));
  const perNext = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 - headH - footer) / rowH));
  const pages = [];
  let i = 0;
  pages.push(rows.slice(0, perFirst));
  i = perFirst;
  while (i < rows.length) {
    pages.push(rows.slice(i, i + perNext));
    i += perNext;
  }
  const text = (font2, size, x, y, s, rgb = "0 0 0") => `BT ${rgb} rg /${font2} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET
`;
  const rect = (x, y, w, h, rgb) => `${rgb} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f
`;
  const streams = pages.map((pageRows, p) => {
    let out = "";
    let y = PAGE_H - MARGIN;
    if (p === 0) {
      out += text("F2", 14, MARGIN, y - 14, input.title, "0.06 0.09 0.16");
      if (input.subtitle) out += text("F1", 8, MARGIN, y - 28, input.subtitle, "0.4 0.45 0.52");
      y -= titleBlock;
    }
    out += rect(MARGIN, y - headH, usable, headH, "0.12 0.16 0.23");
    let x = MARGIN;
    cols.forEach((c, ci) => {
      const label = fit(pdfSafe(c.label), chars[ci]);
      const tx = c.align === "right" ? x + widths[ci] - CELL_PAD - label.length * MONO_W * fs2 : x + CELL_PAD;
      out += text("F4", fs2, tx, y - headH + (headH - fs2) / 2 + 1, label, "1 1 1");
      x += widths[ci];
    });
    y -= headH;
    pageRows.forEach((r, ri) => {
      if (ri % 2 === 1) out += rect(MARGIN, y - rowH, usable, rowH, "0.95 0.96 0.97");
      let cx = MARGIN;
      cols.forEach((c, ci) => {
        const v = fit(r[ci] || "", chars[ci], c.shorten);
        const tx = c.align === "right" ? cx + widths[ci] - CELL_PAD - v.length * MONO_W * fs2 : cx + CELL_PAD;
        out += text("F3", fs2, tx, y - rowH + (rowH - fs2) / 2 + 1, v, "0.1 0.12 0.16");
        cx += widths[ci];
      });
      y -= rowH;
    });
    if (rows.length === 0 && p === 0) {
      out += text("F1", 9, MARGIN + CELL_PAD, y - 16, "No records.", "0.4 0.45 0.52");
    }
    out += text("F1", 7, MARGIN, MARGIN - 12, `${input.title}`, "0.5 0.55 0.6");
    const pn = `Page ${p + 1} of ${pages.length}`;
    out += text("F1", 7, PAGE_W - MARGIN - pn.length * 3.6, MARGIN - 12, pn, "0.5 0.55 0.6");
    return out;
  });
  const objects = [];
  const pageIds = pages.map((_, p) => 7 + p * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const font = (name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  objects[3] = font("Helvetica");
  objects[4] = font("Helvetica-Bold");
  objects[5] = font("Courier");
  objects[6] = font("Courier-Bold");
  streams.forEach((s, p) => {
    const pageId = pageIds[p];
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${Buffer.byteLength(s, "latin1")} >>
stream
${s}endstream`;
  });
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj
${objects[id]}
endobj
`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref
0 ${objects.length}
0000000000 65535 f 
`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n 
`;
  pdf += `trailer
<< /Size ${objects.length} /Root 1 0 R >>
startxref
${xref}
%%EOF
`;
  return Buffer.from(pdf, "latin1");
}

// server/adminReports.ts
var CURRENT_CAMPAIGN_ID = "campaign_genesis_001";
var CHAIN_NAMES = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  100: "Gnosis",
  130: "Unichain",
  137: "Polygon",
  146: "Sonic",
  250: "Fantom",
  288: "Boba",
  324: "zkSync",
  480: "World Chain",
  1088: "Metis",
  1101: "Polygon zkEVM",
  1135: "Lisk",
  1284: "Moonbeam",
  1329: "Sei",
  2741: "Abstract",
  5e3: "Mantle",
  8453: "Base",
  9745: "Plasma",
  13371: "Immutable zkEVM",
  25: "Cronos",
  33139: "ApeChain",
  34443: "Mode",
  42161: "Arbitrum",
  42220: "Celo",
  43114: "Avalanche",
  57073: "Ink",
  59144: "Linea",
  60808: "BOB",
  80094: "Berachain",
  81457: "Blast",
  167e3: "Taiko",
  534352: "Scroll",
  999: "HyperEVM",
  1151111081099710: "Solana",
  728126428: "TRON",
  927e13: "Sui",
  20000000000001: "Bitcoin"
};
var chainName = (id) => id == null ? "" : CHAIN_NAMES[Number(id)] || `Chain ${id}`;
var monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
var monthStart = (y, m0) => new Date(Date.UTC(y, m0, 1));
function monthsBetween(start, end, max = 240) {
  const list = [];
  let [y, m] = start.split("-").map(Number);
  while (list.length < max) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > end) break;
    list.push(key);
    m += 1;
    if (m > 12) {
      y += 1;
      m = 1;
    }
  }
  return list;
}
var monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};
function periodRange(period, month, now = /* @__PURE__ */ new Date()) {
  const y = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  if (period === "current") {
    return { from: monthStart(y, m0).toISOString(), to: monthStart(y, m0 + 1).toISOString(), label: monthLabel(monthKey(now)) };
  }
  if (period === "last6") {
    const from = monthStart(y, m0 - 5);
    return {
      from: from.toISOString(),
      to: monthStart(y, m0 + 1).toISOString(),
      label: `${monthLabel(monthKey(from))} \u2013 ${monthLabel(monthKey(now))}`
    };
  }
  if (period === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
    if (!match) throw new Error("Choose a month (YYYY-MM).");
    const yy = Number(match[1]);
    const mm = Number(match[2]) - 1;
    if (mm < 0 || mm > 11) throw new Error("Choose a valid month.");
    return { from: monthStart(yy, mm).toISOString(), to: monthStart(yy, mm + 1).toISOString(), label: monthLabel(match[0]) };
  }
  return { from: null, to: null, label: "All time" };
}
var inRange = (col, r) => r.from && r.to ? { sql: ` AND ${col} >= ? AND ${col} < ?`, params: [r.from, r.to] } : { sql: "", params: [] };
function getPeriodAnalytics(period, month, now = /* @__PURE__ */ new Date()) {
  const range = periodRange(period, month, now);
  const tx = inRange("created_at", range);
  const totals = db.prepare(`
    SELECT COUNT(*) as swaps, COALESCE(SUM(volume_usd), 0) as volume, COUNT(DISTINCT wallet_address) as swapping_wallets
    FROM swap_transactions WHERE execution_status = 'DONE'${tx.sql}
  `).get(...tx.params);
  const firstSeen = `(SELECT wallet_address, MIN(created_at) AS first_at FROM swap_campaign_users GROUP BY wallet_address)`;
  const fs2 = inRange("first_at", range);
  const wallets = db.prepare(`SELECT COUNT(*) as n FROM ${firstSeen} WHERE 1 = 1${fs2.sql}`).get(...fs2.params);
  const byChain = db.prepare(`
    SELECT chain_id, COUNT(*) as swaps, COALESCE(SUM(volume_usd), 0) as volume
    FROM swap_transactions WHERE execution_status = 'DONE'${tx.sql}
    GROUP BY chain_id ORDER BY volume DESC
  `).all(...tx.params).map((r) => ({
    chainId: Number(r.chain_id),
    chainName: chainName(r.chain_id),
    swaps: r.swaps,
    volumeUSD: Number(Number(r.volume).toFixed(2))
  }));
  const txByMonth = new Map(
    db.prepare(`
      SELECT substr(created_at, 1, 7) as m, COUNT(*) as swaps, COALESCE(SUM(volume_usd), 0) as volume
      FROM swap_transactions WHERE execution_status = 'DONE'${tx.sql} GROUP BY m
    `).all(...tx.params).map((r) => [r.m, { swaps: r.swaps, volume: r.volume }])
  );
  const walletsByMonth = new Map(
    db.prepare(`SELECT substr(first_at, 1, 7) as m, COUNT(*) as n FROM ${firstSeen} WHERE 1 = 1${fs2.sql} GROUP BY m`).all(...fs2.params).map(
      (r) => [r.m, r.n]
    )
  );
  const firstMonth = availableMonths(now)[0] || monthKey(now);
  const startKey = range.from ? range.from.slice(0, 7) : firstMonth;
  const endKey = range.to ? monthKey(new Date(Date.parse(range.to) - 1)) : monthKey(now);
  const months = monthsBetween(startKey, endKey, 120).map((key) => {
    const t = txByMonth.get(key);
    return {
      month: key,
      label: monthLabel(key),
      volumeUSD: Number((t?.volume || 0).toFixed(2)),
      swaps: t?.swaps || 0,
      newWallets: walletsByMonth.get(key) || 0
    };
  });
  return {
    period,
    label: range.label,
    from: range.from,
    to: range.to,
    totals: {
      volumeUSD: Number(Number(totals.volume).toFixed(2)),
      swaps: totals.swaps || 0,
      connectedWallets: wallets.n || 0,
      swappingWallets: totals.swapping_wallets || 0
    },
    byChain,
    months,
    availableMonths: availableMonths(now)
  };
}
function availableMonths(now = /* @__PURE__ */ new Date()) {
  const row = db.prepare(`
    SELECT MIN(m) as first FROM (
      SELECT MIN(created_at) as m FROM swap_transactions
      UNION ALL SELECT MIN(created_at) FROM swap_campaign_users
    ) WHERE m IS NOT NULL
  `).get();
  const end = monthKey(now);
  const start = typeof row?.first === "string" && /^\d{4}-\d{2}/.test(row.first) ? row.first.slice(0, 7) : end;
  return monthsBetween(start, end);
}
var ROUND_SQL = (alias) => `
  CASE WHEN ${alias}.campaign_id = '${CURRENT_CAMPAIGN_ID}' THEN 'Current'
       ELSE 'Archived ' || COALESCE(substr(rc.end_date, 1, 10), '') END`;
function buildExport(type) {
  if (type === "users") {
    return {
      title: "Nova Swap - Users",
      fileBase: "nova_swap_users",
      columns: [
        { key: "wallet_address", label: "Wallet", kind: "hash" },
        { key: "round", label: "Campaign round" },
        { key: "chain", label: "Chain" },
        { key: "total_volume_usd", label: "Volume (USD)", kind: "usd" },
        { key: "eligible_swaps_count", label: "Swaps", kind: "number" },
        { key: "referral_code", label: "Referral code" },
        { key: "is_flagged", label: "Flagged", kind: "bool" },
        { key: "verified_at", label: "Verified (UTC)", kind: "date" },
        { key: "created_at", label: "Joined (UTC)", kind: "date" }
      ],
      rows: db.prepare(`
        SELECT u.*, ${ROUND_SQL("u")} as round
        FROM swap_campaign_users u LEFT JOIN swap_campaigns rc ON rc.id = u.campaign_id
        ORDER BY (u.campaign_id = '${CURRENT_CAMPAIGN_ID}') DESC, u.total_volume_usd DESC
      `).all().map((r) => ({ ...r, chain: chainName(r.chain_id), referral_code: String(r.referral_code || "").split("-")[0] }))
    };
  }
  if (type === "transactions") {
    return {
      title: "Nova Swap - Swaps",
      fileBase: "nova_swap_swaps",
      columns: [
        { key: "created_at", label: "Date (UTC)", kind: "date" },
        { key: "wallet_address", label: "Wallet", kind: "hash" },
        { key: "chain", label: "Chain" },
        { key: "kind", label: "Type" },
        { key: "from_token_symbol", label: "From" },
        { key: "to_token_symbol", label: "To" },
        { key: "volume_usd", label: "Volume (USD)", kind: "usd" },
        { key: "execution_status", label: "Status" },
        { key: "round", label: "Campaign round" },
        { key: "tx_hash", label: "Tx hash / order id", kind: "hash" }
      ],
      rows: db.prepare(`
        SELECT t.*, ${ROUND_SQL("t")} as round
        FROM swap_transactions t LEFT JOIN swap_campaigns rc ON rc.id = t.campaign_id
        ORDER BY t.created_at DESC
      `).all().map((r) => ({
        ...r,
        chain: chainName(r.chain_id),
        kind: r.verification_source === "cow_orderbook_api" ? "Limit order" : "Market swap"
      }))
    };
  }
  if (type === "claims") {
    return {
      title: "Nova Swap - Reward Claims",
      fileBase: "nova_swap_claims",
      columns: [
        { key: "created_at", label: "Requested (UTC)", kind: "date" },
        { key: "wallet_address", label: "Wallet", kind: "hash" },
        { key: "requested_amount_usd", label: "Amount (USD)", kind: "usd" },
        { key: "status", label: "Status" },
        { key: "payout_address", label: "Payout address", kind: "hash" },
        { key: "preferred_network", label: "Network" },
        { key: "preferred_token", label: "Token" },
        { key: "payout_tx_hash", label: "Payout tx", kind: "hash" },
        { key: "paid_at", label: "Paid (UTC)", kind: "date" },
        { key: "round", label: "Campaign round" },
        { key: "id", label: "Claim id" }
      ],
      rows: db.prepare(`
        SELECT c.id, u.wallet_address, c.requested_amount_usd, c.payout_address, c.preferred_network, c.preferred_token,
               c.status, p.payout_tx_hash, p.paid_at, c.created_at, ${ROUND_SQL("c")} as round
        FROM swap_reward_claims c
        JOIN swap_campaign_users u ON u.id = c.user_id
        LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
        LEFT JOIN swap_campaigns rc ON rc.id = c.campaign_id
        ORDER BY c.created_at DESC
      `).all()
    };
  }
  return {
    title: "Nova Swap - Referrals",
    fileBase: "nova_swap_referrals",
    columns: [
      { key: "created_at", label: "Date (UTC)", kind: "date" },
      { key: "referrer_wallet", label: "Referrer", kind: "hash" },
      { key: "referred_wallet", label: "Referred wallet", kind: "hash" },
      { key: "referral_code", label: "Code" },
      { key: "status", label: "Status" },
      { key: "qualifying_volume_usd", label: "Qualifying volume (USD)", kind: "usd" },
      { key: "reward_amount_usd", label: "Reward (USD)", kind: "usd" },
      { key: "round", label: "Campaign round" }
    ],
    rows: db.prepare(`
      SELECT r.*, u1.wallet_address as referrer_wallet, u2.wallet_address as referred_wallet, ${ROUND_SQL("r")} as round
      FROM swap_referrals r
      JOIN swap_campaign_users u1 ON u1.id = r.referrer_user_id
      JOIN swap_campaign_users u2 ON u2.id = r.referred_user_id
      LEFT JOIN swap_campaigns rc ON rc.id = r.campaign_id
      ORDER BY r.created_at DESC
    `).all().map((r) => ({ ...r, referral_code: String(r.referral_code || "").split("-")[0] }))
  };
}
function cellText(value, kind) {
  if (value === null || value === void 0 || value === "") return "";
  if (kind === "usd") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "";
  }
  if (kind === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "";
  }
  if (kind === "bool") return Number(value) ? "Yes" : "No";
  if (kind === "date") {
    const t = Date.parse(String(value));
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 19).replace("T", " ") : String(value);
  }
  return String(value).replace(/[\r\n\t]+/g, " ").trim();
}
function toCsv(table) {
  const esc2 = (s) => `"${s.replace(/"/g, '""')}"`;
  const safe = (s, kind) => kind !== "usd" && kind !== "number" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  const lines = [table.columns.map((c) => esc2(c.label)).join(",")];
  for (const row of table.rows) {
    lines.push(
      table.columns.map((c) => {
        const text = cellText(row[c.key], c.kind);
        return c.kind === "usd" || c.kind === "number" ? text : esc2(safe(text, c.kind));
      }).join(",")
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
function toPdf(table, generatedAt = /* @__PURE__ */ new Date()) {
  return buildTablePdf({
    title: table.title,
    subtitle: `${table.rows.length} record${table.rows.length === 1 ? "" : "s"} - generated ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    columns: table.columns.map((c) => ({ label: c.label, align: c.kind === "usd" || c.kind === "number" ? "right" : "left", shorten: c.kind === "hash" })),
    rows: table.rows.map((r) => table.columns.map((c) => cellText(r[c.key], c.kind)))
  });
}

// server/api.ts
var apiRouter = Router2();
var ENABLED_CHAINS = [1, 56, 137, 42161, 10, 8453];
var DEFAULT_CAMPAIGN_ID = "campaign_genesis_001";
var CLAIM_THRESHOLD_USD = 500;
function getClaimThresholdUSD(campaign) {
  const value = Number(campaign?.claim_threshold_usd);
  return Number.isFinite(value) && value > 0 ? value : CLAIM_THRESHOLD_USD;
}
var LIFI_INTEGRATOR = (process.env.LIFI_INTEGRATOR || process.env.VITE_VELORA_PARTNER || "nova-p2p").toLowerCase();
var TX_HASH_PATTERN = /^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{43,100})$/;
function clientIp(req) {
  return String(req.ip || req.socket.remoteAddress || "");
}
function findOrCreateCampaignUser(normalizedAddress, campaignId, chainId = 1) {
  let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
  if (user) return user;
  let newRefCode = "";
  while (true) {
    newRefCode = "NOVA" + crypto4.randomBytes(3).toString("hex").toUpperCase();
    const exists = db.prepare("SELECT id FROM swap_campaign_users WHERE referral_code = ?").get(newRefCode);
    if (!exists) break;
  }
  const userId = "usr_" + crypto4.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO swap_campaign_users (
      id, campaign_id, wallet_address, chain_id, signature, verified_at,
      referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
      is_flagged, last_active_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, campaignId, normalizedAddress, chainId, "auto_connected", now, newRefCode, null, 0, 0, 0, now, now);
  return db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
}
function isNovaIntegratorTransfer(record) {
  const integrator = String(record?.metadata?.integrator || record?.integrator || "").toLowerCase();
  return integrator === LIFI_INTEGRATOR;
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
        claimThresholdUSD: getClaimThresholdUSD(campaign),
        rewardsHeading: campaign.rewards_heading,
        rewardsBadgeText: campaign.rewards_badge_text,
        resetAt: campaign.reset_at || null,
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
    sendServerError(res, err, "swap api");
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
    const ip = clientIp(req);
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, user_id, event_name, event_data, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_" + crypto4.randomUUID(),
      DEFAULT_CAMPAIGN_ID,
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
    sendServerError(res, err, "swap api");
  }
});
apiRouter.post("/events", (req, res) => {
  try {
    const { eventName, walletAddress, eventData } = req.body;
    if (!eventName) {
      return res.status(400).json({ error: "Event name is required" });
    }
    const ip = clientIp(req);
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, wallet_address, event_name, event_data, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_" + crypto4.randomUUID(),
      DEFAULT_CAMPAIGN_ID,
      walletAddress ? String(walletAddress).toLowerCase() : null,
      eventName,
      eventData ? JSON.stringify(eventData) : null,
      String(ip || ""),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err, "swap api");
  }
});
apiRouter.get("/auth/nonce", (req, res) => {
  try {
    const { address } = req.query;
    if (!address || typeof address !== "string" || !isValidWalletAddress(address)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }
    res.json(issueChallenge(address, "verify_wallet"));
  } catch (err) {
    sendServerError(res, err, "auth/nonce");
  }
});
apiRouter.get("/auth/challenge", (req, res) => {
  try {
    const { address, purpose } = req.query;
    if (!address || typeof address !== "string" || !isValidWalletAddress(address)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }
    if (!isSignaturePurpose(purpose)) {
      return res.status(400).json({ error: "Invalid signature purpose" });
    }
    if (getWalletKind(address) === "tron") {
      return res.status(400).json({ error: "Please connect an EVM (e.g. MetaMask, Trust Wallet) or Solana wallet to sign this request." });
    }
    res.json(issueChallenge(address, purpose));
  } catch (err) {
    sendServerError(res, err, "auth/challenge");
  }
});
apiRouter.post("/auth/verify", async (req, res) => {
  try {
    const { address, signature, message, chainId, refCode } = req.body;
    if (!address || !signature || !message || !isValidWalletAddress(address)) {
      return res.status(400).json({ error: "Address, signature and message are required" });
    }
    const normalizedAddress = String(address).toLowerCase();
    const signatureError = consumeSignedChallenge({ address, purpose: "verify_wallet", message, signature });
    if (signatureError) {
      return res.status(400).json({ error: signatureError });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const campaignId = DEFAULT_CAMPAIGN_ID;
    let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
    if (!user) {
      let newRefCode = "";
      while (true) {
        newRefCode = "NP" + crypto4.randomBytes(3).toString("hex").toUpperCase();
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
      const userId = "usr_" + crypto4.randomUUID();
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
        const ip2 = clientIp(req);
        db.prepare(`
          INSERT OR IGNORE INTO swap_referrals (
            id, campaign_id, referrer_user_id, referred_user_id, referral_code,
            visitor_ip, status, qualifying_volume_usd, reward_amount_usd, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "ref_" + crypto4.randomUUID(),
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
    const ip = clientIp(req);
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, user_id, wallet_address, event_name, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("evt_" + crypto4.randomUUID(), campaignId, user.id, normalizedAddress, "wallet_connected", String(ip || ""), now);
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
    sendServerError(res, err, "swap api");
  }
});
function recordSwapTransactionInternal(params) {
  const run = db.transaction(() => {
    const existingTx = db.prepare("SELECT id FROM swap_transactions WHERE chain_id = ? AND tx_hash = ?").get(params.numericChainId, params.normalizedTxHash);
    if (existingTx) {
      return { success: false, newlyUnlocked: [], duplicate: true };
    }
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(params.campaignId);
    const minSwapUSD = campaign ? campaign.min_swap_usd : 1;
    if (params.volumeUSD < minSwapUSD) {
      return { success: false, newlyUnlocked: [], belowMin: true };
    }
    const swapTime = Date.parse(params.swapTimestamp || params.verifiedAt || "");
    const resetTime = Date.parse(campaign?.reset_at || "");
    if (Number.isFinite(resetTime) && Number.isFinite(swapTime) && swapTime < resetTime) {
      return { success: false, newlyUnlocked: [], beforeReset: true };
    }
    const now = params.verifiedAt || (/* @__PURE__ */ new Date()).toISOString();
    const txId = "tx_" + crypto4.randomUUID();
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
      const novaFeeCollectedUSD = params.volumeUSD * ((params.novaFeePct ?? 0.5) / 100);
      const cashbackRate = (campaign.cashback_percentage ?? 5) / 100;
      const creditedCashbackUSD = Number((novaFeeCollectedUSD * cashbackRate).toFixed(4));
      if (creditedCashbackUSD > 0) {
        const cbId = "cb_" + crypto4.randomUUID();
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
        const cbRewardId = "rwd_cb_" + crypto4.randomUUID();
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
          const rewardId = "rwd_" + crypto4.randomUUID();
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
    if (campaign && user?.referred_by_user_id) {
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
          const refRewardId = "rwd_ref_" + crypto4.randomUUID();
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
      verifiedAt: now,
      platformFeePct: params.novaFeePct
    });
    return { success: true, newlyUnlocked, txId };
  });
  try {
    return run();
  } catch (err) {
    if (String(err?.message || "").includes("UNIQUE constraint failed: swap_transactions")) {
      return { success: false, newlyUnlocked: [], duplicate: true };
    }
    throw err;
  }
}
var userSyncCache = /* @__PURE__ */ new Map();
var LIFI_SYNC_INTERVAL_MS = 2e4;
async function syncUserTransfersFromLiFi(walletAddress, campaignId = DEFAULT_CAMPAIGN_ID) {
  const normalized = walletAddress.toLowerCase();
  const now = Date.now();
  const lastSync = userSyncCache.get(normalized) || 0;
  if (now - lastSync < LIFI_SYNC_INTERVAL_MS) return;
  userSyncCache.set(normalized, now);
  try {
    const user = findOrCreateCampaignUser(normalized, campaignId, 1);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e3);
    const lifiRes = await fetch(
      `https://li.quest/v1/analytics/transfers?integrator=${encodeURIComponent(LIFI_INTEGRATOR)}&wallet=${encodeURIComponent(walletAddress)}`,
      {
        headers: { "Accept": "application/json" },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    if (lifiRes.ok) {
      const data = await lifiRes.json();
      const transfers = Array.isArray(data?.transfers) ? data.transfers : [];
      for (const t of transfers) {
        if (t.status !== "DONE") continue;
        if (!isNovaIntegratorTransfer(t)) continue;
        if (String(t.fromAddress || "").toLowerCase() !== normalized) continue;
        const txHash = (t.sending?.txHash || t.receiving?.txHash || t.transactionId || "").toLowerCase();
        if (!txHash) continue;
        const chainId = Number(t.sending?.chainId || t.receiving?.chainId || 0);
        if (!chainId) continue;
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
          verifiedAt,
          swapTimestamp: verifiedAt
        });
      }
    }
  } catch (err) {
    console.warn(`[LI.FI Sync] Auto-sync skipped for ${normalized}:`, err?.message || err);
  }
}
var cowSyncCache = /* @__PURE__ */ new Map();
var cowSyncInFlight = /* @__PURE__ */ new Set();
var cowSkippedOrders = /* @__PURE__ */ new Set();
var COW_SYNC_INTERVAL_MS = 3e4;
function syncUserLimitOrdersFromCow(walletAddress, campaignId = DEFAULT_CAMPAIGN_ID) {
  const normalized = walletAddress.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) return;
  const now = Date.now();
  if (cowSyncInFlight.has(normalized) || now - (cowSyncCache.get(normalized) || 0) < COW_SYNC_INTERVAL_MS) return;
  cowSyncCache.set(normalized, now);
  cowSyncInFlight.add(normalized);
  fetchNovaLimitFills(
    normalized,
    (chainId, uid) => cowSkippedOrders.has(`${chainId}:${uid}`) || Boolean(db.prepare("SELECT id FROM swap_transactions WHERE chain_id = ? AND tx_hash = ?").get(chainId, uid))
  ).then((fills) => {
    if (fills.length === 0) return;
    const user = findOrCreateCampaignUser(normalized, campaignId, fills[0].chainId);
    for (const f of fills) {
      const result = recordSwapTransactionInternal({
        campaignId,
        userId: user.id,
        normalizedAddress: normalized,
        numericChainId: f.chainId,
        normalizedTxHash: f.orderUid,
        volumeUSD: f.volumeUSD,
        fromToken: f.fromToken,
        toToken: f.toToken,
        fromAmount: f.fromAmount,
        toAmount: f.toAmount,
        lifiRouteId: null,
        rawRouteData: { source: "cow_limit_order", orderUid: f.orderUid, settlementTxHash: f.settlementTxHash, novaFeePct: f.novaFeePct },
        verificationSource: "cow_orderbook_api",
        verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        swapTimestamp: f.filledAt,
        novaFeePct: f.novaFeePct
      });
      if (result.belowMin || result.beforeReset) cowSkippedOrders.add(`${f.chainId}:${f.orderUid}`);
    }
  }).catch((err) => console.warn(`[CoW Sync] Limit order sync skipped for ${normalized}:`, err?.message || err)).finally(() => cowSyncInFlight.delete(normalized));
}
apiRouter.get("/user/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress || !isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }
    const normalizedAddress = walletAddress.toLowerCase();
    const campaignId = DEFAULT_CAMPAIGN_ID;
    await syncUserTransfersFromLiFi(walletAddress, campaignId);
    syncUserLimitOrdersFromCow(walletAddress, campaignId);
    const user = findOrCreateCampaignUser(normalizedAddress, campaignId, 1);
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(campaignId);
    const milestones = db.prepare(`
      SELECT * FROM swap_campaign_milestones
      WHERE campaign_id = ? AND is_active = 1
      ORDER BY sort_order ASC, target_volume_usd ASC
    `).all(campaignId);
    const rewards = db.prepare(`
      SELECT r.*, c.id as claim_id, c.status as claim_status, c.payout_address, c.preferred_network, c.preferred_token,
             p.payout_tx_hash, p.payout_network as paid_network, p.paid_at
      FROM swap_rewards r
      LEFT JOIN swap_reward_claims c ON c.id = COALESCE(r.claim_id, (SELECT c2.id FROM swap_reward_claims c2 WHERE c2.reward_id = r.id ORDER BY c2.created_at DESC LIMIT 1))
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
        const claimStatus = rewardRecord.claim_status;
        const rewardStatus = rewardRecord.status;
        if (rewardStatus === "paid" || claimStatus === "paid") status = "paid";
        else if (claimStatus === "approved" || rewardStatus === "approved") status = "approved";
        else if (claimStatus === "under_review" || rewardStatus === "under_review") status = "under_review";
        else if (claimStatus === "frozen" || rewardStatus === "frozen") status = "frozen";
        else if (claimStatus === "pending" || rewardStatus === "requested") status = "requested";
        else if (rewardStatus === "rejected") status = "rejected";
        else status = "unlocked";
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
    const claimableRow = db.prepare(`
      SELECT COALESCE(SUM(amount_usd), 0) as claimable
      FROM swap_rewards
      WHERE user_id = ? AND status = 'unlocked'
    `).get(user.id);
    const totalAccumulatedRewardsUSD = Number((claimableRow?.claimable || 0).toFixed(2));
    const claimThresholdUSD = getClaimThresholdUSD(campaign);
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
        cashbackPercentage: campaign?.cashback_percentage ?? 5
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
    sendServerError(res, err, "user dashboard");
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
      lifiRouteId,
      rawRouteData
    } = req.body;
    if (!walletAddress || !chainId || !txHash) {
      return res.status(400).json({ error: "walletAddress, chainId and txHash are required" });
    }
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (typeof txHash !== "string" || !TX_HASH_PATTERN.test(txHash.trim())) {
      return res.status(400).json({ error: "Invalid transaction hash" });
    }
    const normalizedAddress = String(walletAddress).toLowerCase();
    const rawTxHash = txHash.trim();
    const normalizedTxHash = rawTxHash.toLowerCase();
    const numericChainId = Number(chainId);
    if (!numericChainId || isNaN(numericChainId) || numericChainId <= 0) {
      return res.status(400).json({ error: `Invalid Chain ID ${chainId}` });
    }
    const campaignId = DEFAULT_CAMPAIGN_ID;
    const existingTx = db.prepare("SELECT id FROM swap_transactions WHERE chain_id = ? AND tx_hash = ?").get(numericChainId, normalizedTxHash);
    if (existingTx) {
      return res.status(409).json({ error: "Transaction hash has already been credited for this chain" });
    }
    let lifiData = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8e3);
      const lifiStatusRes = await fetch(
        `https://li.quest/v1/status?txHash=${encodeURIComponent(rawTxHash)}&fromChain=${numericChainId}`,
        { headers: { "Accept": "application/json" }, signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (lifiStatusRes.ok) {
        lifiData = await lifiStatusRes.json();
      }
    } catch (e) {
      lifiData = null;
    }
    if (!lifiData || lifiData.status !== "DONE") {
      return res.status(202).json({
        success: false,
        pending: true,
        message: "Swap is being confirmed by LI.FI. Your volume will update automatically once it is final."
      });
    }
    if (!isNovaIntegratorTransfer(lifiData)) {
      return res.status(400).json({ error: "This swap was not executed through Nova Swap and is not eligible for the campaign." });
    }
    const senderAddress = String(lifiData.fromAddress || lifiData.sending?.fromAddress || "").toLowerCase();
    if (!senderAddress || senderAddress !== normalizedAddress) {
      return res.status(400).json({ error: "This swap was not sent from the connected wallet." });
    }
    const canonicalTxHash = String(lifiData.sending?.txHash || "").toLowerCase();
    const canonicalChainId = Number(lifiData.sending?.chainId || numericChainId);
    if (!canonicalTxHash) {
      return res.status(202).json({
        success: false,
        pending: true,
        message: "Swap is being confirmed by LI.FI. Your volume will update automatically once it is final."
      });
    }
    const verifiedVolume = parseFloat(lifiData.sending?.amountUSD || "0");
    if (isNaN(verifiedVolume) || verifiedVolume <= 0) {
      return res.status(202).json({
        success: false,
        pending: true,
        message: "Swap volume is still being priced by LI.FI. It will be credited automatically."
      });
    }
    const user = findOrCreateCampaignUser(normalizedAddress, campaignId, canonicalChainId);
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(campaignId);
    const minSwapUSD = campaign ? campaign.min_swap_usd : 1;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = recordSwapTransactionInternal({
      campaignId,
      userId: user.id,
      normalizedAddress,
      numericChainId: canonicalChainId,
      normalizedTxHash: canonicalTxHash,
      volumeUSD: verifiedVolume,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      lifiRouteId: typeof lifiRouteId === "string" ? lifiRouteId : null,
      rawRouteData,
      verificationSource: "lifi_status_api",
      verifiedAt: now,
      swapTimestamp: lifiData.sending?.timestamp ? new Date(Number(lifiData.sending.timestamp) * 1e3).toISOString() : now
    });
    if (result.duplicate) {
      return res.status(409).json({ error: "Transaction hash has already been credited for this chain" });
    }
    if (result.beforeReset) {
      return res.status(400).json({ error: "This swap was made before the current campaign round started and does not count toward it." });
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
    sendServerError(res, err, "submit-transaction");
  }
});
apiRouter.post("/rewards/request", async (req, res) => {
  try {
    const { walletAddress, rewardId, preferredNetwork, preferredToken, claimAmountUSD, signature, message, signerAddress } = req.body;
    if (!walletAddress || !isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: "walletAddress is required" });
    }
    const normalizedAddress = String(walletAddress).toLowerCase();
    const signingAddress = typeof signerAddress === "string" && signerAddress.trim() ? signerAddress.trim() : String(walletAddress).trim();
    if (signingAddress.toLowerCase() !== normalizedAddress) {
      return res.status(400).json({ error: "Signing wallet does not match the claim wallet." });
    }
    const signatureError = consumeSignedChallenge({ address: signingAddress, purpose: "reward_claim", message, signature });
    if (signatureError) {
      return res.status(401).json({ error: signatureError });
    }
    const payoutAddress = signingAddress;
    const user = db.prepare("SELECT id, campaign_id, is_flagged FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(DEFAULT_CAMPAIGN_ID, normalizedAddress);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.is_flagged) {
      return res.status(403).json({ error: "This wallet is under review and cannot submit claims at the moment. Please contact support@novap2p.com." });
    }
    const pendingClaim = db.prepare(`
      SELECT id FROM swap_reward_claims
      WHERE user_id = ? AND status IN ('pending', 'under_review')
    `).get(user.id);
    if (pendingClaim) {
      return res.status(400).json({ error: "You already have an active claim under review. Please wait for admin approval before submitting another claim." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const claimId = "clm_" + crypto4.randomUUID();
    if (rewardId && rewardId !== "threshold_500" && rewardId !== "accumulated_rewards") {
      const reward = db.prepare("SELECT * FROM swap_rewards WHERE id = ? AND user_id = ?").get(rewardId, user.id);
      if (!reward) {
        return res.status(404).json({ error: "Reward record not found for this wallet" });
      }
      if (reward.status !== "unlocked") {
        return res.status(400).json({ error: `Reward cannot be requested in status: ${reward.status}` });
      }
      const submitClaim = db.transaction(() => {
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
          payoutAddress,
          preferredNetwork || "BNB Smart Chain",
          preferredToken || "USDT",
          reward.reward_type === "cashback" ? reward.amount_usd : 0,
          reward.reward_type === "milestone" ? reward.amount_usd : 0,
          reward.reward_type === "referral" ? reward.amount_usd : 0,
          now,
          now
        );
        db.prepare("UPDATE swap_rewards SET status = 'requested', claim_id = ? WHERE id = ?").run(claimId, reward.id);
      });
      submitClaim();
      sendAdminClaimNotification({
        claimId,
        walletAddress: normalizedAddress,
        requestedAmountUSD: reward.amount_usd,
        payoutAddress,
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
    const totalEligible = Number((totalCashback + totalMilestones + totalReferrals).toFixed(4));
    if (totalEligible <= 0) {
      return res.status(400).json({ error: "No available unlocked reward balance to claim." });
    }
    const claimCampaign = db.prepare("SELECT claim_threshold_usd FROM swap_campaigns WHERE id = ?").get(DEFAULT_CAMPAIGN_ID);
    const claimThresholdUSD = getClaimThresholdUSD(claimCampaign);
    if (totalEligible < claimThresholdUSD) {
      return res.status(400).json({
        error: `Claims unlock at $${claimThresholdUSD.toFixed(2)}. Your claimable balance is $${totalEligible.toFixed(2)}.`
      });
    }
    const requestedAmount = claimAmountUSD && typeof claimAmountUSD === "number" && claimAmountUSD > 0 ? Math.min(claimAmountUSD, totalEligible) : totalEligible;
    const submitThresholdClaim = db.transaction(() => {
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
        payoutAddress,
        preferredNetwork || "BNB Smart Chain",
        preferredToken || "USDT",
        totalCashback,
        totalMilestones,
        totalReferrals,
        now,
        now
      );
      db.prepare(`
        UPDATE swap_rewards SET status = 'requested', claim_id = ? WHERE user_id = ? AND status = 'unlocked'
      `).run(claimId, user.id);
    });
    submitThresholdClaim();
    sendAdminClaimNotification({
      claimId,
      walletAddress: normalizedAddress,
      requestedAmountUSD: requestedAmount,
      payoutAddress,
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
    sendServerError(res, err, "rewards/request");
  }
});
apiRouter.post("/admin/login", (req, res) => {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: "Admin access is disabled: SWAP_ADMIN_KEY is not configured on the server." });
  }
  const { adminKey } = req.body;
  if (!isValidAdminKey(adminKey)) {
    return res.status(403).json({ error: "Invalid admin passkey" });
  }
  res.json({ success: true });
});
apiRouter.get("/admin/overview", verifyAdmin, (req, res) => {
  try {
    const campaignId = DEFAULT_CAMPAIGN_ID;
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(campaignId);
    const txStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN execution_status = 'DONE' THEN 1 END) as successful_swaps,
        COUNT(CASE WHEN execution_status = 'FAILED' THEN 1 END) as failed_swaps,
        COALESCE(SUM(CASE WHEN execution_status = 'DONE' THEN volume_usd ELSE 0 END), 0) as total_volume
      FROM swap_transactions
    `).get();
    const walletStats = db.prepare(`
      SELECT COUNT(DISTINCT wallet_address) as total_wallets FROM swap_campaign_users
    `).get();
    const repeatStats = db.prepare(`
      SELECT COUNT(*) as repeat_swappers FROM (
        SELECT wallet_address FROM swap_transactions WHERE execution_status = 'DONE'
        GROUP BY wallet_address HAVING COUNT(*) > 1
      )
    `).get();
    const eventStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN event_name = 'campaign_page_view' THEN 1 END) as page_views,
        COUNT(DISTINCT CASE WHEN event_name = 'campaign_page_view' THEN ip_address END) as unique_visitors,
        COUNT(CASE WHEN event_name = 'wallet_connect_clicked' THEN 1 END) as connect_attempts,
        COUNT(CASE WHEN event_name = 'wallet_connected' THEN 1 END) as connected_wallets,
        COUNT(CASE WHEN event_name = 'swap_initiated' THEN 1 END) as swaps_initiated
      FROM swap_campaign_events
    `).get();
    const referralStats = db.prepare(`
      SELECT
        COUNT(DISTINCT u.wallet_address) as total_referrals,
        COUNT(DISTINCT CASE WHEN r.status IN ('qualified', 'rewarded') THEN u.wallet_address END) as qualified_referrals
      FROM swap_referrals r
      JOIN swap_campaign_users u ON u.id = r.referred_user_id
    `).get();
    const roundStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN eligible_swaps_count > 0 THEN 1 END) as active_wallets,
        COALESCE(SUM(total_volume_usd), 0) as total_volume,
        COALESCE(SUM(eligible_swaps_count), 0) as total_swaps
      FROM swap_campaign_users
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
    const payoutStats = db.prepare(`
      SELECT COUNT(*) as paid_claims, COALESCE(SUM(amount_usd), 0) as total_paid_amount
      FROM swap_reward_payouts
    `).get();
    const remainingBudget = campaign ? Math.max(0, campaign.total_budget_usd - (campaign.spent_budget_usd || 0)) : 0;
    const milestones = db.prepare(`
      SELECT * FROM swap_campaign_milestones
      WHERE campaign_id = ?
      ORDER BY sort_order ASC, target_volume_usd ASC
    `).all(campaignId).map((m) => ({
      id: m.id,
      milestoneNumber: m.milestone_number,
      title: m.title,
      targetVolumeUSD: m.target_volume_usd,
      rewardAmountUSD: m.reward_amount_usd,
      rewardDescription: m.reward_description,
      isActive: m.is_active,
      sortOrder: m.sort_order
    }));
    res.json({
      campaign,
      milestones,
      analytics: {
        pageViews: eventStats.page_views || 0,
        uniqueVisitors: eventStats.unique_visitors || 0,
        connectAttempts: eventStats.connect_attempts || 0,
        connectedWallets: walletStats.total_wallets || 0,
        swapsInitiated: eventStats.swaps_initiated || 0,
        successfulSwaps: txStats.successful_swaps || 0,
        failedSwaps: txStats.failed_swaps || 0,
        totalVerifiedVolumeUSD: txStats.total_volume || 0,
        repeatSwappers: repeatStats.repeat_swappers || 0,
        roundVolumeUSD: roundStats.total_volume || 0,
        roundSwaps: roundStats.total_swaps || 0,
        roundActiveWallets: roundStats.active_wallets || 0,
        roundStartedAt: campaign?.reset_at || campaign?.start_date || null,
        referralVisits: referralStats.total_referrals || 0,
        qualifiedReferrals: referralStats.qualified_referrals || 0,
        milestonesUnlocked: rewardStats.unlocked_count || 0,
        pendingClaims: rewardStats.pending_requests || 0,
        approvedClaims: rewardStats.approved_count || 0,
        paidClaims: payoutStats.paid_claims || 0,
        totalPaidAmountUSD: payoutStats.total_paid_amount || 0,
        totalBudgetUSD: campaign?.total_budget_usd || 1e4,
        remainingBudgetUSD: remainingBudget
      }
    });
  } catch (err) {
    sendServerError(res, err, "swap api");
  }
});
apiRouter.get("/admin/analytics", verifyAdmin, (req, res) => {
  try {
    const period = String(req.query.period || "current");
    if (!["current", "last6", "month", "all"].includes(period)) {
      return res.status(400).json({ error: "Invalid period. Use current, last6, month or all." });
    }
    try {
      res.json(getPeriodAnalytics(period, typeof req.query.month === "string" ? req.query.month : void 0));
    } catch (err) {
      res.status(400).json({ error: err?.message || "Invalid period" });
    }
  } catch (err) {
    sendServerError(res, err, "swap api");
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
      cashbackPercentage,
      claimThresholdUSD,
      rewardsHeading,
      rewardsBadgeText
    } = req.body;
    const campaignId = DEFAULT_CAMPAIGN_ID;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const positiveNumber = (v) => {
      const n = Number(v);
      return v !== null && v !== "" && Number.isFinite(n) && n > 0 ? n : null;
    };
    const percentage = (v) => {
      const n = Number(v);
      return v !== null && v !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
    };
    const shortText = (v) => typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
    const validDate = (v) => typeof v === "string" && v.trim() && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : null;
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
          claim_threshold_usd = COALESCE(?, claim_threshold_usd),
          rewards_heading = COALESCE(?, rewards_heading),
          rewards_badge_text = COALESCE(?, rewards_badge_text),
          updated_at = ?
      WHERE id = ?
    `).run(
      title,
      description,
      status,
      validDate(startDate),
      validDate(endDate),
      totalBudgetUSD,
      minSwapUSD,
      referralRewardUSD,
      referralQualifyingVolUSD,
      cashbackEnabled !== void 0 ? cashbackEnabled ? 1 : 0 : null,
      percentage(cashbackPercentage),
      positiveNumber(claimThresholdUSD),
      shortText(rewardsHeading),
      shortText(rewardsBadgeText),
      now,
      campaignId
    );
    db.prepare(`
      INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
      VALUES (?, 'admin', 'update_campaign_settings', 'campaign', ?, ?, ?, ?)
    `).run("log_" + crypto4.randomUUID(), campaignId, JSON.stringify(req.body), clientIp(req), now);
    res.json({ success: true, message: "Campaign settings updated successfully" });
  } catch (err) {
    sendServerError(res, err, "swap api");
  }
});
apiRouter.post("/admin/campaign/reset", verifyAdmin, (req, res) => {
  try {
    if (String(req.body?.confirm || "") !== "RESET") {
      return res.status(400).json({ error: "Type RESET to confirm the campaign reset." });
    }
    const campaignId = DEFAULT_CAMPAIGN_ID;
    const campaign = db.prepare("SELECT * FROM swap_campaigns WHERE id = ?").get(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const nowDate = /* @__PURE__ */ new Date();
    const now = nowDate.toISOString();
    const stamp = nowDate.getTime().toString(36).toUpperCase();
    const archiveId = `${campaignId}_archive_${stamp}`;
    const summary = db.transaction(() => {
      const cols = db.prepare("PRAGMA table_info(swap_campaigns)").all().map((c) => c.name);
      const overrides = {
        id: archiveId,
        slug: `${campaign.slug}-archive-${stamp.toLowerCase()}`,
        title: `${campaign.title} (archived ${now.slice(0, 10)})`,
        status: "ended",
        end_date: now,
        updated_at: now
      };
      db.prepare(`INSERT INTO swap_campaigns (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => c in overrides ? overrides[c] : campaign[c]));
      const users = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ?").all(campaignId);
      const claimsCount = db.prepare("SELECT COUNT(*) AS n FROM swap_reward_claims WHERE campaign_id = ?").get(campaignId)?.n || 0;
      for (const table of [
        "swap_transactions",
        "swap_cashback_ledger",
        "swap_rewards",
        "swap_reward_claims",
        "swap_referrals",
        "swap_campaign_events"
      ]) {
        db.prepare(`UPDATE ${table} SET campaign_id = ? WHERE campaign_id = ?`).run(archiveId, campaignId);
      }
      db.prepare(`
        UPDATE swap_campaign_users
        SET campaign_id = ?, referral_code = referral_code || '-' || ?
        WHERE campaign_id = ?
      `).run(archiveId, stamp, campaignId);
      const newIdByOldId = /* @__PURE__ */ new Map();
      users.forEach((u) => newIdByOldId.set(u.id, "usr_" + crypto4.randomUUID()));
      const insertUser = db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, flag_reason, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, 0, ?, ?, ?, ?)
      `);
      users.forEach((u) => {
        insertUser.run(
          newIdByOldId.get(u.id),
          campaignId,
          u.wallet_address,
          u.chain_id,
          u.signature,
          u.verified_at,
          u.referral_code,
          u.referred_by_user_id ? newIdByOldId.get(u.referred_by_user_id) || null : null,
          u.is_flagged,
          u.flag_reason,
          u.last_active_at,
          now
        );
      });
      const insertReferral = db.prepare(`
        INSERT OR IGNORE INTO swap_referrals (
          id, campaign_id, referrer_user_id, referred_user_id, referral_code,
          visitor_ip, status, qualifying_volume_usd, reward_amount_usd, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, 'connected', 0.0, 0.0, ?)
      `);
      const byOldId = new Map(users.map((u) => [u.id, u]));
      users.forEach((u) => {
        const referrer = u.referred_by_user_id ? byOldId.get(u.referred_by_user_id) : null;
        if (!referrer) return;
        insertReferral.run(
          "ref_" + crypto4.randomUUID(),
          campaignId,
          newIdByOldId.get(referrer.id),
          newIdByOldId.get(u.id),
          referrer.referral_code,
          now
        );
      });
      db.prepare(`
        UPDATE swap_campaigns
        SET spent_budget_usd = 0.0, start_date = ?, reset_at = ?, status = 'active', updated_at = ?
        WHERE id = ?
      `).run(now, now, now, campaignId);
      const result = { archiveId, usersReset: users.length, claimsArchived: claimsCount };
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', 'reset_campaign', 'campaign', ?, ?, ?, ?)
      `).run("log_" + crypto4.randomUUID(), campaignId, JSON.stringify(result), clientIp(req), now);
      return result;
    })();
    res.json({ success: true, ...summary });
  } catch (err) {
    sendServerError(res, err, "swap api");
  }
});
apiRouter.post("/admin/milestones", verifyAdmin, (req, res) => {
  try {
    const { id, milestoneNumber, title, targetVolumeUSD, rewardAmountUSD, rewardDescription, isActive, sortOrder } = req.body;
    const campaignId = DEFAULT_CAMPAIGN_ID;
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
      const newId = "ms_" + crypto4.randomUUID();
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
    sendServerError(res, err, "swap api");
  }
});
apiRouter.delete("/admin/milestones/:id", verifyAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM swap_campaign_milestones WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err, "swap api");
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
      LEFT JOIN swap_rewards r ON r.id = c.reward_id
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
    sendServerError(res, err, "swap api");
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
      if (action === "reject") {
        db.prepare(`
          UPDATE swap_rewards
          SET status = 'unlocked', claim_id = NULL
          WHERE claim_id = ? OR (id = ? AND ? IS NOT NULL)
        `).run(claim.id, claim.reward_id, claim.reward_id);
      } else {
        db.prepare(`
          UPDATE swap_rewards
          SET status = ?
          WHERE claim_id = ? OR (id = ? AND ? IS NOT NULL)
        `).run(rewardStatus, claim.id, claim.reward_id, claim.reward_id);
      }
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', ?, 'claim', ?, ?, ?, ?)
      `).run(
        "log_" + crypto4.randomUUID(),
        `claim_${action}`,
        claim.id,
        JSON.stringify({ action, rejectionReason, adminNotes }),
        clientIp(req),
        now
      );
    })();
    res.json({ success: true, status: newStatus });
  } catch (err) {
    sendServerError(res, err, "swap api");
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
    if (claim.status !== "approved") {
      return res.status(400).json({ error: "Only approved claims can be marked as paid. Please approve the claim first." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const payoutId = "pay_" + crypto4.randomUUID();
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
      db.prepare("UPDATE swap_rewards SET status = 'paid' WHERE claim_id = ? OR (id = ? AND ? IS NOT NULL)").run(claim.id, claim.reward_id, claim.reward_id);
      db.prepare(`
        UPDATE swap_campaigns
        SET spent_budget_usd = spent_budget_usd + ?
        WHERE id = ?
      `).run(claim.requested_amount_usd, claim.campaign_id);
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', 'record_payout', 'payout', ?, ?, ?, ?)
      `).run(
        "log_" + crypto4.randomUUID(),
        payoutId,
        JSON.stringify({ claimId: claim.id, amountUSD: claim.requested_amount_usd, payoutTxHash, payoutNetwork }),
        clientIp(req),
        now
      );
    })();
    res.json({ success: true, payoutId, message: "Payout recorded and status updated to Paid" });
  } catch (err) {
    sendServerError(res, err, "swap api");
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
      WHERE u.campaign_id = ?
    `;
    const params = [DEFAULT_CAMPAIGN_ID];
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
    sendServerError(res, err, "swap api");
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
    sendServerError(res, err, "swap api");
  }
});
apiRouter.get("/admin/audit-logs", verifyAdmin, (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM swap_admin_audit_logs ORDER BY created_at DESC LIMIT 100").all();
    res.json({ logs });
  } catch (err) {
    sendServerError(res, err, "swap api");
  }
});
apiRouter.get("/admin/export/:type", verifyAdmin, (req, res) => {
  try {
    const type = String(req.params.type);
    if (!["users", "transactions", "claims", "referrals"].includes(type)) {
      return res.status(400).json({ error: "Invalid export type. Use users, transactions, claims, or referrals." });
    }
    const format = String(req.query.format || "csv").toLowerCase() === "pdf" ? "pdf" : "csv";
    const table = buildExport(type);
    const filename = `${table.fileBase}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${format}`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Export-Filename", filename);
    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      return res.send(toPdf(table));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(toCsv(table));
  } catch (err) {
    sendServerError(res, err, "swap api");
  }
});

// server/chatApi.ts
import { Router as Router3 } from "express";
import crypto5 from "crypto";

// server/chatKnowledge.ts
var CHAT_SYSTEM_PROMPT = `You are "Nova Assistant", the friendly virtual assistant of the NovaP2P Support Team in the live chat on the NovaP2P website (novap2p.com).
- If a visitor sincerely asks whether they are talking to a bot, an AI or a real person, be honest: say you are Nova Assistant, NovaP2P's virtual assistant, and offer to connect them with a team member (they can tap "Talk to a Human").

# How to answer
- Be concise: 1-4 short paragraphs or a short list. Plain text only (no markdown headings, no tables). Use "-" for bullet points.
- Always reply in the same language the visitor writes in.
- Only answer questions about NovaP2P, Nova Swap, the Genesis rewards campaign, the Partner/BDM program, wallets and general crypto how-to questions related to using the site. Politely decline anything unrelated.
- Use ONLY the facts below. If you do not know something, or it needs account-specific checks (a specific transaction, a payout, an application status, a refund, a bug), say a support team member will follow up, and add the marker [[HANDOFF]] at the very end of your reply.
- If the visitor asks for a human, an agent, a person, the team or support staff, reply briefly that you are connecting them and add [[HANDOFF]] at the end.
- Never invent prices, dates, partnerships, guarantees or features.

# Safety rules (never break these)
- NEVER ask for, accept or encourage sharing a seed phrase, recovery phrase, private key or wallet password. If a visitor offers one, warn them immediately to never share it with anyone, including NovaP2P staff.
- NovaP2P staff will never DM first asking for funds, keys or "verification payments". Warn visitors about impersonation scams.
- Do not give financial or investment advice, price predictions, or promises of profit. Rewards depend on the published rules.
- Never claim to perform actions (you cannot move funds, approve applications, check balances or edit accounts).

# About NovaP2P
- NovaP2P is a peer-to-peer (P2P) crypto platform. Its P2P marketplace (buying and selling USDT directly between users with a secure escrow that locks the seller's USDT until the seller confirms payment) is being launched; visitors can join the early-access waitlist on the homepage.
- Live today: Nova Swap, a universal cross-chain swap (DEX + bridge) on the homepage and at /swap.
- Contact: support@novap2p.com, Contact page (/contact), Telegram https://t.me/novap2pofficial, X/Twitter https://x.com/novap2pofficial.

# Nova Swap
- Non-custodial: users swap directly from their own wallet; NovaP2P never holds their funds.
- Swap USDT, USDC, ETH and more across 70+ EVM and non-EVM blockchains (Ethereum, BNB Smart Chain, Arbitrum, Base, Optimism, Polygon, Avalanche, Solana, TRON, Sui, Linea, Scroll, zkSync Era, Blast, Mantle and more).
- Routing is powered by LI.FI, which compares many DEXs and bridges and picks the best route automatically. Other routes are listed in the "Receive" panel.
- Supported wallets: MetaMask, Trust Wallet, Coinbase Wallet, Phantom, TronLink, Sui wallets, and any mobile wallet via WalletConnect.
- Steps: connect wallet -> choose source token & chain -> choose destination token & chain -> enter amount -> review the best route -> confirm in your wallet -> track until tokens arrive.
- Fees: a 0.5% platform fee plus a 0.25% LI.FI routing fee are shown in the quote before confirming. Network gas and bridge fees are shown in the preview. No hidden charges.
- Common issues: routes or the review button may be unavailable if the wallet is not connected, the balance (including gas) is too low, or the amount is below the route minimum. Cross-chain transfers can take a few minutes; the widget shows live status. If a transfer seems stuck for a long time, a support member should check it ([[HANDOFF]]).
- Every user gets 5% cashback on eligible Nova Swap trading fees.

# Genesis Rewards Campaign
- Community rewards for Nova Swap users, shown on the homepage below the swap.
- 5% cashback on eligible Nova Swap fees. Minimum eligible swap: $1.
- Volume milestones: $10,000 swap volume -> $25 USDT bonus; $25,000 -> $50 USDT; $50,000 -> $100 USDT.
- Referral bonus: $5 USDT for each referred friend who reaches $2,000 swap volume.
- Rewards can be claimed once the claimable balance reaches $500; claims are reviewed by the team before payment. Abusive or sybil activity is disqualified.

# Partner & BDM affiliate program
- Platform fee is 0.5%. Partners earn {{PARTNER_PCT}}% of the fee ({{PARTNER_VOL_PCT}}% of referred volume) for the lifetime of every user they refer.
- BDMs (Business Development Managers) recruit and manage Partners and earn a {{BDM_OVERRIDE_PCT}}% override of the fee on their Partners' volume ({{BDM_OVERRIDE_VOL_PCT}}% of that volume), or {{BDM_DIRECT_PCT}}% on users referred through the BDM's own link.
- Referred users get 5% cashback. Partners/BDMs do not get cashback on referred users' volume, only on their own swaps.
- Apply at /become-partner or /become-bdm: connect a wallet, fill in the form and sign the message. Reviews take up to 24 hours and the result is emailed.
- Partners need an active X/Twitter account and a Telegram channel or group (YouTube optional). BDMs need crypto affiliate / BD experience.
- Approved members get a dashboard (/partner-dashboard or /bdm-dashboard) with live stats and referral links.
- Minimum withdrawal: $100 USDT, paid within 24 hours on BNB Smart Chain, Ethereum, Arbitrum, Optimism, Base, Polygon, Solana or TRON.
- Users joining through a referral link must use a new wallet not previously registered on Nova Swap.

# NovaP2P P2P platform fees (for the upcoming P2P marketplace)
- 0% maker fees. $0.03 taker fee. No annual platform fee. No deposit fees (network fees still apply). Small flat withdrawal fee based on network costs. Full details at /fee-structure.
`;
function getChatSystemPrompt() {
  const r = getAffiliateRates();
  const pct = (n) => String(Number(n.toFixed(2)));
  const vol = (n) => String(Number((n * PLATFORM_FEE_PCT / 100).toFixed(4)));
  return CHAT_SYSTEM_PROMPT.replace("{{PARTNER_PCT}}", pct(r.partnerRatePct)).replace("{{PARTNER_VOL_PCT}}", vol(r.partnerRatePct)).replace("{{BDM_OVERRIDE_PCT}}", pct(r.bdmOverrideRatePct)).replace("{{BDM_OVERRIDE_VOL_PCT}}", vol(r.bdmOverrideRatePct)).replace("{{BDM_DIRECT_PCT}}", pct(r.bdmDirectRatePct));
}
var HANDOFF_MARKER = "[[HANDOFF]]";

// server/chatApi.ts
var chatRouter = Router3();
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    token_hash TEXT NOT NULL,
    visitor_name TEXT NOT NULL,
    visitor_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    human_requested INTEGER NOT NULL DEFAULT 0,
    admin_unread INTEGER NOT NULL DEFAULT 0,
    ai_day TEXT,
    ai_count INTEGER NOT NULL DEFAULT 0,
    last_admin_alert_at INTEGER NOT NULL DEFAULT 0,
    page_url TEXT,
    ip TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, id);
  CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at);
  CREATE TABLE IF NOT EXISTS chat_ai_usage (
    day TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
`);
var MAX_MESSAGE_LENGTH = 2e3;
var AI_PER_CONVERSATION_DAILY = Number(process.env.CHAT_AI_PER_CHAT_DAILY_LIMIT || 40);
var AI_GLOBAL_DAILY = Number(process.env.CHAT_AI_DAILY_LIMIT || 1e3);
var ADMIN_ALERT_THROTTLE_MS = 10 * 60 * 1e3;
var GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']+|["']+$/g, "").trim();
var AI_CONFIGURED = !!GEMINI_API_KEY && GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
var GEMINI_API_BASE = (process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
var VERTEX_API_BASE = (process.env.VERTEX_API_BASE || "https://aiplatform.googleapis.com").replace(/\/+$/, "");
var AI_ENDPOINTS = (process.env.GEMINI_API_MODE || "").toLowerCase() === "vertex" ? ["vertex"] : GEMINI_API_KEY.startsWith("AQ.") ? ["gemini", "vertex"] : ["gemini"];
var workingEndpoint = null;
function geminiRequest(endpoint, model) {
  if (endpoint === "vertex") {
    return {
      url: `${VERTEX_API_BASE}/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      headers: { "Content-Type": "application/json" }
    };
  }
  return {
    url: `${GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY }
  };
}
var GEMINI_MODELS = Array.from(
  new Set([(process.env.GEMINI_MODEL || "").trim(), "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"].filter(Boolean))
);
if (!AI_CONFIGURED) {
  console.warn("[Chat] GEMINI_API_KEY is not set. Live chat works, but messages go to the support team without AI answers.");
} else {
  console.log(`[Chat] AI assistant enabled (endpoints: ${AI_ENDPOINTS.join(" -> ")}; models: ${GEMINI_MODELS.join(", ")}).`);
}
var aiStatus = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null
};
function recordAiError(message) {
  aiStatus.lastError = message.slice(0, 900);
  aiStatus.lastErrorAt = (/* @__PURE__ */ new Date()).toISOString();
  console.warn(`[Chat] ${message}`);
}
function explainGeminiError(status, body) {
  let msg = body;
  try {
    msg = JSON.parse(body)?.error?.message || body;
  } catch {
  }
  msg = String(msg).replace(/\s+/g, " ").trim().slice(0, 250);
  if (/api key not valid|API_KEY_INVALID|permission|unauthori[sz]ed/i.test(msg) || status === 401 || status === 403)
    return `Gemini rejected the API key (${status}): ${msg} - check GEMINI_API_KEY on the server.`;
  if (/location is not supported/i.test(msg)) return `Gemini is not available from the server's region (${status}): ${msg}`;
  if (status === 429) return `Gemini free quota / rate limit reached (429): ${msg}`;
  return `Gemini error (${status}): ${msg}`;
}
async function callGemini(history) {
  if (!AI_CONFIGURED || !history.length) return null;
  const endpoints = workingEndpoint ? [workingEndpoint, ...AI_ENDPOINTS.filter((e) => e !== workingEndpoint)] : AI_ENDPOINTS;
  const keyErrors = [];
  for (const endpoint of endpoints) {
    const label = endpoint === "vertex" ? "Vertex AI" : "Gemini API";
    for (const model of GEMINI_MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25e3);
      try {
        const target = geminiRequest(endpoint, model);
        const response = await fetch(target.url, {
          method: "POST",
          headers: target.headers,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: getChatSystemPrompt() }] },
            contents: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1024,
              // Thinking off on 2.5 models for fast chat replies
              ...model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}
            }
          }),
          signal: controller.signal
        });
        if (!response.ok) {
          const message = `[${label} / ${model}] ${explainGeminiError(response.status, await response.text().catch(() => ""))}`;
          if (/rejected the API key|server's region/.test(message)) {
            keyErrors.push(message);
            break;
          }
          recordAiError(message);
          continue;
        }
        const data = await response.json();
        const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.thought ? "" : p?.text || "").join("").trim();
        if (text) {
          workingEndpoint = endpoint;
          aiStatus.lastSuccessAt = (/* @__PURE__ */ new Date()).toISOString();
          return text;
        }
        recordAiError(`[${label} / ${model}] Gemini returned no text (finishReason: ${data?.candidates?.[0]?.finishReason || "n/a"}).`);
      } catch (err) {
        recordAiError(`[${label} / ${model}] Could not reach Gemini: ${err?.name === "AbortError" ? "timeout after 25s" : err?.message || err}`);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  if (keyErrors.length) recordAiError(keyErrors.join("  |  "));
  return null;
}
function cleanAiText(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*\*\s+/gm, "- ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4e3);
}
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
var hashToken = (token) => crypto5.createHash("sha256").update(token).digest("hex");
function getSiteOrigin2(req) {
  const configured = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(configured)) return configured;
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : "https://novap2p.com";
}
function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
var getConversationByCode = (code) => db.prepare("SELECT * FROM chat_conversations WHERE code = ?").get(code.toUpperCase());
var getConversation = (id) => db.prepare("SELECT * FROM chat_conversations WHERE id = ?").get(id);
function getMessages(conversationId, afterId = 0) {
  return db.prepare("SELECT id, conversation_id, sender, body, created_at FROM chat_messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC").all(conversationId, afterId);
}
function addMessage(conversationId, sender, body) {
  const createdAt = nowIso();
  const result = db.prepare("INSERT INTO chat_messages (conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?)").run(conversationId, sender, body, createdAt);
  db.prepare(
    `UPDATE chat_conversations SET updated_at = ?${sender === "visitor" ? ", admin_unread = admin_unread + 1" : ""} WHERE id = ?`
  ).run(createdAt, conversationId);
  return { id: Number(result.lastInsertRowid), conversation_id: conversationId, sender, body, created_at: createdAt };
}
var publicMessage = (m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.created_at });
function publicState(conv) {
  const agentJoined = !!db.prepare("SELECT 1 FROM chat_messages WHERE conversation_id = ? AND sender = 'admin' LIMIT 1").get(conv.id);
  return {
    id: conv.id,
    code: conv.code,
    name: conv.visitor_name,
    status: conv.status,
    aiEnabled: !!conv.ai_enabled && AI_CONFIGURED,
    humanRequested: !!conv.human_requested,
    agentJoined
  };
}
function authorizeVisitor(req, res) {
  const conv = getConversation(String(req.params.id || ""));
  const token = req.get("x-chat-token") || "";
  if (!conv || !token || !safeEqual(hashToken(token), conv.token_hash)) {
    res.status(404).json({ error: "Conversation not found." });
    return null;
  }
  return conv;
}
var SENDER_LABEL = { visitor: "Visitor", ai: "Nova Assistant (AI)", admin: "Support Team", system: "System" };
function transcriptText(messages) {
  return messages.map((m) => `[${m.created_at.slice(0, 16).replace("T", " ")} UTC] ${m.sender === "visitor" ? "Visitor" : SENDER_LABEL[m.sender]}:
${m.body}`).join("\n\n");
}
function transcriptHtml(messages) {
  return messages.map((m) => {
    const bg = m.sender === "visitor" ? "#eef3ff" : m.sender === "admin" ? "#ecfdf5" : "#f8fafc";
    return `<tr><td style="padding:6px 0;"><div style="background:${bg};border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;">
        <div style="font-size:12px;font-weight:700;color:#374151;">${escapeHtml(SENDER_LABEL[m.sender])} <span style="font-weight:400;color:#9ca3af;">&middot; ${escapeHtml(m.created_at.slice(0, 16).replace("T", " "))} UTC</span></div>
        <div style="font-size:14px;line-height:1.55;color:#111827;white-space:pre-wrap;margin-top:4px;">${escapeHtml(m.body)}</div>
      </div></td></tr>`;
  }).join("");
}
function emailShell(title, intro, bodyRows, button) {
  const btn = button ? `<tr><td align="center" style="padding:18px 0 4px;"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#4F7DF3;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:10px;">${escapeHtml(button.label)}</a></td></tr>` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="background:#4F7DF3;padding:18px 22px;color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(title)}</td></tr>
    <tr><td style="padding:20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:14px;line-height:1.6;color:#374151;padding-bottom:8px;">${intro}</td></tr>
      ${bodyRows}
      ${btn}
    </table></td></tr>
    <tr><td style="padding:14px 22px;background:#f9fafb;color:#9ca3af;font-size:12px;">NovaP2P Live Chat &middot; novap2p.com</td></tr>
  </table></td></tr></table></body></html>`;
}
var emailSyncStatus = {
  enabled: false,
  lastRunAt: null,
  lastOkAt: null,
  lastError: null,
  imported: 0
};
var CHAT_EMAIL_HEADER = "X-Nova-Chat";
function defaultSiteOrigin() {
  const configured = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(configured) ? configured : "https://novap2p.com";
}
function adminChatUrl(origin, conv) {
  return `${origin}/swap-admin?tab=livechat&chat=${encodeURIComponent(conv.id)}`;
}
function sendAdminChatEmail(req, conv, kind) {
  const origin = getSiteOrigin2(req);
  const messages = getMessages(conv.id).slice(-30);
  const heading = kind === "new" ? "New Live Chat" : kind === "handoff" ? "Live Chat: Support Requested" : "Live Chat: New Visitor Message";
  const subject = `${heading} - ${conv.visitor_name} [NovaChat #${conv.code}]`;
  const info = `<b>Name:</b> ${escapeHtml(conv.visitor_name)}<br><b>Email:</b> ${escapeHtml(conv.visitor_email)}<br><b>Chat ID:</b> #${escapeHtml(conv.code)}${conv.page_url ? `<br><b>Page:</b> ${escapeHtml(conv.page_url)}` : ""}${kind === "handoff" ? '<br><br><b style="color:#dc2626;">The visitor needs a support team member.</b>' : ""}<br><br><span style="color:#2563eb;"><b>Reply to this email</b> to answer the visitor (write above the quoted text). Your reply is added to the live chat and emailed to the visitor automatically within about a minute.</span>`;
  const text = [
    `${heading.toUpperCase()} [NovaChat #${conv.code}]`,
    `Name: ${conv.visitor_name}`,
    `Email: ${conv.visitor_email}`,
    conv.page_url ? `Page: ${conv.page_url}` : "",
    kind === "handoff" ? "The visitor needs a support team member." : "",
    "",
    `Reply to this email to answer ${conv.visitor_name} (write above the quoted text). Your reply is added to the live chat and emailed to the visitor automatically within about a minute.`,
    `Or reply in the admin panel: ${adminChatUrl(origin, conv)}`,
    "",
    "Conversation:",
    transcriptText(messages)
  ].filter((l) => l !== null).join("\n");
  db.prepare("UPDATE chat_conversations SET last_admin_alert_at = ? WHERE id = ?").run(Date.now(), conv.id);
  sendMail({
    to: ADMIN_EMAIL,
    subject,
    text,
    html: emailShell(heading, info, transcriptHtml(messages), { href: adminChatUrl(origin, conv), label: "Reply in Admin Panel" }),
    // Replies come back to the support mailbox; the email sync posts them to the chat and emails the visitor a clean copy
    replyTo: ADMIN_EMAIL,
    headers: { [CHAT_EMAIL_HEADER]: "admin-notification" }
  }).catch(() => {
  });
}
async function sendVisitorReplyEmail(origin, conv, reply) {
  const chatUrl = `${origin}/?chat=open`;
  const intro = `Hi ${escapeHtml(conv.visitor_name)},<br><br>Our support team replied to your live chat on NovaP2P:`;
  const row = `<tr><td style="padding:6px 0;"><div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(reply)}</div></td></tr>
    <tr><td style="font-size:13px;color:#6b7280;padding-top:10px;">You can reply to this email or continue the conversation in the chat window on our website.</td></tr>`;
  const result = await sendMail({
    to: conv.visitor_email,
    subject: `Reply from NovaP2P Support [NovaChat #${conv.code}]`,
    text: `Hi ${conv.visitor_name},

Our support team replied to your live chat on NovaP2P:

${reply}

You can reply to this email or continue the conversation on our website: ${chatUrl}

NovaP2P Support`,
    html: emailShell("NovaP2P Support", intro, row, { href: chatUrl, label: "Open Live Chat" }),
    replyTo: ADMIN_EMAIL,
    headers: { [CHAT_EMAIL_HEADER]: "support-reply" }
  });
  return result.sent;
}
function buildHistory(conversationId) {
  const rows = getMessages(conversationId).filter((m) => m.sender !== "system").slice(-24);
  const history = [];
  for (const m of rows) {
    const role = m.sender === "visitor" ? "user" : "model";
    const text = m.sender === "admin" ? `(Reply from a NovaP2P support team member) ${m.body}` : m.body;
    const last = history[history.length - 1];
    if (last && last.role === role) last.text += `

${text}`;
    else history.push({ role, text });
  }
  while (history.length && history[0].role !== "user") history.shift();
  return history;
}
function requestHuman(req, conv) {
  if (conv.human_requested) return null;
  db.prepare("UPDATE chat_conversations SET human_requested = 1 WHERE id = ?").run(conv.id);
  const notice = addMessage(
    conv.id,
    "system",
    `Our support team has been notified and will reply here as soon as possible. A copy of the reply will also be sent to ${conv.visitor_email}.`
  );
  sendAdminChatEmail(req, { ...conv, human_requested: 1 }, "handoff");
  return notice;
}
function reserveAiQuota(conv) {
  const day = today();
  const usage = db.prepare("SELECT count FROM chat_ai_usage WHERE day = ?").get(day);
  if ((usage?.count || 0) >= AI_GLOBAL_DAILY) return false;
  const convCount = conv.ai_day === day ? conv.ai_count : 0;
  if (convCount >= AI_PER_CONVERSATION_DAILY) return false;
  db.prepare("INSERT INTO chat_ai_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1").run(day);
  db.prepare("UPDATE chat_conversations SET ai_day = ?, ai_count = ? WHERE id = ?").run(day, convCount + 1, conv.id);
  return true;
}
async function respondToVisitor(req, conversationId) {
  const conv = getConversation(conversationId);
  if (!conv) return [];
  const out = [];
  if (!conv.ai_enabled || !AI_CONFIGURED) {
    const notice = requestHuman(req, conv);
    if (notice) out.push(notice);
    else if (Date.now() - (conv.last_admin_alert_at || 0) > ADMIN_ALERT_THROTTLE_MS) sendAdminChatEmail(req, conv, "message");
    return out;
  }
  const text = reserveAiQuota(conv) ? await callGemini(buildHistory(conv.id)) : null;
  if (!text) {
    const notice = requestHuman(req, conv);
    if (notice) out.push(notice);
    else if (Date.now() - (conv.last_admin_alert_at || 0) > ADMIN_ALERT_THROTTLE_MS) sendAdminChatEmail(req, conv, "message");
    return out;
  }
  const wantsHuman = text.includes(HANDOFF_MARKER);
  const reply = cleanAiText(text.split(HANDOFF_MARKER).join(""));
  const fresh = getConversation(conv.id);
  if (!fresh || !fresh.ai_enabled) return out;
  if (reply) out.push(addMessage(conv.id, "ai", reply));
  if (wantsHuman) {
    const notice = requestHuman(req, fresh);
    if (notice) out.push(notice);
  } else if (fresh.human_requested && Date.now() - (fresh.last_admin_alert_at || 0) > ADMIN_ALERT_THROTTLE_MS) {
    sendAdminChatEmail(req, fresh, "message");
  }
  return out;
}
var startLimiter = rateLimit({ windowMs: 10 * 60 * 1e3, max: 5 });
var messageLimiter = rateLimit({ windowMs: 60 * 1e3, max: 12 });
chatRouter.get("/config", (_req, res) => {
  res.json({ aiEnabled: AI_CONFIGURED });
});
chatRouter.post("/start", startLimiter, async (req, res) => {
  try {
    if (cleanText(req.body?.website, 200)) return res.status(400).json({ error: "Unable to start chat." });
    const name = cleanText(req.body?.name, 80);
    const email = cleanText(req.body?.email, 160).toLowerCase();
    const message = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
    const pageUrl = cleanText(req.body?.pageUrl, 300);
    if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    const id = crypto5.randomUUID();
    const token = crypto5.randomBytes(32).toString("hex");
    let code = "";
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = crypto5.randomBytes(3).toString("hex").toUpperCase();
      if (!db.prepare("SELECT 1 FROM chat_conversations WHERE code = ?").get(candidate)) code = candidate;
    }
    if (!code) code = crypto5.randomBytes(5).toString("hex").toUpperCase();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO chat_conversations (id, code, token_hash, visitor_name, visitor_email, ai_enabled, page_url, ip, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, code, hashToken(token), name, email, AI_CONFIGURED ? 1 : 0, pageUrl || null, req.ip || null, createdAt, createdAt);
    const firstName = name.split(/\s+/)[0];
    addMessage(
      id,
      "ai",
      AI_CONFIGURED ? `Hi ${firstName}! I'm Nova Assistant. Ask me anything about Nova Swap, the Genesis rewards, or the Partner and BDM programs.` : `Hi ${firstName}! Thanks for contacting NovaP2P. Send us your question and our support team will reply here and by email.`
    );
    if (message) {
      addMessage(id, "visitor", message);
      await respondToVisitor(req, id);
    }
    const conv = getConversation(id);
    if (!conv.human_requested) sendAdminChatEmail(req, conv, "new");
    res.json({ conversationId: id, token, conversation: publicState(conv), messages: getMessages(id).map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, "chat start");
  }
});
chatRouter.get("/conversations/:id/messages", (req, res) => {
  try {
    const conv = authorizeVisitor(req, res);
    if (!conv) return;
    const after = Math.max(0, Number(req.query.after) || 0);
    res.json({ conversation: publicState(conv), messages: getMessages(conv.id, after).map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, "chat messages");
  }
});
chatRouter.post("/conversations/:id/messages", messageLimiter, async (req, res) => {
  try {
    const conv = authorizeVisitor(req, res);
    if (!conv) return;
    const body = cleanText(req.body?.body, MAX_MESSAGE_LENGTH);
    if (!body) return res.status(400).json({ error: "Message is empty." });
    if (conv.status !== "open") db.prepare("UPDATE chat_conversations SET status = 'open' WHERE id = ?").run(conv.id);
    const visitorMessage = addMessage(conv.id, "visitor", body);
    const replies = await respondToVisitor(req, conv.id);
    const fresh = getConversation(conv.id);
    res.json({ conversation: publicState(fresh), messages: [visitorMessage, ...replies].map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, "chat send");
  }
});
chatRouter.post("/conversations/:id/handoff", messageLimiter, (req, res) => {
  try {
    const conv = authorizeVisitor(req, res);
    if (!conv) return;
    const notice = requestHuman(req, conv);
    const fresh = getConversation(conv.id);
    res.json({ conversation: publicState(fresh), messages: notice ? [publicMessage(notice)] : [] });
  } catch (err) {
    sendServerError(res, err, "chat handoff");
  }
});
chatRouter.get("/admin/conversations", verifyAdmin, (_req, res) => {
  try {
    const rows = db.prepare(
      `SELECT c.id, c.code, c.visitor_name, c.visitor_email, c.status, c.ai_enabled, c.human_requested, c.admin_unread, c.page_url, c.created_at, c.updated_at,
                (SELECT body FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT sender FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
                (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) AS message_count
         FROM chat_conversations c ORDER BY c.updated_at DESC LIMIT 300`
    ).all();
    res.json({ aiConfigured: AI_CONFIGURED, aiStatus, emailSync: emailSyncStatus, conversations: rows });
  } catch (err) {
    sendServerError(res, err, "chat admin list");
  }
});
chatRouter.get("/admin/conversations/:id", verifyAdmin, (req, res) => {
  try {
    const conv = getConversation(String(req.params.id));
    if (!conv) return res.status(404).json({ error: "Conversation not found." });
    db.prepare("UPDATE chat_conversations SET admin_unread = 0 WHERE id = ?").run(conv.id);
    const { token_hash, ...safe } = conv;
    res.json({ conversation: { ...safe, admin_unread: 0 }, messages: getMessages(conv.id).map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, "chat admin detail");
  }
});
chatRouter.post("/admin/conversations/:id/reply", verifyAdmin, async (req, res) => {
  try {
    const conv = getConversation(String(req.params.id));
    if (!conv) return res.status(404).json({ error: "Conversation not found." });
    const body = cleanText(req.body?.body, 5e3);
    if (!body) return res.status(400).json({ error: "Reply is empty." });
    db.prepare("UPDATE chat_conversations SET ai_enabled = 0, admin_unread = 0, status = 'open' WHERE id = ?").run(conv.id);
    const message = addMessage(conv.id, "admin", body);
    const emailed = await sendVisitorReplyEmail(getSiteOrigin2(req), conv, body);
    res.json({ message: publicMessage(message), visitorEmailed: emailed });
  } catch (err) {
    sendServerError(res, err, "chat admin reply");
  }
});
chatRouter.post("/admin/conversations/:id/settings", verifyAdmin, (req, res) => {
  try {
    const conv = getConversation(String(req.params.id));
    if (!conv) return res.status(404).json({ error: "Conversation not found." });
    if (typeof req.body?.aiEnabled === "boolean") {
      db.prepare("UPDATE chat_conversations SET ai_enabled = ? WHERE id = ?").run(req.body.aiEnabled ? 1 : 0, conv.id);
    }
    if (req.body?.status === "open" || req.body?.status === "closed") {
      db.prepare("UPDATE chat_conversations SET status = ? WHERE id = ?").run(req.body.status, conv.id);
      if (req.body.status === "closed" && conv.status !== "closed") {
        addMessage(conv.id, "system", "This conversation was marked as resolved by our support team. Send a message any time to reopen it.");
      }
    }
    const fresh = getConversation(conv.id);
    const { token_hash, ...safe } = fresh;
    res.json({ conversation: safe });
  } catch (err) {
    sendServerError(res, err, "chat admin settings");
  }
});

// server/chatEmailSync.ts
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_email_imports (
    message_key TEXT PRIMARY KEY,
    conversation_id TEXT,
    folder TEXT,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
var IMAP_HOST = process.env.IMAP_HOST || "imap.hostinger.com";
var IMAP_PORT = Number(process.env.IMAP_PORT || 993);
var IMAP_USER = process.env.IMAP_USER || process.env.SMTP_USER || "support@novap2p.com";
var IMAP_PASS = process.env.IMAP_PASS || process.env.SMTP_PASS || "";
var SYNC_INTERVAL_MS = Math.max(20, Number(process.env.CHAT_EMAIL_SYNC_SECONDS) || 60) * 1e3;
var LOOKBACK_MS = 14 * 24 * 60 * 60 * 1e3;
var ENABLED = (process.env.CHAT_EMAIL_SYNC || "").toLowerCase() !== "off" && !!IMAP_PASS;
var ADMIN_ADDRESSES = new Set(
  [IMAP_USER, ADMIN_EMAIL, ...(process.env.CHAT_ADMIN_REPLY_EMAILS || "").split(",")].map((a) => a.trim().toLowerCase()).filter(Boolean)
);
var TOKEN_RE = /\[NovaChat #([A-F0-9]{6,12})\]/i;
var SYSTEM_SUBJECT_RE = /^\s*(New Live Chat|Live Chat:|Reply from NovaP2P Support)\b/i;
var SYSTEM_BODY_RE = /^\s*(NEW LIVE CHAT|LIVE CHAT:)|reply in the admin panel|swap-admin\?tab=livechat|\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\] (Visitor|System|Nova Assistant)/i;
function isSystemChatEmail(subject, text) {
  return SYSTEM_SUBJECT_RE.test(subject || "") || SYSTEM_BODY_RE.test(text || "");
}
function extractReplyText(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const next = (lines[i + 1] || "").trim();
    if (t.startsWith(">")) break;
    if (/^On\b.{0,300}\bwrote:$/i.test(t)) break;
    if (/^On\b/i.test(t) && /wrote:$/i.test(next) && t.length + next.length < 400) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(t)) break;
    if (/^_{8,}$/.test(t)) break;
    if (/^From:\s/i.test(t) && /^(Sent|Date|To|Subject):/i.test(next)) break;
    if (lines[i] === "-- " || t === "--") break;
    out.push(lines[i]);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 5e3);
}
function addresses(field) {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list.flatMap((a) => a.value || []).map((v) => String(v.address || "").toLowerCase()).filter(Boolean);
}
function isAutoReply(mail) {
  const auto = String(mail.headers.get("auto-submitted") || "").toLowerCase();
  const precedence = String(mail.headers.get("precedence") || "").toLowerCase();
  return !!auto && auto !== "no" || mail.headers.has("x-autoreply") || mail.headers.has("x-autorespond") || ["auto_reply", "bulk", "junk", "list"].includes(precedence) || /^(auto(matic)? reply|out of office|undeliverable|delivery status notification)/i.test(mail.subject || "");
}
async function importChatEmail(mail) {
  if (mail.headers.has(CHAT_EMAIL_HEADER.toLowerCase())) return { result: "own-notification" };
  if (isAutoReply(mail)) return { result: "auto-reply" };
  const match = (mail.subject || "").match(TOKEN_RE);
  const conv = match ? getConversationByCode(match[1]) : void 0;
  if (!conv) return { result: "no-conversation" };
  if (mail.date && mail.date.getTime() < new Date(conv.created_at).getTime() - 6e4) return { result: "older-than-chat", conversationId: conv.id };
  const from = addresses(mail.from)[0] || "";
  const body = extractReplyText(mail.text || "");
  if (!body) return { result: "empty", conversationId: conv.id };
  if (isSystemChatEmail(mail.subject || "", body)) return { result: "own-notification", conversationId: conv.id };
  if (from && from === conv.visitor_email.toLowerCase()) {
    addMessage(conv.id, "visitor", body);
    db.prepare("UPDATE chat_conversations SET status = 'open' WHERE id = ?").run(conv.id);
    return { result: "visitor", conversationId: conv.id };
  }
  if (from && ADMIN_ADDRESSES.has(from)) {
    db.prepare("UPDATE chat_conversations SET ai_enabled = 0, admin_unread = 0, status = 'open' WHERE id = ?").run(conv.id);
    addMessage(conv.id, "admin", body);
    const recipients = [...addresses(mail.to), ...addresses(mail.cc)];
    if (!recipients.includes(conv.visitor_email.toLowerCase())) {
      await sendVisitorReplyEmail(defaultSiteOrigin(), conv, body);
    }
    return { result: "admin", conversationId: conv.id };
  }
  return { result: "unknown-sender", conversationId: conv.id };
}
var isProcessed = (key) => !!db.prepare("SELECT 1 FROM chat_email_imports WHERE message_key = ?").get(key);
var markProcessed = (key, folder, result, conversationId) => db.prepare("INSERT OR IGNORE INTO chat_email_imports (message_key, conversation_id, folder, result, created_at) VALUES (?, ?, ?, ?, ?)").run(key, conversationId || null, folder, result, (/* @__PURE__ */ new Date()).toISOString());
var running = false;
async function syncChatEmailsOnce() {
  if (running) return 0;
  running = true;
  emailSyncStatus.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
  let imported = 0;
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_PORT === 993,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
    connectionTimeout: 2e4,
    greetingTimeout: 15e3,
    socketTimeout: 6e4
  });
  client.on("error", (err) => console.warn(`[ChatEmail] IMAP connection error: ${err?.message || err}`));
  try {
    await client.connect();
    const folders = ["INBOX"];
    const mailboxes = await client.list();
    const sent = mailboxes.find((m) => m.specialUse === "\\Sent") || mailboxes.find((m) => /^(INBOX[./])?Sent( Items| Messages)?$/i.test(m.path));
    if (sent && sent.path.toUpperCase() !== "INBOX") folders.push(sent.path);
    for (const folder of folders) {
      const lock = await client.getMailboxLock(folder);
      try {
        const uids = await client.search({ since: new Date(Date.now() - LOOKBACK_MS), subject: "NovaChat #" }, { uid: true });
        if (!uids || !uids.length) continue;
        const pending = [];
        for await (const msg of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
          const key = msg.envelope?.messageId || `${folder}:${client.mailbox && client.mailbox.uidValidity}:${msg.uid}`;
          if (!isProcessed(key)) pending.push({ uid: msg.uid, key });
        }
        for (const { uid, key } of pending) {
          const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!full || !full.source) continue;
          const mail = await simpleParser(full.source);
          const { result, conversationId } = await importChatEmail(mail);
          markProcessed(key, folder, result, conversationId);
          if (result === "admin" || result === "visitor") {
            imported += 1;
            console.log(`[ChatEmail] Added ${result} email reply to chat ${conversationId} (${folder}).`);
          }
        }
      } finally {
        lock.release();
      }
    }
    await client.logout();
    emailSyncStatus.lastOkAt = (/* @__PURE__ */ new Date()).toISOString();
    emailSyncStatus.lastError = null;
    emailSyncStatus.imported += imported;
  } catch (err) {
    const message = err?.authenticationFailed ? `IMAP login rejected for ${IMAP_USER} (check SMTP_PASS / IMAP_PASS).` : `IMAP sync failed (${IMAP_HOST}:${IMAP_PORT}): ${err?.responseText || err?.message || err}`;
    emailSyncStatus.lastError = message;
    console.warn(`[ChatEmail] ${message}`);
    try {
      client.close();
    } catch {
    }
  } finally {
    running = false;
  }
  return imported;
}
function removeWronglyImportedNotifications() {
  const rows = db.prepare("SELECT id, conversation_id, body FROM chat_messages WHERE sender = 'admin'").all();
  const bad = rows.filter((r) => isSystemChatEmail("", r.body));
  if (!bad.length) return;
  const del = db.prepare("DELETE FROM chat_messages WHERE id = ?");
  db.transaction(() => {
    for (const r of bad) del.run(r.id);
    for (const convId of new Set(bad.map((r) => r.conversation_id))) {
      const stillHuman = db.prepare("SELECT 1 FROM chat_messages WHERE conversation_id = ? AND sender = 'admin' LIMIT 1").get(convId);
      if (!stillHuman) db.prepare("UPDATE chat_conversations SET ai_enabled = 1 WHERE id = ?").run(convId);
    }
  })();
  console.log(`[ChatEmail] Removed ${bad.length} notification email(s) that were wrongly added to chats.`);
}
function startChatEmailSync() {
  try {
    removeWronglyImportedNotifications();
  } catch (err) {
    console.warn("[ChatEmail] Cleanup of wrongly imported notifications failed:", err);
  }
  emailSyncStatus.enabled = ENABLED;
  if (!ENABLED) {
    console.warn("[ChatEmail] Email reply sync is off (no SMTP_PASS / IMAP_PASS, or CHAT_EMAIL_SYNC=off). Reply from the admin panel instead.");
    return;
  }
  console.log(`[ChatEmail] Email reply sync enabled: checking ${IMAP_USER} every ${SYNC_INTERVAL_MS / 1e3}s.`);
  setTimeout(() => syncChatEmailsOnce().catch(() => {
  }), 1e4);
  setInterval(() => syncChatEmailsOnce().catch(() => {
  }), SYNC_INTERVAL_MS).unref?.();
}

// server/tawkApi.ts
import { Router as Router4 } from "express";
import crypto6 from "crypto";
var tawkRouter = Router4();
var WEBHOOK_SECRET = (process.env.TAWK_WEBHOOK_SECRET || "").trim();
if (!WEBHOOK_SECRET) {
  console.warn("[Tawk] TAWK_WEBHOOK_SECRET is not set. Chat history webhooks are rejected until it is configured.");
}
db.exec(`
  CREATE TABLE IF NOT EXISTS tawk_chats (
    id TEXT PRIMARY KEY,
    visitor_name TEXT NOT NULL DEFAULT '',
    visitor_email TEXT NOT NULL DEFAULT '',
    visitor_city TEXT NOT NULL DEFAULT '',
    visitor_country TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    referrer TEXT NOT NULL DEFAULT '',
    first_message TEXT NOT NULL DEFAULT '',
    agent_names TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'ended'
    message_count INTEGER NOT NULL DEFAULT 0,
    has_transcript INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tawk_chats_started ON tawk_chats(started_at);
  CREATE TABLE IF NOT EXISTS tawk_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'visitor' | 'agent' | 'system'
    sender_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'msg',
    body TEXT NOT NULL DEFAULT '',
    attachments TEXT NOT NULL DEFAULT '[]',
    sent_at TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES tawk_chats(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_tawk_messages_chat ON tawk_chat_messages(chat_id, id);
  CREATE TABLE IF NOT EXISTS tawk_tickets (
    id TEXT PRIMARY KEY,
    human_id INTEGER,
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    requester_name TEXT NOT NULL DEFAULT '',
    requester_email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tawk_webhook_events (
    event_id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
`);
var str = (v, max = 5e3) => typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max);
var isoOrNow = (v) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : (/* @__PURE__ */ new Date()).toISOString();
};
var lastWebhookAt = db.prepare("SELECT MAX(received_at) AS t FROM tawk_webhook_events").get()?.t || null;
var lastWebhookError = null;
function verifySignature(req) {
  const raw = req.rawBody;
  const sig = req.get("x-tawk-signature") || "";
  if (!raw || !sig || !WEBHOOK_SECRET) return false;
  const expected = crypto6.createHmac("sha1", WEBHOOK_SECRET).update(raw).digest("hex");
  const a = Buffer.from(sig.trim().toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto6.timingSafeEqual(a, b);
}
var upsertChat = db.prepare(`
  INSERT INTO tawk_chats (id, visitor_name, visitor_email, visitor_city, visitor_country, domain, referrer, first_message, status, started_at, updated_at)
  VALUES (@id, @visitor_name, @visitor_email, @visitor_city, @visitor_country, @domain, @referrer, @first_message, @status, @started_at, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    visitor_name = CASE WHEN excluded.visitor_name <> '' THEN excluded.visitor_name ELSE tawk_chats.visitor_name END,
    visitor_email = CASE WHEN excluded.visitor_email <> '' THEN excluded.visitor_email ELSE tawk_chats.visitor_email END,
    visitor_city = CASE WHEN excluded.visitor_city <> '' THEN excluded.visitor_city ELSE tawk_chats.visitor_city END,
    visitor_country = CASE WHEN excluded.visitor_country <> '' THEN excluded.visitor_country ELSE tawk_chats.visitor_country END,
    domain = CASE WHEN excluded.domain <> '' THEN excluded.domain ELSE tawk_chats.domain END,
    referrer = CASE WHEN excluded.referrer <> '' THEN excluded.referrer ELSE tawk_chats.referrer END,
    first_message = CASE WHEN tawk_chats.first_message = '' THEN excluded.first_message ELSE tawk_chats.first_message END,
    started_at = MIN(tawk_chats.started_at, excluded.started_at),
    updated_at = excluded.updated_at
`);
function chatBase(id, visitor, payload, time) {
  return {
    id,
    visitor_name: str(visitor?.name, 200),
    visitor_email: str(visitor?.email, 200),
    visitor_city: str(visitor?.city, 100),
    visitor_country: str(visitor?.country, 10),
    domain: str(payload?.domain, 300),
    referrer: str(payload?.referrer, 1e3),
    first_message: "",
    status: "active",
    started_at: time,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var handleEvent = db.transaction((payload) => {
  const event = str(payload?.event, 50);
  const time = isoOrNow(payload?.time);
  if (event === "chat:start") {
    const id = str(payload.chatId, 100);
    if (!id) return;
    upsertChat.run({ ...chatBase(id, payload.visitor, payload, time), first_message: str(payload.message?.text, 1e3) });
  } else if (event === "chat:end") {
    const id = str(payload.chatId, 100);
    if (!id) return;
    upsertChat.run(chatBase(id, payload.visitor, payload, time));
    db.prepare("UPDATE tawk_chats SET status = 'ended', ended_at = COALESCE(ended_at, ?) WHERE id = ?").run(time, id);
  } else if (event === "chat:transcript_created") {
    const chat = payload.chat || {};
    const id = str(chat.id, 100);
    if (!id) return;
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    const firstVisitor = messages.find((m) => m?.sender?.t === "v");
    const firstTime = messages.length ? isoOrNow(messages[0]?.time) : time;
    const lastTime = messages.length ? isoOrNow(messages[messages.length - 1]?.time) : time;
    upsertChat.run({ ...chatBase(id, chat.visitor, payload, firstTime), first_message: str(firstVisitor?.msg, 1e3) });
    db.prepare("DELETE FROM tawk_chat_messages WHERE chat_id = ?").run(id);
    const insert = db.prepare(
      "INSERT INTO tawk_chat_messages (chat_id, sender, sender_name, type, body, attachments, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const agents = /* @__PURE__ */ new Set();
    for (const m of messages.slice(0, 2e3)) {
      const t = m?.sender?.t;
      const sender = t === "a" ? "agent" : t === "v" ? "visitor" : "system";
      const name = str(m?.sender?.n, 200);
      if (sender === "agent" && name) agents.add(name);
      const attachments = (Array.isArray(m?.attchs) ? m.attchs : []).map((a) => a?.content?.file).filter((f) => f && typeof f.url === "string" && /^https?:\/\//i.test(f.url)).map((f) => ({ url: str(f.url, 2e3), name: str(f.name, 300), mimeType: str(f.mimeType, 100), size: Number(f.size) || 0 }));
      insert.run(id, sender, name, str(m?.type, 30) || "msg", str(m?.msg, 2e4), JSON.stringify(attachments), isoOrNow(m?.time));
    }
    db.prepare(
      "UPDATE tawk_chats SET status = 'ended', has_transcript = 1, message_count = ?, agent_names = ?, ended_at = COALESCE(ended_at, ?) WHERE id = ?"
    ).run(messages.length, [...agents].join(", "), lastTime, id);
  } else if (event === "ticket:create") {
    const t = payload.ticket || {};
    const id = str(t.id, 100);
    if (!id) return;
    db.prepare(
      `INSERT INTO tawk_tickets (id, human_id, subject, message, requester_name, requester_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`
    ).run(id, Number(t.humanId) || null, str(t.subject, 500), str(t.message, 2e4), str(payload.requester?.name, 200), str(payload.requester?.email, 200), time);
  }
});
tawkRouter.post("/webhook", (req, res) => {
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook secret not configured" });
  if (!verifySignature(req)) {
    lastWebhookError = `Rejected a webhook with an invalid signature (${(/* @__PURE__ */ new Date()).toISOString()}). Check TAWK_WEBHOOK_SECRET.`;
    console.warn("[Tawk] Webhook rejected: invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }
  try {
    const eventId = str(req.get("x-hook-event-id"), 200);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (eventId) {
      const seen = db.prepare("INSERT OR IGNORE INTO tawk_webhook_events (event_id, event, received_at) VALUES (?, ?, ?)").run(eventId, str(req.body?.event, 50), now);
      if (seen.changes === 0) return res.json({ ok: true, duplicate: true });
    }
    handleEvent(req.body);
    lastWebhookAt = now;
    lastWebhookError = null;
    res.json({ ok: true });
  } catch (err) {
    sendServerError(res, err, "tawk webhook");
  }
});
var PAGE_SIZE = 50;
tawkRouter.get("/admin/chats", verifyAdmin, (req, res) => {
  try {
    const q = str(req.query.q, 200).trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const where = [];
    const params = [];
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      where.push(
        `(visitor_name LIKE ? ESCAPE '\\' OR visitor_email LIKE ? ESCAPE '\\' OR first_message LIKE ? ESCAPE '\\'
          OR id IN (SELECT chat_id FROM tawk_chat_messages WHERE body LIKE ? ESCAPE '\\'))`
      );
      params.push(like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM tawk_chats ${whereSql}`).get(...params).n;
    const chats = db.prepare(`SELECT * FROM tawk_chats ${whereSql} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1e3).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1e3).toISOString();
    const count = (sql, ...p) => db.prepare(sql).get(...p).n;
    res.json({
      chats,
      total,
      page,
      pageSize: PAGE_SIZE,
      stats: {
        total: count("SELECT COUNT(*) AS n FROM tawk_chats"),
        last24h: count("SELECT COUNT(*) AS n FROM tawk_chats WHERE started_at >= ?", dayAgo),
        last7d: count("SELECT COUNT(*) AS n FROM tawk_chats WHERE started_at >= ?", weekAgo),
        active: count("SELECT COUNT(*) AS n FROM tawk_chats WHERE status = 'active'"),
        tickets: count("SELECT COUNT(*) AS n FROM tawk_tickets")
      },
      webhook: { configured: !!WEBHOOK_SECRET, lastReceivedAt: lastWebhookAt, lastError: lastWebhookError }
    });
  } catch (err) {
    sendServerError(res, err, "tawk admin list");
  }
});
tawkRouter.get("/admin/chats/:id", verifyAdmin, (req, res) => {
  try {
    const chat = db.prepare("SELECT * FROM tawk_chats WHERE id = ?").get(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    const messages = db.prepare("SELECT * FROM tawk_chat_messages WHERE chat_id = ? ORDER BY id ASC").all(req.params.id).map((m) => ({
      ...m,
      attachments: (() => {
        try {
          return JSON.parse(m.attachments);
        } catch {
          return [];
        }
      })()
    }));
    res.json({ chat, messages });
  } catch (err) {
    sendServerError(res, err, "tawk admin get");
  }
});
tawkRouter.get("/admin/tickets", verifyAdmin, (_req, res) => {
  try {
    res.json({ tickets: db.prepare("SELECT * FROM tawk_tickets ORDER BY created_at DESC LIMIT 200").all() });
  } catch (err) {
    sendServerError(res, err, "tawk admin tickets");
  }
});

// server/index.ts
var apiApp = express();
apiApp.set("trust proxy", 1);
apiApp.use(express.json({ limit: "1mb", verify: (req, _res, buf) => {
  req.rawBody = buf;
} }));
var writeLimiter = rateLimit({ windowMs: 60 * 1e3, max: 60 });
var sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1e3, max: 20 });
apiApp.use(
  (req, res, next) => (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") && req.path !== "/tawk/webhook" ? writeLimiter(req, res, next) : next()
);
apiApp.use(
  ["/swap/admin/login", "/affiliate/apply", "/affiliate/review-action", "/affiliate/payout/request", "/swap/rewards/request"],
  (req, res, next) => req.method === "POST" ? sensitiveLimiter(req, res, next) : next()
);
apiApp.use("/swap", apiRouter);
apiApp.use("/affiliate", affiliateRouter);
apiApp.use("/tawk", tawkRouter);
if (process.env.LEGACY_LIVE_CHAT === "true") {
  apiApp.use("/chat", chatRouter);
  startChatEmailSync();
}
var index_default = apiApp;
export {
  apiApp,
  index_default as default,
  getAffiliateRates
};
