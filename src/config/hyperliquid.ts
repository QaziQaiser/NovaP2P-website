// Futures tab (Hyperliquid perpetuals) settings.
//
// BUILDER ADDRESS
// Leave it empty ('') and Futures works normally with no Nova builder fee and no "Approve Builder Fee" step.
// To start earning, paste the Nova builder wallet below (or set VITE_HL_BUILDER_ADDRESS at build time).
// Nothing else has to change: users see a one-time "Approve Builder Fee" signature before their next trade.
// Hyperliquid only accepts a builder whose perps account holds at least 100 USDC.

/** Wallet that receives the Nova builder fee on Hyperliquid. Empty = no builder fee. */
export const HL_BUILDER_ADDRESS: string = (import.meta.env.VITE_HL_BUILDER_ADDRESS as string | undefined)?.trim() || '';

/**
 * Builder fee per trade, in tenths of a basis point (10 = 1 bp = 0.01%).
 * 50 = 0.05% of the order's notional value. Hyperliquid allows at most 100 (0.1%) on perps.
 */
export const HL_BUILDER_FEE_TENTHS_BPS = 50;

/** Hyperliquid network. Keep 'Mainnet' in production. */
export const HL_NETWORK: 'Mainnet' | 'Testnet' = 'Mainnet';

/** Price protection for market orders (same 5% default as Hyperliquid's official Python SDK). */
export const HL_MARKET_SLIPPAGE = 0.05;

/** Price protection for TP/SL market orders once they trigger. */
export const HL_TRIGGER_SLIPPAGE = 0.1;

/** Name shown for the Nova trading key in the user's Hyperliquid "API wallets" list. */
export const HL_AGENT_NAME = 'NovaP2P';

/** Coin selected when the Futures tab first opens. */
export const HL_DEFAULT_COIN = 'BTC';

// ---- Derived values (no need to edit) ----

const isAddress = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

/** Builder settings used in orders, or null when no valid builder is configured. */
export const HL_BUILDER = isAddress(HL_BUILDER_ADDRESS)
  ? { address: HL_BUILDER_ADDRESS.toLowerCase() as `0x${string}`, fee: HL_BUILDER_FEE_TENTHS_BPS }
  : null;

/** The fee as Hyperliquid's approveBuilderFee expects it, e.g. "0.05%". */
export const HL_BUILDER_FEE_PERCENT = `${(HL_BUILDER_FEE_TENTHS_BPS / 1000).toString()}%` as `${string}%`;
