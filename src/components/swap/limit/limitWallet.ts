// Wallet helpers for Limit mode. They use the wallet connected in the Market swap (LI.FI widget), shared
// through lifiWalletBridge, so both tabs always use one wallet session. Nothing here changes the Market swap.
import { BrowserProvider, Contract, MaxUint256, type JsonRpcSigner } from 'ethers';
import type { Client } from 'viem';
import { getLifiEvmWallet } from './lifiWalletBridge';
import { getCowChain } from './cowApi';

class WalletNotReadyError extends Error {}

/** The widget's connected wallet client (throws a friendly error while it is still reconnecting). */
async function getClient(): Promise<Client> {
  const bridge = getLifiEvmWallet();
  if (!bridge) throw new WalletNotReadyError('Wallet is still loading. Please try again in a moment.');
  try {
    return await bridge.getWalletClient();
  } catch {
    throw new WalletNotReadyError('Wallet is reconnecting. Please try again in a moment.');
  }
}

/** EIP-1193 view of the widget's wallet client, for ethers. */
const toEip1193 = (client: Client) => ({
  request: (args: { method: string; params?: unknown }) => (client as any).request(args),
});

/** Address of the wallet connected in the swap widget, or null. */
export async function getWalletAddress(): Promise<string | null> {
  try {
    const client = await getClient();
    const addr = (client as any).account?.address;
    return typeof addr === 'string' ? addr : null;
  } catch {
    return null;
  }
}

export async function getWalletChainId(): Promise<number | null> {
  try {
    const client = await getClient();
    const hex = await (client as any).request({ method: 'eth_chainId' });
    return Number(hex);
  } catch {
    return null;
  }
}

const SWITCH_POLL_MS = 300;
const SWITCH_TIMEOUT_MS = 45000;

/**
 * Switches the shared wallet's network (the wallet asks the user; adds the network if it is missing).
 * Resolves as soon as the wallet reports the new network: some wallets (often mobile / WalletConnect)
 * change network but answer the switch request late or never, which used to leave the UI spinning.
 */
export async function switchWalletChain(chainId: number): Promise<void> {
  const bridge = getLifiEvmWallet();
  if (!bridge) throw new WalletNotReadyError('Wallet is still loading. Please try again in a moment.');
  if ((await getWalletChainId()) === chainId) return;
  const name = getCowChain(chainId)?.name || 'this network';

  let finished = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  const request = bridge.switchChain(chainId).then(
    () => undefined,
    (err: any) => {
      if (isUserRejection(err)) throw err;
      throw new Error(`Could not switch your wallet to ${name}. Please switch it in your wallet and try again.`);
    }
  );
  request.catch(() => {}); // a late answer after the network already changed is ignored

  const changed = new Promise<void>((resolve) => {
    const tick = async () => {
      if (finished) return;
      if ((await getWalletChainId()) === chainId) return resolve();
      pollTimer = setTimeout(tick, SWITCH_POLL_MS);
    };
    pollTimer = setTimeout(tick, SWITCH_POLL_MS);
  });

  const timeout = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(
      () => reject(new Error(`Your wallet did not switch to ${name}. Please switch it in your wallet and try again.`)),
      SWITCH_TIMEOUT_MS
    );
  });

  try {
    await Promise.race([request, changed, timeout]);
  } finally {
    finished = true;
    clearTimeout(pollTimer);
    clearTimeout(timeoutTimer);
  }
}

/** A fresh signer for `account`, checked to be on `chainId` (EIP-712 signatures are chain specific). */
export async function getLimitSigner(account: string, chainId: number): Promise<JsonRpcSigner> {
  if ((await getWalletChainId()) !== chainId) {
    await switchWalletChain(chainId);
  }
  const client = await getClient();
  const current = Number(await (client as any).request({ method: 'eth_chainId' }));
  if (current !== chainId) {
    throw new Error(`Please switch your wallet to ${getCowChain(chainId)?.name || 'the selected network'}.`);
  }
  const address = (client as any).account?.address as string | undefined;
  if (address && address.toLowerCase() !== account.toLowerCase()) {
    throw new Error('Your wallet account changed. Please try again.');
  }
  const provider = new BrowserProvider(toEip1193(client), chainId);
  return provider.getSigner(address || account);
}

/** One-time approval so CoW's vault relayer can move the sell token when the order fills. */
export async function approveForCow(account: string, chainId: number, token: string, spender: string): Promise<void> {
  const signer = await getLimitSigner(account, chainId);
  const c = new Contract(token, ['function approve(address spender, uint256 amount) returns (bool)'], signer);
  const tx = await c.approve(spender, MaxUint256);
  await tx.wait(1);
}

export const isUserRejection = (err: any) =>
  err?.code === 4001 ||
  err?.code === 'ACTION_REJECTED' ||
  err?.name === 'UserRejectedRequestError' ||
  err?.cause?.code === 4001 ||
  /reject|denied|cancel/i.test(String(err?.shortMessage || err?.message || ''));
