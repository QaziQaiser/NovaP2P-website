// CoW Protocol limit orders (Limit mode only). Completely separate from the LI.FI Market swap.
// Orders are signed off-chain by the user's wallet (EIP-712, no gas) and stay in the user's wallet
// until a solver fills them at the limit price or better. Cancelling is a free signed message.
import { keccak256, toUtf8Bytes, type TypedDataDomain, type TypedDataField } from 'ethers';

export interface CowChain {
  id: number;
  name: string;
  apiNetwork: string;
  rpcUrl: string;
  explorer: string;
  wrappedNative: string; // CoW cannot sell native coins; users sell the wrapped version
}

export const COW_CHAINS: CowChain[] = [
  { id: 1, name: 'Ethereum', apiNetwork: 'mainnet', rpcUrl: 'https://ethereum-rpc.publicnode.com', explorer: 'https://explorer.cow.fi', wrappedNative: 'WETH' },
  { id: 42161, name: 'Arbitrum', apiNetwork: 'arbitrum_one', rpcUrl: 'https://arbitrum-one-rpc.publicnode.com', explorer: 'https://explorer.cow.fi/arb1', wrappedNative: 'WETH' },
  { id: 8453, name: 'Base', apiNetwork: 'base', rpcUrl: 'https://base-rpc.publicnode.com', explorer: 'https://explorer.cow.fi/base', wrappedNative: 'WETH' },
  { id: 56, name: 'BNB Chain', apiNetwork: 'bnb', rpcUrl: 'https://bsc-rpc.publicnode.com', explorer: 'https://explorer.cow.fi/bnb', wrappedNative: 'WBNB' },
  { id: 137, name: 'Polygon', apiNetwork: 'polygon', rpcUrl: 'https://polygon-bor-rpc.publicnode.com', explorer: 'https://explorer.cow.fi/pol', wrappedNative: 'WPOL' },
  { id: 100, name: 'Gnosis', apiNetwork: 'xdai', rpcUrl: 'https://gnosis-rpc.publicnode.com', explorer: 'https://explorer.cow.fi/gc', wrappedNative: 'WXDAI' },
  { id: 43114, name: 'Avalanche', apiNetwork: 'avalanche', rpcUrl: 'https://avalanche-c-chain-rpc.publicnode.com', explorer: 'https://explorer.cow.fi/avax', wrappedNative: 'WAVAX' },
];

export const getCowChain = (chainId: number) => COW_CHAINS.find((c) => c.id === chainId);

/** GPv2Settlement (EIP-712 verifying contract) and GPv2VaultRelayer (token spender); same address on every chain. */
export const COW_SETTLEMENT = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41';
export const COW_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110';

// App data identifies orders placed from Nova Swap. The orderbook accepts the full JSON and hashes it.
export const NOVA_APP_DATA = JSON.stringify({ appCode: 'NovaSwap', metadata: {}, version: '1.3.0' });
export const NOVA_APP_DATA_HASH = keccak256(toUtf8Bytes(NOVA_APP_DATA));

const apiBase = (chainId: number) => {
  const chain = getCowChain(chainId);
  if (!chain) throw new Error('Limit orders are not available on this network.');
  return `https://api.cow.fi/${chain.apiNetwork}/api/v1`;
};

export const cowDomain = (chainId: number): TypedDataDomain => ({
  name: 'Gnosis Protocol',
  version: 'v2',
  chainId,
  verifyingContract: COW_SETTLEMENT,
});

export const ORDER_TYPES: Record<string, TypedDataField[]> = {
  Order: [
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'validTo', type: 'uint32' },
    { name: 'appData', type: 'bytes32' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'kind', type: 'string' },
    { name: 'partiallyFillable', type: 'bool' },
    { name: 'sellTokenBalance', type: 'string' },
    { name: 'buyTokenBalance', type: 'string' },
  ],
};

export const CANCELLATION_TYPES: Record<string, TypedDataField[]> = {
  OrderCancellations: [{ name: 'orderUids', type: 'bytes[]' }],
};

export interface TypedDataSigner {
  signTypedData: (domain: TypedDataDomain, types: Record<string, TypedDataField[]>, value: Record<string, any>) => Promise<string>;
}

export type CowOrderStatus = 'presignaturePending' | 'open' | 'fulfilled' | 'cancelled' | 'expired';

export interface CowOrder {
  uid: string;
  owner: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  creationDate: string;
  status: CowOrderStatus;
  executedSellAmount: string;
  executedBuyAmount: string;
  appData?: string;
  fullAppData?: string | null;
  partiallyFillable: boolean;
  kind: 'sell' | 'buy';
}

async function cowFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 429) throw new CowApiError('Too many requests. Please wait a few seconds and try again.', '429');
    throw new CowApiError(friendlyCowError(data), data?.errorType || String(res.status));
  }
  return data as T;
}

export class CowApiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

