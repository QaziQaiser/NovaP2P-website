// Finds filled Nova Swap limit orders (CoW Protocol) for a wallet so they can be credited to the Genesis
// campaign like Market swaps. Read-only and non-custodial: everything is read from CoW's public orderbook
// (orders signed by the wallet itself), the settlement trades, LI.FI token prices and a public RPC.
// Nothing is ever taken from the browser, so volume cannot be faked by the client.
import { keccak256, toUtf8Bytes, formatUnits } from 'ethers';

interface CowNetwork {
  api: string;
  rpc: string;
}

// Same networks as Limit mode on the site (src/components/swap/limit/cowApi.ts)
const COW_NETWORKS: Record<number, CowNetwork> = {
  1: { api: 'mainnet', rpc: 'https://ethereum-rpc.publicnode.com' },
  42161: { api: 'arbitrum_one', rpc: 'https://arb1.arbitrum.io/rpc' },
  8453: { api: 'base', rpc: 'https://mainnet.base.org' },
  56: { api: 'bnb', rpc: 'https://bsc-dataseed.binance.org' },
  137: { api: 'polygon', rpc: 'https://polygon-bor-rpc.publicnode.com' },
  43114: { api: 'avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
  59144: { api: 'linea', rpc: 'https://rpc.linea.build' },
  100: { api: 'xdai', rpc: 'https://rpc.gnosischain.com' },
  57073: { api: 'ink', rpc: 'https://rpc-gel.inkonchain.com' },
  9745: { api: 'plasma', rpc: 'https://rpc.plasma.to' },
};

// Must match the app data signed by Limit mode (cowApi.ts)
const NOVA_PARTNER_FEE_BPS = 25;
const NOVA_PARTNER_FEE_RECIPIENT = '0x9b708d93d1230DA9957F71D07beC6F9a1EE31C12';
const NOVA_APP_DATA = JSON.stringify({
  appCode: 'NovaSwap',
  metadata: { partnerFee: { volumeBps: NOVA_PARTNER_FEE_BPS, recipient: NOVA_PARTNER_FEE_RECIPIENT } },
  version: '1.6.0',
});
const CURRENT_APP_DATA_HASH = keccak256(toUtf8Bytes(NOVA_APP_DATA)).toLowerCase();
const LEGACY_APP_DATA_HASH = '0x3230754c0e71ebfbe685c7060ed28119597134332029ad017f3e988113e15ab9'; // before the fee

export interface NovaLimitFill {
  chainId: number;
  orderUid: string;
  settlementTxHash: string;
  volumeUSD: number;
  /** Nova fee charged on this order, % of volume (0.25, or 0 for orders placed before the fee) */
  novaFeePct: number;
  fromToken: { symbol: string; address: string };
  toToken: { symbol: string; address: string };
  fromAmount: string;
  toAmount: string;
  filledAt: string;
}

async function getJson(url: string, timeoutMs = 8000, init?: RequestInit): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init?.headers || {}) }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Nova fee (% of volume) if the order was placed from Nova Swap, otherwise null. */
function novaFeePctOf(order: any): number | null {
  const hash = String(order?.appData || '').toLowerCase();
  let full: any = null;
  try {
    full = order?.fullAppData ? JSON.parse(order.fullAppData) : null;
  } catch {
    full = null;
  }
  const isNova = hash === CURRENT_APP_DATA_HASH || hash === LEGACY_APP_DATA_HASH || full?.appCode === 'NovaSwap';
  if (!isNova) return null;
  const fee = full?.metadata?.partnerFee;
  if (fee && String(fee.recipient || '').toLowerCase() === NOVA_PARTNER_FEE_RECIPIENT.toLowerCase()) {
    const bps = Number(fee.volumeBps ?? fee.bps ?? 0);
    return Number.isFinite(bps) && bps > 0 ? bps / 100 : 0;
  }
  return hash === CURRENT_APP_DATA_HASH ? NOVA_PARTNER_FEE_BPS / 100 : 0;
}

