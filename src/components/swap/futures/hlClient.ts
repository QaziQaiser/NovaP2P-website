// Hyperliquid connection for the Futures tab, built on the Hyperliquid TypeScript SDK (@nktkas/hyperliquid).
//
// Signing model (the same one Hyperliquid's own app uses):
//  - The user's wallet (the one connected in the swap, shared with Market / Cross Chain / Limit) signs the
//    account-level actions: "Enable trading" (approveAgent), "Approve builder fee" and withdrawals.
//    These are EIP-712 signatures on the wallet's current network, so no network switch is needed.
//  - Orders, cancels and leverage changes are signed by a Nova trading key (a Hyperliquid "API wallet")
//    kept in this browser. It can trade but can never withdraw or transfer funds. This is what makes
//    orders instant, with no wallet popup per trade.
import { ExchangeClient, HttpTransport, InfoClient, SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';
import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
import { BrowserProvider, Contract, getAddress, parseUnits } from 'ethers';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Client } from 'viem';
import { getLifiEvmWallet } from '../limit/lifiWalletBridge';
import { switchWalletChain, getWalletChainId } from '../limit/limitWallet';
import { HL_AGENT_NAME, HL_BUILDER, HL_BUILDER_FEE_PERCENT, HL_NETWORK } from '../../../config/hyperliquid';

const isTestnet = HL_NETWORK === 'Testnet';

export const httpTransport = new HttpTransport({ isTestnet });
export const info = new InfoClient({ transport: httpTransport });

let wsClient: SubscriptionClient | null = null;
/** One shared WebSocket for chart, order book and price updates (opened on first use). */
export function getSubscriptions(): SubscriptionClient {
  if (!wsClient) wsClient = new SubscriptionClient({ transport: new WebSocketTransport({ isTestnet }) });
  return wsClient;
}

// ---------------------------------------------------------------------------------------------
// Shared swap wallet
// ---------------------------------------------------------------------------------------------

async function getWalletClient(): Promise<Client> {
  const bridge = getLifiEvmWallet();
  if (!bridge) throw new Error('Wallet is still loading. Please try again in a moment.');
  try {
    return await bridge.getWalletClient();
  } catch {
    throw new Error('Wallet is reconnecting. Please try again in a moment.');
  }
}