function friendlyCowError(data: any): string {
  const type = data?.errorType || '';
  const map: Record<string, string> = {
    InsufficientBalance: 'Your wallet does not hold enough of the token you are selling.',
    InsufficientAllowance: 'Please approve the token first.',
    NoLiquidity: 'No market found for this token pair on this network.',
    UnsupportedToken: 'This token is not supported for limit orders.',
    SameBuyAndSellToken: 'Choose two different tokens.',
    SellAmountDoesNotCoverFee: 'The amount is too small to cover network costs. Try a larger amount.',
    ExcessiveValidTo: 'The expiry is too far in the future. Choose a shorter expiry.',
    InsufficientValidTo: 'The expiry is too short. Choose a longer expiry.',
    InvalidSignature: 'The wallet signature was not valid. Please try again.',
    ZeroAmount: 'Enter an amount greater than zero.',
    TooManyLimitOrders: 'You have too many open limit orders. Cancel some first.',
    OrderNotFound: 'Order not found.',
    AlreadyCancelled: 'This order is already cancelled.',
    OrderFullyExecuted: 'This order has already been filled.',
    OrderExpired: 'This order has already expired.',
  };
  return map[type] || data?.description || (typeof data === 'string' && data) || 'Request failed. Please try again.';
}

/** Current market rate for `sellAmount` (base units) of sellToken. Returns buy amount the market gives today. */
export async function getCowQuote(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  from?: string | null;
}): Promise<{ buyAmount: bigint; sellAmount: bigint; feeAmount: bigint }> {
  const data = await cowFetch<any>(`${apiBase(params.chainId)}/quote`, {
    method: 'POST',
    body: JSON.stringify({
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      from: params.from || '0x0000000000000000000000000000000000000000',
      kind: 'sell',
      sellAmountBeforeFee: params.sellAmount,
      appData: NOVA_APP_DATA,
      validFor: 600,
      priceQuality: 'fast',
      signingScheme: 'eip712',
    }),
  });
  return {
    buyAmount: BigInt(data.quote.buyAmount),
    sellAmount: BigInt(data.quote.sellAmount),
    feeAmount: BigInt(data.quote.feeAmount || 0),
  };
}

/** Signs a sell limit order with the user's wallet and submits it. Returns the order UID. */
export async function placeCowLimitOrder(params: {
  chainId: number;
  signer: TypedDataSigner;
  owner: string;
  sellToken: string;
  buyToken: string;
  sellAmount: bigint;
  buyAmount: bigint;
  validTo: number;
}): Promise<string> {
  if (params.sellAmount <= 0n || params.buyAmount <= 0n) throw new Error('Enter an amount and a limit price greater than zero.');
  const order = {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    receiver: params.owner,
    sellAmount: params.sellAmount.toString(),
    buyAmount: params.buyAmount.toString(),
    validTo: params.validTo,
    appData: NOVA_APP_DATA_HASH,
    feeAmount: '0', // limit orders: solvers take fees from surplus
    kind: 'sell',
    partiallyFillable: false,
    sellTokenBalance: 'erc20',
    buyTokenBalance: 'erc20',
  };
  const signature = await params.signer.signTypedData(cowDomain(params.chainId), ORDER_TYPES, order);
  return cowFetch<string>(`${apiBase(params.chainId)}/orders`, {
    method: 'POST',
    body: JSON.stringify({
      ...order,
      appData: NOVA_APP_DATA,
      appDataHash: NOVA_APP_DATA_HASH,
      signingScheme: 'eip712',
      signature,
      from: params.owner,
    }),
  });
}

/** Free, gasless cancellation signed by the order owner. */
export async function cancelCowOrders(params: { chainId: number; signer: TypedDataSigner; orderUids: string[] }): Promise<void> {
  const signature = await params.signer.signTypedData(cowDomain(params.chainId), CANCELLATION_TYPES, {
    orderUids: params.orderUids,
  });
  await cowFetch<any>(`${apiBase(params.chainId)}/orders`, {
    method: 'DELETE',
    body: JSON.stringify({ orderUids: params.orderUids, signature, signingScheme: 'eip712' }),
  });
}

/** The wallet's recent orders on one chain, limited to orders placed from Nova Swap. */
export async function getCowAccountOrders(chainId: number, owner: string, limit = 50): Promise<CowOrder[]> {
  const orders = await cowFetch<CowOrder[]>(`${apiBase(chainId)}/account/${owner}/orders?offset=0&limit=${limit}`);
  return (orders || []).filter(
    (o) => (o.appData || '').toLowerCase() === NOVA_APP_DATA_HASH.toLowerCase() || o.fullAppData === NOVA_APP_DATA
  );
}

export const orderExplorerUrl = (chainId: number, uid: string) => {
  const chain = getCowChain(chainId);
  return `${chain?.explorer || 'https://explorer.cow.fi'}/orders/${uid}`;
};