// LI.FI token info (symbol, decimals, USD price), cached for a few minutes
const tokenCache = new Map<string, { at: number; data: { symbol: string; decimals: number; priceUSD: number } | null }>();
async function tokenInfo(chainId: number, address: string) {
  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = tokenCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.data;
  const d = await getJson(`https://li.quest/v1/token?chain=${chainId}&token=${address}`);
  const data =
    d && Number.isFinite(Number(d.decimals))
      ? { symbol: String(d.symbol || ''), decimals: Number(d.decimals), priceUSD: Number(d.priceUSD || 0) }
      : null;
  tokenCache.set(key, { at: Date.now(), data });
  return data;
}

async function blockTime(chainId: number, blockNumber: number): Promise<string | null> {
  const net = COW_NETWORKS[chainId];
  if (!net || !blockNumber) return null;
  const d = await getJson(net.rpc, 6000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['0x' + blockNumber.toString(16), false] }),
  });
  const ts = parseInt(d?.result?.timestamp, 16);
  return Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null;
}

/**
 * Filled Nova limit orders of `owner` on every CoW network, skipping orders already credited.
 * Volume = USD value of what was traded (the lower of the sold and the received side, so a token with a
 * thin or wrong price cannot inflate it).
 */
export async function fetchNovaLimitFills(
  owner: string,
  isAlreadyHandled: (chainId: number, orderUid: string) => boolean
): Promise<NovaLimitFill[]> {
  const wallet = owner.toLowerCase();
  const perChain = await Promise.all(
    Object.entries(COW_NETWORKS).map(async ([id, net]) => {
      const chainId = Number(id);
      const orders = await getJson(`https://api.cow.fi/${net.api}/api/v1/account/${wallet}/orders?offset=0&limit=100`);
      if (!Array.isArray(orders)) return [] as NovaLimitFill[];
      const fills: NovaLimitFill[] = [];
      for (const o of orders) {
        if (String(o?.owner || '').toLowerCase() !== wallet) continue;
        // Only final orders (a partly filled order is counted once it can no longer fill further)
        if (!['fulfilled', 'cancelled', 'expired'].includes(String(o?.status))) continue;
        const novaFeePct = novaFeePctOf(o);
        if (novaFeePct === null) continue;
        const uid = String(o.uid || '').toLowerCase();
        if (!/^0x[0-9a-f]{112}$/.test(uid) || isAlreadyHandled(chainId, uid)) continue;

        const executedSell = BigInt(o.executedSellAmount || '0');
        const executedBuy = BigInt(o.executedBuyAmount || '0');
        if (executedSell <= 0n || executedBuy <= 0n) continue;

        // The settlement must exist on-chain (CoW indexes trades from the settlement contract's events)
        const trades = await getJson(`https://api.cow.fi/${net.api}/api/v1/trades?orderUid=${uid}`);
        if (!Array.isArray(trades) || trades.length === 0) continue;
        const last = trades.reduce((a: any, b: any) => (Number(b.blockNumber) > Number(a.blockNumber) ? b : a));
        const settlementTxHash = String(last.txHash || '').toLowerCase();
        if (!/^0x[0-9a-f]{64}$/.test(settlementTxHash)) continue;

        const [sellT, buyT] = await Promise.all([tokenInfo(chainId, o.sellToken), tokenInfo(chainId, o.buyToken)]);
        const sellUSD = sellT && sellT.priceUSD > 0 ? Number(formatUnits(executedSell, sellT.decimals)) * sellT.priceUSD : 0;
        const buyUSD = buyT && buyT.priceUSD > 0 ? Number(formatUnits(executedBuy, buyT.decimals)) * buyT.priceUSD : 0;
        const volumeUSD = sellUSD > 0 && buyUSD > 0 ? Math.min(sellUSD, buyUSD) : Math.max(sellUSD, buyUSD);
        if (!Number.isFinite(volumeUSD) || volumeUSD <= 0) continue; // no price yet: retried on a later sync

        const filledAt = (await blockTime(chainId, Number(last.blockNumber))) || String(o.creationDate || new Date().toISOString());
        fills.push({
          chainId,
          orderUid: uid,
          settlementTxHash,
          volumeUSD: Number(volumeUSD.toFixed(4)),
          novaFeePct,
          fromToken: { symbol: sellT?.symbol || '', address: String(o.sellToken) },
          toToken: { symbol: buyT?.symbol || '', address: String(o.buyToken) },
          fromAmount: executedSell.toString(),
          toAmount: executedBuy.toString(),
          filledAt,
        });
      }
      return fills;
    })
  );
  return perChain.flat();
}
