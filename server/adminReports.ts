// Admin reports: period analytics, chain-wise volume and data exports (CSV / PDF).
// Read-only. Platform figures span every campaign round (current and archived), so they are permanent
// and are not affected by a campaign reset.
import { db } from './db.ts';
import { buildTablePdf } from './pdfTable.ts';

const CURRENT_CAMPAIGN_ID = 'campaign_genesis_001';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  100: 'Gnosis',
  130: 'Unichain',
  137: 'Polygon',
  146: 'Sonic',
  250: 'Fantom',
  288: 'Boba',
  324: 'zkSync',
  480: 'World Chain',
  1088: 'Metis',
  1101: 'Polygon zkEVM',
  1135: 'Lisk',
  1284: 'Moonbeam',
  1329: 'Sei',
  2741: 'Abstract',
  5000: 'Mantle',
  8453: 'Base',
  9745: 'Plasma',
  13371: 'Immutable zkEVM',
  25: 'Cronos',
  33139: 'ApeChain',
  34443: 'Mode',
  42161: 'Arbitrum',
  42220: 'Celo',
  43114: 'Avalanche',
  57073: 'Ink',
  59144: 'Linea',
  60808: 'BOB',
  80094: 'Berachain',
  81457: 'Blast',
  167000: 'Taiko',
  534352: 'Scroll',
  999: 'HyperEVM',
  1151111081099710: 'Solana',
  728126428: 'TRON',
  9270000000000000: 'Sui',
  20000000000001: 'Bitcoin',
};

export const chainName = (id: number | null | undefined) =>
  id == null ? '' : CHAIN_NAMES[Number(id)] || `Chain ${id}`;

// ---------------------------------------------------------------------------
// Period analytics
// ---------------------------------------------------------------------------

