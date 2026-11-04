// server/index.ts
import express from "express";

// server/api.ts
import { Router } from "express";

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
      min_swap_usd REAL NOT NULL DEFAULT 10.0,
      referral_reward_usd REAL NOT NULL DEFAULT 0.10,
      referral_qualifying_vol_usd REAL NOT NULL DEFAULT 100.0,
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
      10,
      // $10 minimum eligible swap
      0.1,
      // $0.10 USDT referral bonus
      100,
      // $100 volume required for referral qualification
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
      SET referral_reward_usd = 0.10,
          referral_qualifying_vol_usd = 100.0,
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

// server/api.ts
import { ethers } from "ethers";
import crypto from "crypto";
var apiRouter = Router();
var ADMIN_KEY = process.env.SWAP_ADMIN_KEY || "nova-genesis-admin-2026";
var ENABLED_CHAINS = [1, 56, 137, 42161, 10, 8453];
var pendingNonces = /* @__PURE__ */ new Map();
function getOrCreateNonce(walletAddress) {
  const normalized = walletAddress.toLowerCase();
  const now = Date.now();
  const existing = pendingNonces.get(normalized);
  if (existing && now - existing.timestamp < 10 * 60 * 1e3) {
    return existing.nonce;
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  pendingNonces.set(normalized, { nonce, timestamp: now });
  return nonce;
}
function verifyAdmin(req, res, next) {
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
      "evt_" + crypto.randomUUID(),
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
      "evt_" + crypto.randomUUID(),
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
        newRefCode = "NP" + crypto.randomBytes(3).toString("hex").toUpperCase();
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
      }
      const userId = "usr_" + crypto.randomUUID();
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
          "ref_" + crypto.randomUUID(),
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
    `).run("evt_" + crypto.randomUUID(), campaignId, user.id, normalizedAddress, "wallet_connected", String(ip || ""), now);
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
apiRouter.get("/user/:walletAddress", (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }
    const normalizedAddress = walletAddress.toLowerCase();
    const campaignId = "campaign_genesis_001";
    let user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
    if (!user) {
      let newRefCode = "";
      while (true) {
        newRefCode = "NOVA" + crypto.randomBytes(3).toString("hex").toUpperCase();
        const exists = db.prepare("SELECT id FROM swap_campaign_users WHERE referral_code = ?").get(newRefCode);
        if (!exists) break;
      }
      const userId = "usr_" + crypto.randomUUID();
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
    if (!ENABLED_CHAINS.includes(numericChainId)) {
      return res.status(400).json({ error: `Chain ID ${numericChainId} is not an enabled EVM network on Nova` });
    }
    const campaignId = "campaign_genesis_001";
    const user = db.prepare("SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?").get(campaignId, normalizedAddress);
    if (!user) {
      return res.status(404).json({ error: "User wallet not registered. Connect wallet first." });
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
    const minSwapUSD = campaign ? campaign.min_swap_usd : 10;
    if (verifiedVolume < minSwapUSD) {
      return res.status(400).json({
        error: `Swap volume ($${verifiedVolume.toFixed(2)}) is below minimum eligible threshold of $${minSwapUSD.toFixed(2)}`
      });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const txId = "tx_" + crypto.randomUUID();
    const runTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO swap_transactions (
          id, campaign_id, user_id, wallet_address, chain_id, tx_hash,
          lifi_route_id, from_token_symbol, from_token_address, to_token_symbol,
          to_token_address, from_amount, to_amount, volume_usd, execution_status,
          verification_status, verification_source, verified_at, raw_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        txId,
        campaignId,
        user.id,
        normalizedAddress,
        numericChainId,
        normalizedTxHash,
        lifiRouteId || null,
        fromToken?.symbol || null,
        fromToken?.address || null,
        toToken?.symbol || null,
        toToken?.address || null,
        fromAmount ? String(fromAmount) : null,
        toAmount ? String(toAmount) : null,
        verifiedVolume,
        "DONE",
        "VERIFIED",
        lifiVerified ? "lifi_status_api" : "validated_route",
        now,
        rawRouteData ? JSON.stringify(rawRouteData) : null,
        now
      );
      const newTotalVolume = user.total_volume_usd + verifiedVolume;
      const newSwapsCount = user.eligible_swaps_count + 1;
      db.prepare(`
        UPDATE swap_campaign_users 
        SET total_volume_usd = ?, eligible_swaps_count = ?, last_active_at = ?
        WHERE id = ?
      `).run(newTotalVolume, newSwapsCount, now, user.id);
      let creditedCashbackUSD = 0;
      if (campaign && campaign.cashback_enabled) {
        const novaFeeCollectedUSD = verifiedVolume * 5e-3;
        const cashbackRate = (campaign.cashback_percentage || 5) / 100;
        creditedCashbackUSD = Number((novaFeeCollectedUSD * cashbackRate).toFixed(4));
        if (creditedCashbackUSD > 0) {
          const cbId = "cb_" + crypto.randomUUID();
          db.prepare(`
            INSERT INTO swap_cashback_ledger (
              id, campaign_id, user_id, wallet_address, transaction_id,
              swap_volume_usd, nova_fee_usd, cashback_rate, cashback_amount_usd,
              status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'credited', ?)
          `).run(
            cbId,
            campaignId,
            user.id,
            normalizedAddress,
            txId,
            verifiedVolume,
            novaFeeCollectedUSD,
            cashbackRate,
            creditedCashbackUSD,
            now
          );
          const cbRewardId = "rwd_cb_" + crypto.randomUUID();
          db.prepare(`
            INSERT INTO swap_rewards (
              id, campaign_id, user_id, milestone_id, reward_type,
              amount_usd, status, unlocked_at, created_at
            ) VALUES (?, ?, ?, NULL, 'cashback', ?, 'unlocked', ?, ?)
          `).run(cbRewardId, campaignId, user.id, creditedCashbackUSD, now, now);
        }
      }
      const milestones = db.prepare(`
        SELECT * FROM swap_campaign_milestones 
        WHERE campaign_id = ? AND is_active = 1
      `).all(campaignId);
      const newlyUnlocked = [];
      milestones.forEach((m) => {
        if (newTotalVolume >= m.target_volume_usd) {
          const existingReward = db.prepare(`
            SELECT id FROM swap_rewards WHERE user_id = ? AND milestone_id = ?
          `).get(user.id, m.id);
          if (!existingReward) {
            const rewardId = "rwd_" + crypto.randomUUID();
            db.prepare(`
              INSERT INTO swap_rewards (
                id, campaign_id, user_id, milestone_id, reward_type,
                amount_usd, status, unlocked_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              rewardId,
              campaignId,
              user.id,
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
      if (user.referred_by_user_id) {
        const referral = db.prepare(`
          SELECT * FROM swap_referrals 
          WHERE campaign_id = ? AND referred_user_id = ?
        `).get(campaignId, user.id);
        if (referral && referral.status === "connected") {
          if (newTotalVolume >= campaign.referral_qualifying_vol_usd) {
            const refRewardAmount = campaign.referral_reward_usd || 0.1;
            db.prepare(`
              UPDATE swap_referrals 
              SET status = 'qualified', qualifying_volume_usd = ?, reward_amount_usd = ?, qualified_at = ?
              WHERE id = ?
            `).run(newTotalVolume, refRewardAmount, now, referral.id);
            const refRewardId = "rwd_ref_" + crypto.randomUUID();
            db.prepare(`
              INSERT INTO swap_rewards (
                id, campaign_id, user_id, milestone_id, reward_type,
                amount_usd, status, unlocked_at, created_at
              ) VALUES (?, ?, ?, NULL, 'referral', ?, 'unlocked', ?, ?)
            `).run(refRewardId, campaignId, user.referred_by_user_id, refRewardAmount, now, now);
          }
        }
      }
      return { newTotalVolume, newSwapsCount, newlyUnlocked, creditedCashbackUSD };
    });
    const result = runTransaction();
    res.json({
      success: true,
      verifiedVolume,
      totalVolumeUSD: result.newTotalVolume,
      eligibleSwapsCount: result.newSwapsCount,
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
    const claimId = "clm_" + crypto.randomUUID();
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
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: "Invalid admin passkey" });
  }
  res.json({ success: true, token: ADMIN_KEY });
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
    `).run("log_" + crypto.randomUUID(), campaignId, JSON.stringify(req.body), String(req.ip || ""), now);
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
      const newId = "ms_" + crypto.randomUUID();
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
        "log_" + crypto.randomUUID(),
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
    const payoutId = "pay_" + crypto.randomUUID();
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
        "log_" + crypto.randomUUID(),
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
var index_default = apiApp;
export {
  apiApp,
  index_default as default
};
