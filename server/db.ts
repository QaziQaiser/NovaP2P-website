import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nova_swap.db');
export const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize all required tables and indexes
export function initDb() {
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
  `);

  // Migration: Ensure existing table columns exist if created previously
  try {
    const tableInfo = db.prepare("PRAGMA table_info(swap_reward_claims)").all() as any[];
    const columnNames = tableInfo.map((col: any) => col.name);
    if (!columnNames.includes('cashback_amount_usd')) {
      db.exec("ALTER TABLE swap_reward_claims ADD COLUMN cashback_amount_usd REAL NOT NULL DEFAULT 0.0;");
    }
    if (!columnNames.includes('milestone_amount_usd')) {
      db.exec("ALTER TABLE swap_reward_claims ADD COLUMN milestone_amount_usd REAL NOT NULL DEFAULT 0.0;");
    }
    if (!columnNames.includes('referral_amount_usd')) {
      db.exec("ALTER TABLE swap_reward_claims ADD COLUMN referral_amount_usd REAL NOT NULL DEFAULT 0.0;");
    }
  } catch (err) {
    // Ignore if table was just created
  }

  // Seed / Update active Genesis campaign configuration
  const campaignId = 'campaign_genesis_001';
  const existingCampaign = db.prepare('SELECT id FROM swap_campaigns WHERE slug = ?').get('genesis') as any;
  const now = new Date().toISOString();
  const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

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
      'genesis',
      'Nova Swap Genesis Campaign',
      'Complete your swaps and earn amazing rewards!',
      'active',
      now,
      endDate,
      50000.0, // $50,000 budget
      0.0,
      1.0,     // $1 minimum eligible swap
      5.0,     // $5.00 USDT referral bonus
      2000.0,  // $2,000 volume required for referral qualification
      1,       // 5% cashback active
      5.0,     // 5% cashback percentage
      now,
      now
    );
  } else {
    // Ensure existing campaign in persistent DB is updated to match official specs
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

  // Seed / Update official Genesis milestones ($10,000 -> $25, $25,000 -> $50, $50,000 -> $100)
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
    'ms_genesis_1',
    targetCampaignId,
    1,
    'Milestone 1',
    10000.0,
    25.0,
    '$25 USDT Bonus Reward on reaching $10,000 swap volume',
    1,
    1,
    now
  );

  upsertMilestone.run(
    'ms_genesis_2',
    targetCampaignId,
    2,
    'Milestone 2',
    25000.0,
    50.0,
    '$50 USDT Bonus Reward on reaching $25,000 swap volume',
    1,
    2,
    now
  );

  upsertMilestone.run(
    'ms_genesis_3',
    targetCampaignId,
    3,
    'Milestone 3',
    50000.0,
    100.0,
    '$100 USDT Bonus Reward on reaching $50,000 swap volume',
    1,
    3,
    now
  );
}

// Automatically initialize on import
initDb();