export type AnalyticsPeriod = 'current' | 'last6' | 'month' | 'all';

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const monthStart = (y: number, m0: number) => new Date(Date.UTC(y, m0, 1));
/** Month keys from `start` to `end` (YYYY-MM, inclusive). */
function monthsBetween(start: string, end: string, max = 240): string[] {
  const list: string[] = [];
  let [y, m] = start.split('-').map(Number);
  while (list.length < max) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
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
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/** UTC range [from, to) for a period. `month` is YYYY-MM for the custom month. */
export function periodRange(period: AnalyticsPeriod, month?: string, now = new Date()): { from: string | null; to: string | null; label: string } {
  const y = now.getUTCFullYear();
  const m0 = now.getUTCMonth();
  if (period === 'current') {
    return { from: monthStart(y, m0).toISOString(), to: monthStart(y, m0 + 1).toISOString(), label: monthLabel(monthKey(now)) };
  }
  if (period === 'last6') {
    const from = monthStart(y, m0 - 5);
    return {
      from: from.toISOString(),
      to: monthStart(y, m0 + 1).toISOString(),
      label: `${monthLabel(monthKey(from))} – ${monthLabel(monthKey(now))}`,
    };
  }
  if (period === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
    if (!match) throw new Error('Choose a month (YYYY-MM).');
    const yy = Number(match[1]);
    const mm = Number(match[2]) - 1;
    if (mm < 0 || mm > 11) throw new Error('Choose a valid month.');
    return { from: monthStart(yy, mm).toISOString(), to: monthStart(yy, mm + 1).toISOString(), label: monthLabel(match[0]) };
  }
  return { from: null, to: null, label: 'All time' };
}

const inRange = (col: string, r: { from: string | null; to: string | null }) =>
  r.from && r.to ? { sql: ` AND ${col} >= ? AND ${col} < ?`, params: [r.from, r.to] } : { sql: '', params: [] as string[] };

export function getPeriodAnalytics(period: AnalyticsPeriod, month?: string, now = new Date()) {
  const range = periodRange(period, month, now);
  const tx = inRange('created_at', range);

  const totals = db.prepare(`
    SELECT COUNT(*) as swaps, COALESCE(SUM(volume_usd), 0) as volume, COUNT(DISTINCT wallet_address) as swapping_wallets
    FROM swap_transactions WHERE execution_status = 'DONE'${tx.sql}
  `).get(...tx.params) as any;

  // A wallet counts once, in the month it first connected (a campaign reset copies wallets into the new
  // round, so the earliest record per wallet is used)
  const firstSeen = `(SELECT wallet_address, MIN(created_at) AS first_at FROM swap_campaign_users GROUP BY wallet_address)`;
  const fs = inRange('first_at', range);
  const wallets = db.prepare(`SELECT COUNT(*) as n FROM ${firstSeen} WHERE 1 = 1${fs.sql}`).get(...fs.params) as any;

  const byChain = (db.prepare(`
    SELECT chain_id, COUNT(*) as swaps, COALESCE(SUM(volume_usd), 0) as volume
    FROM swap_transactions WHERE execution_status = 'DONE'${tx.sql}
    GROUP BY chain_id ORDER BY volume DESC
  `).all(...tx.params) as any[]).map((r) => ({
    chainId: Number(r.chain_id),
    chainName: chainName(r.chain_id),
    swaps: r.swaps,
    volumeUSD: Number(Number(r.volume).toFixed(2)),
  }));

  // Month-by-month rows (every month of the period, including empty ones)
  const txByMonth = new Map<string, { swaps: number; volume: number }>(
    (db.prepare(`
      SELECT substr(created_at, 1, 7) as m, COUNT(*) as swaps, COALESCE(SUM(volume_usd), 0) as volume
      FROM swap_transactions WHERE execution_status = 'DONE'${tx.sql} GROUP BY m
    `).all(...tx.params) as any[]).map((r) => [r.m, { swaps: r.swaps, volume: r.volume }])
  );
  const walletsByMonth = new Map<string, number>(
    (db.prepare(`SELECT substr(first_at, 1, 7) as m, COUNT(*) as n FROM ${firstSeen} WHERE 1 = 1${fs.sql} GROUP BY m`).all(...fs.params) as any[]).map(
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
      newWallets: walletsByMonth.get(key) || 0,
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
      swappingWallets: totals.swapping_wallets || 0,
    },
    byChain,
    months,
    availableMonths: availableMonths(now),
  };
}

/** Months with data, oldest first, up to the current month (for the custom month picker). */
export function availableMonths(now = new Date()): string[] {
  const row = db.prepare(`
    SELECT MIN(m) as first FROM (
      SELECT MIN(created_at) as m FROM swap_transactions
      UNION ALL SELECT MIN(created_at) FROM swap_campaign_users
    ) WHERE m IS NOT NULL
  `).get() as any;
  const end = monthKey(now);
  const start = typeof row?.first === 'string' && /^\d{4}-\d{2}/.test(row.first) ? row.first.slice(0, 7) : end;
  return monthsBetween(start, end);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type ExportType = 'users' | 'transactions' | 'claims' | 'referrals';
interface Column {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'usd' | 'date' | 'bool' | 'hash';
}
export interface ExportTable {
  title: string;
  fileBase: string;
  columns: Column[];
  rows: Record<string, any>[];
}

const ROUND_SQL = (alias: string) => `
  CASE WHEN ${alias}.campaign_id = '${CURRENT_CAMPAIGN_ID}' THEN 'Current'
       ELSE 'Archived ' || COALESCE(substr(rc.end_date, 1, 10), '') END`;

export function buildExport(type: ExportType): ExportTable {
  if (type === 'users') {
    return {
      title: 'Nova Swap - Users',
      fileBase: 'nova_swap_users',
      columns: [
        { key: 'wallet_address', label: 'Wallet', kind: 'hash' },
        { key: 'round', label: 'Campaign round' },
        { key: 'chain', label: 'Chain' },
        { key: 'total_volume_usd', label: 'Volume (USD)', kind: 'usd' },
        { key: 'eligible_swaps_count', label: 'Swaps', kind: 'number' },
        { key: 'referral_code', label: 'Referral code' },
        { key: 'is_flagged', label: 'Flagged', kind: 'bool' },
        { key: 'verified_at', label: 'Verified (UTC)', kind: 'date' },
        { key: 'created_at', label: 'Joined (UTC)', kind: 'date' },
      ],
      rows: (db.prepare(`
        SELECT u.*, ${ROUND_SQL('u')} as round
        FROM swap_campaign_users u LEFT JOIN swap_campaigns rc ON rc.id = u.campaign_id
        ORDER BY (u.campaign_id = '${CURRENT_CAMPAIGN_ID}') DESC, u.total_volume_usd DESC
      `).all() as any[]).map((r) => ({ ...r, chain: chainName(r.chain_id), referral_code: String(r.referral_code || '').split('-')[0] })),
    };
  }
  if (type === 'transactions') {
    return {
      title: 'Nova Swap - Swaps',
      fileBase: 'nova_swap_swaps',
      columns: [
        { key: 'created_at', label: 'Date (UTC)', kind: 'date' },
        { key: 'wallet_address', label: 'Wallet', kind: 'hash' },
        { key: 'chain', label: 'Chain' },
        { key: 'kind', label: 'Type' },
        { key: 'from_token_symbol', label: 'From' },
        { key: 'to_token_symbol', label: 'To' },
        { key: 'volume_usd', label: 'Volume (USD)', kind: 'usd' },
        { key: 'execution_status', label: 'Status' },
        { key: 'round', label: 'Campaign round' },
        { key: 'tx_hash', label: 'Tx hash / order id', kind: 'hash' },
      ],
      rows: (db.prepare(`
        SELECT t.*, ${ROUND_SQL('t')} as round
        FROM swap_transactions t LEFT JOIN swap_campaigns rc ON rc.id = t.campaign_id
        ORDER BY t.created_at DESC
      `).all() as any[]).map((r) => ({
        ...r,
        chain: chainName(r.chain_id),
        kind: r.verification_source === 'cow_orderbook_api' ? 'Limit order' : 'Market swap',
      })),
    };
  }
  if (type === 'claims') {
    return {
      title: 'Nova Swap - Reward Claims',
      fileBase: 'nova_swap_claims',
      columns: [
        { key: 'created_at', label: 'Requested (UTC)', kind: 'date' },
        { key: 'wallet_address', label: 'Wallet', kind: 'hash' },
        { key: 'requested_amount_usd', label: 'Amount (USD)', kind: 'usd' },
        { key: 'status', label: 'Status' },
        { key: 'payout_address', label: 'Payout address', kind: 'hash' },
        { key: 'preferred_network', label: 'Network' },
        { key: 'preferred_token', label: 'Token' },
        { key: 'payout_tx_hash', label: 'Payout tx', kind: 'hash' },
        { key: 'paid_at', label: 'Paid (UTC)', kind: 'date' },
        { key: 'round', label: 'Campaign round' },
        { key: 'id', label: 'Claim id' },
      ],
      rows: db.prepare(`
        SELECT c.id, u.wallet_address, c.requested_amount_usd, c.payout_address, c.preferred_network, c.preferred_token,
               c.status, p.payout_tx_hash, p.paid_at, c.created_at, ${ROUND_SQL('c')} as round
        FROM swap_reward_claims c
        JOIN swap_campaign_users u ON u.id = c.user_id
        LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
        LEFT JOIN swap_campaigns rc ON rc.id = c.campaign_id
        ORDER BY c.created_at DESC
      `).all() as any[],
    };
  }
  return {
    title: 'Nova Swap - Referrals',
    fileBase: 'nova_swap_referrals',
    columns: [
      { key: 'created_at', label: 'Date (UTC)', kind: 'date' },
      { key: 'referrer_wallet', label: 'Referrer', kind: 'hash' },
      { key: 'referred_wallet', label: 'Referred wallet', kind: 'hash' },
      { key: 'referral_code', label: 'Code' },
      { key: 'status', label: 'Status' },
      { key: 'qualifying_volume_usd', label: 'Qualifying volume (USD)', kind: 'usd' },
      { key: 'reward_amount_usd', label: 'Reward (USD)', kind: 'usd' },
      { key: 'round', label: 'Campaign round' },
    ],
    rows: (db.prepare(`
      SELECT r.*, u1.wallet_address as referrer_wallet, u2.wallet_address as referred_wallet, ${ROUND_SQL('r')} as round
      FROM swap_referrals r
      JOIN swap_campaign_users u1 ON u1.id = r.referrer_user_id
      JOIN swap_campaign_users u2 ON u2.id = r.referred_user_id
      LEFT JOIN swap_campaigns rc ON rc.id = r.campaign_id
      ORDER BY r.created_at DESC
    `).all() as any[]).map((r) => ({ ...r, referral_code: String(r.referral_code || '').split('-')[0] })),
  };
}

/** Plain display text for one cell (same in CSV and PDF). */
function cellText(value: any, kind: Column['kind']): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'usd') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '';
  }
  if (kind === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : '';
  }
  if (kind === 'bool') return Number(value) ? 'Yes' : 'No';
  if (kind === 'date') {
    const t = Date.parse(String(value));
    // "YYYY-MM-DD HH:MM:SS" is recognised as a date by Excel, Google Sheets and Numbers
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 19).replace('T', ' ') : String(value);
  }
  return String(value).replace(/[\r\n\t]+/g, ' ').trim();
}

