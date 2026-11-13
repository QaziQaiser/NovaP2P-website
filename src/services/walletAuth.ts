import type { MessageSigner } from '../context/WalletContext';

export type SignaturePurpose = 'reward_claim' | 'affiliate_apply' | 'affiliate_payout';

export interface SignedWalletProof {
  signature: string;
  message: string;
  signerAddress: string;
}

/**
 * Proves wallet ownership for a protected action: fetches a one-time message from the server,
 * asks the connected wallet to sign it (free, no gas) and returns the proof to send with the request.
 */
export async function signWalletChallenge(
  getMessageSigner: (expectedAddress?: string | null) => Promise<MessageSigner>,
  walletAddress: string,
  purpose: SignaturePurpose
): Promise<SignedWalletProof> {
  const signer = await getMessageSigner(walletAddress);

  const res = await fetch(
    `/api/swap/auth/challenge?address=${encodeURIComponent(signer.address)}&purpose=${encodeURIComponent(purpose)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.message) {
    throw new Error(data?.error || 'Could not start wallet verification. Please try again.');
  }

  const signature = await signer.sign(data.message);
  return { signature, message: data.message, signerAddress: signer.address };
}
