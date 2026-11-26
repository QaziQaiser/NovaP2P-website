// Wallet helpers for Limit mode. Uses the wallet already connected on the site (AppKit / WalletConnect
// or an injected wallet); nothing here changes how the Market swap connects.
import { BrowserProvider, Contract, MaxUint256, type JsonRpcSigner } from 'ethers';
import { getAppKit } from '../../../config/appkit';
import { getCowChain } from './cowApi';

/** The EIP-1193 provider of the connected EVM wallet. */
export function getEip1193Provider(): any | null {
  try {
    const kitProvider = (getAppKit() as any)?.getProvider?.('eip155');
    if (kitProvider) return kitProvider;
  } catch {}
  return typeof window !== 'undefined' ? (window as any).ethereum || null : null;
}

export async function getWalletChainId(): Promise<number | null> {
  const eth = getEip1193Provider();
  if (!eth) return null;
  try {
    const hex = await eth.request({ method: 'eth_chainId' });
    return Number(hex);
  } catch {
    return null;
  }
}

export async function switchWalletChain(chainId: number): Promise<void> {
  const eth = getEip1193Provider();
  if (!eth) throw new Error('No wallet connected.');
  const chain = getCowChain(chainId);
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] });
  } catch (err: any) {
    if (err?.code === 4902 && chain) {
      throw new Error(`Please add ${chain.name} to your wallet, then try again.`);
    }
    throw err;
  }
}

/** A fresh signer for `account`, checked to be on `chainId` (EIP-712 signatures are chain specific). */
export async function getLimitSigner(account: string, chainId: number): Promise<JsonRpcSigner> {
  const eth = getEip1193Provider();
  if (!eth) throw new Error('No wallet connected.');
  const current = await getWalletChainId();
  if (current !== chainId) {
    await switchWalletChain(chainId);
  }
  const provider = new BrowserProvider(eth, 'any');
  return provider.getSigner(account);
}

/** One-time approval so CoW's vault relayer can move the sell token when the order fills. */
export async function approveForCow(account: string, chainId: number, token: string, spender: string): Promise<void> {
  const signer = await getLimitSigner(account, chainId);
  const c = new Contract(token, ['function approve(address spender, uint256 amount) returns (bool)'], signer);
  const tx = await c.approve(spender, MaxUint256);
  await tx.wait(1);
}

export const isUserRejection = (err: any) =>
  err?.code === 4001 || err?.code === 'ACTION_REJECTED' || /reject|denied|cancel/i.test(String(err?.message || ''));
