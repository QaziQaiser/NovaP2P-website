import { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { ethers } from 'ethers';
import bs58 from 'bs58';

// ---------------------------------------------------------------------------
// ADMIN AUTHENTICATION
// ---------------------------------------------------------------------------

// No hard-coded fallback: admin routes stay locked until SWAP_ADMIN_KEY is configured.
export const ADMIN_KEY = (process.env.SWAP_ADMIN_KEY || '').trim();

if (!ADMIN_KEY) {
  console.warn('[Nova Server] SWAP_ADMIN_KEY is not set. Admin endpoints and email review links are disabled until it is configured.');
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function isValidAdminKey(candidate: unknown): boolean {
  if (!ADMIN_KEY || typeof candidate !== 'string' || !candidate) return false;
  return safeEqual(candidate, ADMIN_KEY);
}

export function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: 'Admin access is disabled: SWAP_ADMIN_KEY is not configured on the server.' });
  }
  const authHeader = req.headers['x-admin-key'] || req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!isValidAdminKey(token)) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  next();
}

// ---------------------------------------------------------------------------
// SIGNED EMAIL REVIEW LINKS (expiring HMAC tokens)
// ---------------------------------------------------------------------------

const REVIEW_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function reviewSecret(): string {
  return crypto.createHash('sha256').update(`nova-review-links:${ADMIN_KEY}`).digest('hex');
}

export function signReviewToken(appId: string, issuedAt: number = Date.now()): string {
  if (!ADMIN_KEY) return '';
  const exp = issuedAt + REVIEW_TOKEN_TTL_MS;
  const mac = crypto.createHmac('sha256', reviewSecret()).update(`review:${appId}:${exp}`).digest('hex');
  return `${exp}.${mac}`;
}

export function verifyReviewToken(appId: string, token: string): boolean {
  if (!ADMIN_KEY || !appId || !token) return false;
  const [expStr, mac] = String(token).trim().split('.');
  const exp = Number(expStr);
  if (!exp || !mac || Date.now() > exp) return false;
  const expected = crypto.createHmac('sha256', reviewSecret()).update(`review:${appId}:${exp}`).digest('hex');
  return safeEqual(mac, expected);
}

// ---------------------------------------------------------------------------
// WALLET ADDRESS HELPERS
// ---------------------------------------------------------------------------

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export type WalletKind = 'evm' | 'solana' | 'tron';

export function getWalletKind(address: unknown): WalletKind | null {
  if (typeof address !== 'string') return null;
  const a = address.trim();
  if (EVM_ADDRESS.test(a)) return 'evm';
  if (TRON_ADDRESS.test(a)) return 'tron';
  if (SOLANA_ADDRESS.test(a)) return 'solana';
  return null;
}

export function isValidWalletAddress(address: unknown): boolean {
  return getWalletKind(address) !== null;
}

// ---------------------------------------------------------------------------
// WALLET SIGNATURE CHALLENGES (gasless proof of wallet ownership)
// ---------------------------------------------------------------------------

export type SignaturePurpose = 'verify_wallet' | 'reward_claim' | 'affiliate_apply' | 'affiliate_payout';

const PURPOSE_TITLES: Record<SignaturePurpose, string> = {
  verify_wallet: 'Verify wallet ownership for Nova Swap Genesis Campaign',
  reward_claim: 'Confirm Nova Swap Genesis reward claim',
  affiliate_apply: 'Confirm Nova Swap affiliate application',
  affiliate_payout: 'Confirm Nova Swap affiliate payout request',
};

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

interface Challenge {
  address: string;
  purpose: SignaturePurpose;
  message: string;
  expiresAt: number;
}

const challenges = new Map<string, Challenge>();

function challengeKey(address: string, purpose: SignaturePurpose) {
  return `${purpose}:${address.toLowerCase()}`;
}

function pruneChallenges() {
  const now = Date.now();
  for (const [key, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(key);
  }
}

export function isSignaturePurpose(value: unknown): value is SignaturePurpose {
  return typeof value === 'string' && value in PURPOSE_TITLES;
}

/** Issues a fresh one-time message for the wallet to sign. Only the latest challenge per wallet+purpose is valid. */
export function issueChallenge(address: string, purpose: SignaturePurpose): { nonce: string; message: string } {
  pruneChallenges();
  const cleanAddress = address.trim();
  const nonce = crypto.randomBytes(16).toString('hex');
  const displayAddress = cleanAddress.startsWith('0x') ? cleanAddress.toLowerCase() : cleanAddress;
  const message = [
    `${PURPOSE_TITLES[purpose]}.`,
    '',
    'This signature is free and does not send a transaction.',
    '',
    `Wallet: ${displayAddress}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');
  challenges.set(challengeKey(cleanAddress, purpose), {
    address: cleanAddress,
    purpose,
    message,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
  return { nonce, message };
}

function verifySolanaSignature(address: string, message: string, signature: string): boolean {
  try {
    const pubKey = Buffer.from(bs58.decode(address));
    if (pubKey.length !== 32) return false;
    const sigBytes = /^(0x)?[0-9a-fA-F]{128}$/.test(signature)
      ? Buffer.from(signature.replace(/^0x/, ''), 'hex')
      : Buffer.from(bs58.decode(signature));
    if (sigBytes.length !== 64) return false;
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pubKey]);
    const keyObject = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message, 'utf8'), keyObject, sigBytes);
  } catch {
    return false;
  }
}

/**
 * Validates and consumes a signed challenge. Returns null on success or an error message.
 * The wallet must sign exactly the message issued by the server for this purpose.
 */
export function consumeSignedChallenge(params: {
  address: string;
  purpose: SignaturePurpose;
  message: unknown;
  signature: unknown;
}): string | null {
  const { purpose } = params;
  const address = String(params.address || '').trim();
  const message = typeof params.message === 'string' ? params.message : '';
  const signature = typeof params.signature === 'string' ? params.signature.trim() : '';

  if (!address || !message || !signature) {
    return 'Wallet signature is required. Please approve the signature request in your wallet.';
  }

  const key = challengeKey(address, purpose);
  const challenge = challenges.get(key);
  if (!challenge || challenge.expiresAt < Date.now()) {
    challenges.delete(key);
    return 'Signature request expired. Please try again.';
  }
  if (challenge.message !== message) {
    return 'Signed message does not match the server request. Please try again.';
  }

  const kind = getWalletKind(challenge.address);
  let valid = false;
  if (kind === 'evm') {
    try {
      valid = ethers.verifyMessage(message, signature).toLowerCase() === challenge.address.toLowerCase();
    } catch {
      valid = false;
    }
  } else if (kind === 'solana') {
    valid = verifySolanaSignature(challenge.address, message, signature);
  } else {
    return 'Signature verification is supported for EVM and Solana wallets only.';
  }

  if (!valid) {
    return 'Signature verification failed: the signature does not belong to this wallet.';
  }

  challenges.delete(key);
  return null;
}

// ---------------------------------------------------------------------------
// SIMPLE IN-MEMORY RATE LIMITER
// ---------------------------------------------------------------------------

export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      lastSweep = now;
    }
    const key = `${req.ip || 'unknown'}:${req.baseUrl}${req.path}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    next();
  };
}

/** Logs the real error server-side and returns a generic message to the client. */
export function sendServerError(res: Response, err: unknown, context: string) {
  console.error(`[Nova API] ${context}:`, err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
}