/**
 * Standard CSV (RFC 4180): UTF-8 with BOM (so Excel shows text correctly), comma separated, CRLF line
 * endings, every text field quoted, a header row even when there is no data. Text that a spreadsheet
 * would run as a formula is prefixed with an apostrophe.
 */
export function toCsv(table: ExportTable): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const safe = (s: string, kind: Column['kind']) =>
    kind !== 'usd' && kind !== 'number' && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  const lines = [table.columns.map((c) => esc(c.label)).join(',')];
  for (const row of table.rows) {
    lines.push(
      table.columns
        .map((c) => {
          const text = cellText(row[c.key], c.kind);
          return c.kind === 'usd' || c.kind === 'number' ? text : esc(safe(text, c.kind));
        })
        .join(',')
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function toPdf(table: ExportTable, generatedAt = new Date()): Buffer {
  return buildTablePdf({
    title: table.title,
    subtitle: `${table.rows.length} record${table.rows.length === 1 ? '' : 's'} - generated ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    columns: table.columns.map((c) => ({ label: c.label, align: c.kind === 'usd' || c.kind === 'number' ? 'right' : 'left', shorten: c.kind === 'hash' })),
    rows: table.rows.map((r) => table.columns.map((c) => cellText(r[c.key], c.kind))),
  });
}