/** Exchange client signed by the user's own wallet (used only for account-level actions). */
async function userExchange(account: string): Promise<ExchangeClient> {
  const client = await getWalletClient();
  const address = (client as any).account?.address as string | undefined;
  if (address && address.toLowerCase() !== account.toLowerCase()) {
    throw new Error('Your wallet account changed. Please try again.');
  }
  const provider = new BrowserProvider({ request: (args: any) => (client as any).request(args) });
  const signer = await provider.getSigner(address || account);
  return new ExchangeClient({
    transport: httpTransport,
    wallet: signer,
    // Sign on whatever network the wallet is on right now (wallets refuse other chain ids)
    signatureChainId: async () => {
      const id = Number(await (client as any).request({ method: 'eth_chainId' }));
      return `0x${id.toString(16)}` as `0x${string}`;
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Nova trading key (Hyperliquid API wallet)
// ---------------------------------------------------------------------------------------------

const AGENT_VALID_DAYS = 180;
const agentStorageKey = (user: string) => `nova_hl_agent_${HL_NETWORK}_${user.toLowerCase()}`;

interface StoredAgent {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  validUntil: number;
}

function readStoredAgent(user: string): StoredAgent | null {
  try {
    const raw = localStorage.getItem(agentStorageKey(user));
    if (!raw) return null;
    const a = JSON.parse(raw) as StoredAgent;
    if (!/^0x[0-9a-fA-F]{64}$/.test(a.privateKey) || a.validUntil < Date.now() + 60_000) return null;
    return a;
  } catch {
    return null;
  }
}

const agentClients = new Map<string, ExchangeClient>();

/** Exchange client signed by the stored trading key, or null if trading is not enabled in this browser. */
export function agentExchange(user: string): ExchangeClient | null {
  const stored = readStoredAgent(user);
  if (!stored) return null;
  let c = agentClients.get(stored.address);
  if (!c) {
    c = new ExchangeClient({ transport: httpTransport, wallet: privateKeyToAccount(stored.privateKey) });
    agentClients.set(stored.address, c);
  }
  return c;
}

/** True when this browser holds a trading key that Hyperliquid still lists as active for `user`. */
export async function isTradingEnabled(user: string): Promise<boolean> {
  const stored = readStoredAgent(user);
  if (!stored) return false;
  try {
    const agents = await info.extraAgents({ user: user as `0x${string}` });
    return agents.some(
      (a) => a.address.toLowerCase() === stored.address.toLowerCase() && (a.validUntil === null || a.validUntil > Date.now())
    );
  } catch {
    // Network hiccup: trust the stored key; the exchange rejects it if it is really gone
    return true;
  }
}

/** One wallet signature (no gas): authorizes a new Nova trading key for this browser. */
export async function enableTrading(user: string): Promise<void> {
  const privateKey = generatePrivateKey();
  const agent = privateKeyToAccount(privateKey);
  const validUntil = Date.now() + AGENT_VALID_DAYS * 86400_000;
  const ex = await userExchange(user);
  await ex.approveAgent({ agentAddress: agent.address, agentName: `${HL_AGENT_NAME} valid_until ${validUntil}` });
  localStorage.setItem(agentStorageKey(user), JSON.stringify({ privateKey, address: agent.address, validUntil } satisfies StoredAgent));
  agentClients.clear();
}

// ---------------------------------------------------------------------------------------------
// Builder fee (optional; see src/config/hyperliquid.ts)
// ---------------------------------------------------------------------------------------------

/** True when no builder is configured, or the user already approved at least the configured fee. */
export async function isBuilderFeeApproved(user: string): Promise<boolean> {
  if (!HL_BUILDER) return true;
  const max = await info.maxBuilderFee({ user: user as `0x${string}`, builder: HL_BUILDER.address });
  return Number(max) >= HL_BUILDER.fee;
}

/** One-time wallet signature (no gas) that lets Nova's builder address charge its fee on Futures orders. */
export async function approveBuilderFee(user: string): Promise<void> {
  if (!HL_BUILDER) return;
  const ex = await userExchange(user);
  await ex.approveBuilderFee({ builder: HL_BUILDER.address, maxFeeRate: HL_BUILDER_FEE_PERCENT });
}

/** Builder field for orders: only sent once the user approved it, so orders never fail on a missing approval. */
export const orderBuilder = (approved: boolean) =>
  HL_BUILDER && approved ? { builder: { b: HL_BUILDER.address, f: HL_BUILDER.fee } } : {};

// ---------------------------------------------------------------------------------------------
// Deposit / withdraw (USDC on Arbitrum, Hyperliquid's official bridge)
// ---------------------------------------------------------------------------------------------

export const ARBITRUM_CHAIN_ID = 42161;
export const ARBITRUM_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
// Hyperliquid Bridge2 on Arbitrum (mainnet), from docs: for-developers/api/bridge2. Checksummed with
// ethers.getAddress; the deposit code re-checks it so a typo can never send funds to a wrong address.
export const HL_BRIDGE = '0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7';
/** Hyperliquid's bridge ignores (and loses) deposits below 5 USDC. */
export const MIN_DEPOSIT_USDC = 5;
/** Hyperliquid charges 1 USDC per withdrawal. */
export const WITHDRAW_FEE_USDC = 1;

/** Sends USDC from the wallet on Arbitrum to the Hyperliquid bridge. Returns the transaction hash. */
export async function depositUsdc(user: string, amount: string): Promise<string> {
  if ((await getWalletChainId()) !== ARBITRUM_CHAIN_ID) await switchWalletChain(ARBITRUM_CHAIN_ID);
  const client = await getWalletClient();
  if (Number(await (client as any).request({ method: 'eth_chainId' })) !== ARBITRUM_CHAIN_ID) {
    throw new Error('Please switch your wallet to Arbitrum to deposit.');
  }
  const provider = new BrowserProvider({ request: (args: any) => (client as any).request(args) }, ARBITRUM_CHAIN_ID);
  const signer = await provider.getSigner(user);
  const usdc = new Contract(ARBITRUM_USDC, ['function transfer(address to, uint256 amount) returns (bool)'], signer);
  // getAddress throws on a bad checksum, so a mistyped bridge address can never receive funds
  const tx = await usdc.transfer(getAddress(HL_BRIDGE), parseUnits(amount, 6));
  await tx.wait(1);
  return tx.hash as string;
}

/** Withdraws USDC from Hyperliquid to the same wallet on Arbitrum (wallet signature, no gas). */
export async function withdrawUsdc(user: string, amount: string): Promise<void> {
  const ex = await userExchange(user);
  await ex.withdraw3({ destination: user as `0x${string}`, amount });
}

/** Moves USDC between the Hyperliquid spot and perps balances (wallet signature, no gas). */
export async function transferUsdc(user: string, amount: string, toPerp: boolean): Promise<void> {
  const ex = await userExchange(user);
  await ex.usdClassTransfer({ amount, toPerp });
}

// ---------------------------------------------------------------------------------------------
// Number formatting for orders
// ---------------------------------------------------------------------------------------------

/** Price rounded to what Hyperliquid accepts for this perp (5 significant figures, decimal limit). */
export function toOrderPrice(price: number, szDecimals: number): string {
  return formatPrice(price.toFixed(12), szDecimals, 'perp');
}

/** Size rounded down to the coin's size decimals; null when it rounds to zero. */
export function toOrderSize(size: number, szDecimals: number): string | null {
  try {
    const s = formatSize(size.toFixed(12), szDecimals);
    return Number(s) > 0 ? s : null;
  } catch {
    return null;
  }
}

/** Plain-language message from an SDK / API error. */
export function hlErrorMessage(err: any): string {
  const raw = String(err?.shortMessage || err?.message || err || 'Something went wrong');
  if (/API Wallet .* does not exist/i.test(raw)) return 'Your trading key has expired or was removed. Please click "Enable Trading" again.';
  if (/does not exist|must deposit/i.test(raw)) return 'Deposit USDC to your Hyperliquid account first.';
  if (/insufficient margin/i.test(raw)) return 'Not enough available margin for this order.';
  if (/minimum value of \$?10/i.test(raw)) return 'Orders must be worth at least $10.';
  if (/builder fee has not been approved/i.test(raw)) return 'Please approve the builder fee first.';
  if (/could not immediately match/i.test(raw)) return 'No liquidity at an acceptable price right now. Please try again.';
  return raw.replace(/^.*?Error:\s*/, '');
}

export const isUserRejection = (err: any) =>
  err?.code === 4001 ||
  err?.code === 'ACTION_REJECTED' ||
  err?.cause?.code === 4001 ||
  /user rejected|user denied|rejected the request|cancelled|canceled by user/i.test(String(err?.shortMessage || err?.message || ''));
