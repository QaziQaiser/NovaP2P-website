// Token list and on-chain reads for Limit mode (read-only; never used by the Market swap).
import { Contract, JsonRpcProvider } from 'ethers';
import { getCowChain, COW_VAULT_RELAYER } from './cowApi';

export interface LimitToken {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
}

const NATIVE_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

// Shown first in the picker
const POPULAR = ['WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'CBBTC', 'USDC.E', 'WBNB', 'WPOL', 'WMATIC', 'WAVAX', 'WXDAI', 'ARB', 'OP', 'LINK', 'UNI', 'AAVE', 'COW', 'GNO', 'BTCB', 'ETH'];

const tokenCache = new Map<number, Promise<LimitToken[]>>();

/** ERC-20 tokens for a chain from the LI.FI token list (native coins are excluded: CoW sells wrapped coins). */
export function loadLimitTokens(chainId: number): Promise<LimitToken[]> {
  if (!tokenCache.has(chainId)) {
    const p = fetch(`https://li.quest/v1/tokens?chains=${chainId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Could not load tokens');
        return r.json();
      })
      .then((data) => {
        const list: any[] = data?.tokens?.[chainId] || [];
        const rank = (t: any) => {
          const i = POPULAR.indexOf(String(t.symbol).toUpperCase());
          return i === -1 ? 1000 : i;
        };
        return list
          .filter((t) => t?.address && !NATIVE_ADDRESSES.has(String(t.address).toLowerCase()))
          .sort((a, b) => {
            const r = rank(a) - rank(b);
            if (r !== 0) return r;
            const va = a.verificationStatus === 'verified' ? 0 : 1;
            const vb = b.verificationStatus === 'verified' ? 0 : 1;
            if (va !== vb) return va - vb;
            // tokens with a known price first
            return (Number(b.priceUSD || 0) > 0 ? 1 : 0) - (Number(a.priceUSD || 0) > 0 ? 1 : 0);
          })
          .map((t) => ({
            chainId,
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            decimals: Number(t.decimals),
            logoURI: t.logoURI,
            priceUSD: t.priceUSD,
          }));
      })
      .catch((err) => {
        tokenCache.delete(chainId); // retry next time
        throw err;
      });
    tokenCache.set(chainId, p);
  }
  return tokenCache.get(chainId)!;
}

const providers = new Map<number, JsonRpcProvider>();
const rpc = (chainId: number) => {
  if (!providers.has(chainId)) {
    const chain = getCowChain(chainId);
    if (!chain) throw new Error('Unsupported network');
    providers.set(chainId, new JsonRpcProvider(chain.rpcUrl, chainId, { staticNetwork: true }));
  }
  return providers.get(chainId)!;
};

const ERC20_READ_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export async function readTokenBalance(chainId: number, token: string, owner: string): Promise<bigint> {
  const c = new Contract(token, ERC20_READ_ABI, rpc(chainId));
  return BigInt((await c.balanceOf(owner)).toString());
}

/** Allowance granted to CoW's vault relayer (the contract that moves tokens when an order fills). */
export async function readCowAllowance(chainId: number, token: string, owner: string): Promise<bigint> {
  const c = new Contract(token, ERC20_READ_ABI, rpc(chainId));
  return BigInt((await c.allowance(owner, COW_VAULT_RELAYER)).toString());
}

/** Formats base units for display (max 6 significant decimals). */
export function formatTokenAmount(value: bigint, decimals: number, maxDecimals = 6): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, '0');
  if (whole === 0n) {
    // keep a few significant digits for tiny amounts
    const firstNonZero = frac.search(/[1-9]/);
    const keep = firstNonZero === -1 ? 0 : Math.min(decimals, Math.max(maxDecimals, firstNonZero + 4));
    frac = frac.slice(0, keep);
  } else {
    frac = frac.slice(0, maxDecimals);
  }
  frac = frac.replace(/0+$/, '');
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${wholeStr}${frac ? '.' + frac : ''}`;
}

/** Parses a user-typed decimal (accepts "," as decimal separator) into base units, or null if invalid. */
export function parseDecimal(input: string, decimals: number): bigint | null {
  const s = String(input || '').trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const [w, f = ''] = s.split('.');
  if (f.length > decimals) return null;
  return BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

export const PRICE_DECIMALS = 18;

/** Price of 1 sell token in buy tokens, as a plain decimal string. */
export function priceFromAmounts(sellAmount: bigint, sellDecimals: number, buyAmount: bigint, buyDecimals: number): string {
  if (sellAmount <= 0n) return '';
  const scaled = (buyAmount * 10n ** BigInt(sellDecimals) * 10n ** BigInt(PRICE_DECIMALS)) / (sellAmount * 10n ** BigInt(buyDecimals));
  return trimPrice(scaled);
}

function trimPrice(scaled: bigint): string {
  const s = formatTokenAmount(scaled, PRICE_DECIMALS, 8).replace(/,/g, '');
  return s;
}

/** Buy amount (base units) for a sell amount at a limit price (buy tokens per 1 sell token). */
export function buyAmountForPrice(sellAmount: bigint, sellDecimals: number, price: string, buyDecimals: number): bigint | null {
  const p = parseDecimal(price, PRICE_DECIMALS);
  if (p === null || p <= 0n) return null;
  return (sellAmount * p * 10n ** BigInt(buyDecimals)) / (10n ** BigInt(sellDecimals) * 10n ** BigInt(PRICE_DECIMALS));
}
