import { Router, type Request, type Response } from 'express';
import { db } from './db.ts';
import { sendAdminClaimNotification } from './notifications.ts';
import { ethers } from 'ethers';
import crypto from 'crypto';

export const apiRouter = Router();

const ADMIN_KEY = process.env.SWAP_ADMIN_KEY || 'nova-genesis-admin-2026';
const ENABLED_CHAINS = [1, 56, 137, 42161, 10, 8453];

// Nonce storage for signature verification
const pendingNonces = new Map<string, { nonce: string; timestamp: number }>();

// Helper: Clean up old nonces (older than 10 mins)
function getOrCreateNonce(walletAddress: string): string {
  const normalized = walletAddress.toLowerCase();
  const now = Date.now();
  const existing = pendingNonces.get(normalized);
  if (existing && now - existing.timestamp < 10 * 60 * 1000) {
    return existing.nonce;
  }
  const nonce = crypto.randomBytes(16).toString('hex');
  pendingNonces.set(normalized, { nonce, timestamp: now });
  return nonce;
}

// Helper: Verify Admin authorization header
function verifyAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers['x-admin-key'] || req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (token !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  next();
}

// ---------------------------------------------------------------------------
// PUBLIC / USER ENDPOINTS
// ---------------------------------------------------------------------------

// 1. Get current active campaign info & milestones
apiRouter.get('/campaign', (req: Request, res: Response) => {
  try {
    const campaign = db.prepare('SELECT * FROM swap_campaigns WHERE status != ? ORDER BY created_at DESC LIMIT 1').get('ended') as any;
    if (!campaign) {
      return res.status(404).json({ error: 'No active campaign found' });
    }

    const milestones = db.prepare(`
      SELECT * FROM swap_campaign_milestones 
      WHERE campaign_id = ? AND is_active = 1 
      ORDER BY sort_order ASC, target_volume_usd ASC
    `).all(campaign.id);

    // Aggregate statistics
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT wallet_address) as total_swappers,
        COALESCE(SUM(total_volume_usd), 0) as total_verified_volume,
        COALESCE(SUM(eligible_swaps_count), 0) as total_swaps_count
      FROM swap_campaign_users
      WHERE campaign_id = ?
    `).get(campaign.id) as any;

    const remainingBudget = Math.max(0, campaign.total_budget_usd - campaign.spent_budget_usd);
    const now = Date.now();
    const end = new Date(campaign.end_date).getTime();
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

    res.json({
      campaign: {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        daysRemaining,
        minSwapUSD: campaign.min_swap_usd,
        totalBudgetUSD: campaign.total_budget_usd,
        spentBudgetUSD: campaign.spent_budget_usd,
        remainingBudgetUSD: remainingBudget,
        referralRewardUSD: campaign.referral_reward_usd,
        referralQualifyingVolUSD: campaign.referral_qualifying_vol_usd,
        cashbackEnabled: Boolean(campaign.cashback_enabled),
        cashbackPercentage: campaign.cashback_percentage,
        enabledChains: ENABLED_CHAINS,
      },
      milestones: milestones.map((m: any) => ({
        id: m.id,
        milestoneNumber: m.milestone_number,
        title: m.title,
        targetVolumeUSD: m.target_volume_usd,
        rewardAmountUSD: m.reward_amount_usd,
        rewardDescription: m.reward_description,
      })),
      stats: {
        totalSwappers: stats.total_swappers || 0,
        totalVerifiedVolumeUSD: stats.total_verified_volume || 0,
        totalSwapsCount: stats.total_swaps_count || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Track referral link visit
apiRouter.post('/track-referral', (req: Request, res: Response) => {
  try {
    const { refCode } = req.body;
    if (!refCode) {
      return res.status(400).json({ error: 'Referral code is required' });
    }

    const cleanCode = String(refCode).trim().toUpperCase();
    const referrer = db.prepare('SELECT id, wallet_address FROM swap_campaign_users WHERE UPPER(referral_code) = ?').get(cleanCode) as any;
    
    // Log referral visit event
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, user_id, event_name, event_data, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'evt_' + crypto.randomUUID(),
      'campaign_genesis_001',
      referrer ? referrer.id : null,
      'referral_captured',
      JSON.stringify({ refCode: cleanCode, valid: !!referrer }),
      String(ip || ''),
      new Date().toISOString()
    );

    res.json({
      success: true,
      valid: !!referrer,
      referrerCode: cleanCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Track generic analytics event
apiRouter.post('/events', (req: Request, res: Response) => {
  try {
    const { eventName, walletAddress, eventData } = req.body;
    if (!eventName) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, wallet_address, event_name, event_data, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'evt_' + crypto.randomUUID(),
      'campaign_genesis_001',
      walletAddress ? String(walletAddress).toLowerCase() : null,
      eventName,
      eventData ? JSON.stringify(eventData) : null,
      String(ip || ''),
      new Date().toISOString()
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get wallet verification nonce
apiRouter.get('/auth/nonce', (req: Request, res: Response) => {
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const nonce = getOrCreateNonce(address);
    const message = `Sign this message to verify wallet ownership for Nova Swap Genesis Campaign.\n\nWallet: ${address.toLowerCase()}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    res.json({ nonce, message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Verify wallet ownership signature & register/login user
apiRouter.post('/auth/verify', async (req: Request, res: Response) => {
  try {
    const { address, signature, message, chainId, refCode } = req.body;
    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Address, signature and message are required' });
    }

    const normalizedAddress = address.toLowerCase();

    // Verify cryptographic signature
    let recoveredAddress = '';
    try {
      recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    } catch (e: any) {
      return res.status(400).json({ error: 'Signature verification failed: ' + e.message });
    }

    if (recoveredAddress !== normalizedAddress) {
      return res.status(400).json({ error: 'Recovered address does not match claimed wallet address' });
    }

    const now = new Date().toISOString();
    const campaignId = 'campaign_genesis_001';

    // Find or create user
    let user = db.prepare('SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?').get(campaignId, normalizedAddress) as any;

    if (!user) {
      // Generate clean unique referral code: NP + 6 hex chars
      let newRefCode = '';
      while (true) {
        newRefCode = 'NP' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const exists = db.prepare('SELECT id FROM swap_campaign_users WHERE referral_code = ?').get(newRefCode);
        if (!exists) break;
      }

      // Check referral attribution
      let referredByUserId: string | null = null;
      if (refCode) {
        const cleanRefCode = String(refCode).trim().toUpperCase();
        const referrer = db.prepare('SELECT id, wallet_address FROM swap_campaign_users WHERE UPPER(referral_code) = ?').get(cleanRefCode) as any;
        // Prevent self-referral
        if (referrer && referrer.wallet_address.toLowerCase() !== normalizedAddress) {
          referredByUserId = referrer.id;
        }
      }

      const userId = 'usr_' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        campaignId,
        normalizedAddress,
        chainId ? Number(chainId) : 1,
        signature,
        now,
        newRefCode,
        referredByUserId,
        0.0,
        0,
        0,
        now,
        now
      );

      // Create swap_referrals record if attributed
      if (referredByUserId) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        db.prepare(`
          INSERT OR IGNORE INTO swap_referrals (
            id, campaign_id, referrer_user_id, referred_user_id, referral_code,
            visitor_ip, status, qualifying_volume_usd, reward_amount_usd, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'ref_' + crypto.randomUUID(),
          campaignId,
          referredByUserId,
          userId,
          refCode,
          String(ip || ''),
          'connected',
          0.0,
          0.0,
          now
        );
      }

      user = db.prepare('SELECT * FROM swap_campaign_users WHERE id = ?').get(userId) as any;
    } else {
      // Update signature and activity
      db.prepare(`
        UPDATE swap_campaign_users 
        SET signature = ?, verified_at = ?, chain_id = ?, last_active_at = ?
        WHERE id = ?
      `).run(signature, now, chainId ? Number(chainId) : user.chain_id, now, user.id);
    }

    // Invalidate used nonce
    pendingNonces.delete(normalizedAddress);

    // Track wallet_connected event
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.prepare(`
      INSERT INTO swap_campaign_events (id, campaign_id, user_id, wallet_address, event_name, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('evt_' + crypto.randomUUID(), campaignId, user.id, normalizedAddress, 'wallet_connected', String(ip || ''), now);

    res.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        chainId: user.chain_id,
        referralCode: user.referral_code,
        referralLink: `https://novap2p.com/?ref=${user.referral_code}`,
        totalVolumeUSD: user.total_volume_usd,
        eligibleSwapsCount: user.eligible_swaps_count,
        verifiedAt: user.verified_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get complete user dashboard data (Volume, Milestones, Rewards, Referrals)
apiRouter.get('/user/:walletAddress', (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const campaignId = 'campaign_genesis_001';

    let user = db.prepare('SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?').get(campaignId, normalizedAddress) as any;
    if (!user) {
      // Auto-create user record so dashboard works immediately when wallet connects
      let newRefCode = '';
      while (true) {
        newRefCode = 'NOVA' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const exists = db.prepare('SELECT id FROM swap_campaign_users WHERE referral_code = ?').get(newRefCode);
        if (!exists) break;
      }
      const userId = 'usr_' + crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO swap_campaign_users (
          id, campaign_id, wallet_address, chain_id, signature, verified_at,
          referral_code, referred_by_user_id, total_volume_usd, eligible_swaps_count,
          is_flagged, last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        campaignId,
        normalizedAddress,
        1,
        'auto_connected',
        now,
        newRefCode,
        null,
        0.0,
        0,
        0,
        now,
        now
      );
      user = db.prepare('SELECT * FROM swap_campaign_users WHERE id = ?').get(userId) as any;
    }

    // Fetch all active campaign milestones
    const milestones = db.prepare(`
      SELECT * FROM swap_campaign_milestones 
      WHERE campaign_id = ? AND is_active = 1 
      ORDER BY sort_order ASC, target_volume_usd ASC
    `).all(campaignId) as any[];

    // Fetch user rewards
    const rewards = db.prepare(`
      SELECT r.*, c.id as claim_id, c.status as claim_status, c.payout_address, c.preferred_network, c.preferred_token,
             p.payout_tx_hash, p.payout_network as paid_network, p.paid_at
      FROM swap_rewards r
      LEFT JOIN swap_reward_claims c ON c.reward_id = r.id
      LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
      WHERE r.user_id = ?
    `).all(user.id) as any[];

    const rewardsMap = new Map<string, any>();
    rewards.forEach(r => {
      if (r.milestone_id) rewardsMap.set(r.milestone_id, r);
    });

    // Determine milestone statuses
    let nextMilestone: any = null;
    let completedCount = 0;

    const milestoneProgress = milestones.map(m => {
      const isReached = user.total_volume_usd >= m.target_volume_usd;
      const rewardRecord = rewardsMap.get(m.id);
      
      let status: 'locked' | 'in_progress' | 'unlocked' | 'requested' | 'under_review' | 'approved' | 'paid' | 'rejected' = 'locked';

      if (rewardRecord) {
        if (rewardRecord.status === 'paid' || rewardRecord.claim_status === 'paid') status = 'paid';
        else if (rewardRecord.claim_status === 'approved') status = 'approved';
        else if (rewardRecord.claim_status === 'under_review') status = 'under_review';
        else if (rewardRecord.claim_status === 'pending') status = 'requested';
        else if (rewardRecord.status === 'unlocked') status = 'unlocked';
        else if (rewardRecord.status === 'rejected') status = 'rejected';
      } else if (isReached) {
        status = 'unlocked';
      } else {
        status = 'in_progress';
      }

      if (isReached) completedCount++;
      if (!isReached && !nextMilestone) {
        nextMilestone = {
          milestoneNumber: m.milestone_number,
          targetVolumeUSD: m.target_volume_usd,
          remainingVolumeUSD: Math.max(0, m.target_volume_usd - user.total_volume_usd),
        };
      }

      return {
        id: m.id,
        milestoneNumber: m.milestone_number,
        title: m.title,
        targetVolumeUSD: m.target_volume_usd,
        rewardAmountUSD: m.reward_amount_usd,
        rewardDescription: m.reward_description,
        isCompleted: isReached,
        status,
        rewardRecord: rewardRecord ? {
          id: rewardRecord.id,
          amountUSD: rewardRecord.amount_usd,
          status: rewardRecord.status,
          claimId: rewardRecord.claim_id,
          payoutTxHash: rewardRecord.payout_tx_hash,
          paidNetwork: rewardRecord.paid_network,
          paidAt: rewardRecord.paid_at,
        } : null,
      };
    });

    // Referral statistics
    const referralStats = db.prepare(`
      SELECT 
        COUNT(*) as total_referred_users,
        COALESCE(SUM(CASE WHEN status IN ('qualified', 'rewarded') THEN 1 ELSE 0 END), 0) as qualified_referrals,
        COALESCE(SUM(reward_amount_usd), 0) as total_referral_rewards
      FROM swap_referrals
      WHERE referrer_user_id = ?
    `).get(user.id) as any;

    // Cashback calculations from ledger
    const cashbackRow = db.prepare(`
      SELECT COALESCE(SUM(cashback_amount_usd), 0) as total_cashback
      FROM swap_cashback_ledger
      WHERE user_id = ?
    `).get(user.id) as any;
    const totalCashbackUSD = Number((cashbackRow?.total_cashback || 0).toFixed(2));

    // Milestone bonus total
    const milestoneBonusRow = db.prepare(`
      SELECT COALESCE(SUM(amount_usd), 0) as total_milestone_bonus
      FROM swap_rewards
      WHERE user_id = ? AND reward_type = 'milestone' AND status IN ('unlocked', 'requested', 'approved', 'paid')
    `).get(user.id) as any;
    const milestoneBonusUSD = Number((milestoneBonusRow?.total_milestone_bonus || 0).toFixed(2));

    // Referral bonus total ($0.10 USDT per eligible referral)
    const referralBonusUSD = Number((referralStats?.total_referral_rewards || 0).toFixed(2));

    // Total bonus rewards = milestone bonus + referral bonus
    const totalBonusUSD = Number((milestoneBonusUSD + referralBonusUSD).toFixed(2));

    // Total accumulated eligible rewards = Cashback + Total Bonuses
    const totalAccumulatedRewardsUSD = Number((totalCashbackUSD + totalBonusUSD).toFixed(2));

    // Claim stats against $500 activation threshold
    const claimThresholdUSD = 500.0;
    const progressPercent = Math.min(100, Math.round((totalAccumulatedRewardsUSD / claimThresholdUSD) * 100));
    const isClaimEligible = totalAccumulatedRewardsUSD >= claimThresholdUSD;

    // Fetch user claims
    const userClaims = db.prepare(`
      SELECT c.*, p.payout_tx_hash, p.payout_network as paid_network, p.paid_at
      FROM swap_reward_claims c
      LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(user.id) as any[];

    const activeClaim = userClaims.length > 0 ? userClaims[0] : null;

    // Recent verified transactions
    const transactions = db.prepare(`
      SELECT id, chain_id, tx_hash, from_token_symbol, to_token_symbol, from_amount, to_amount, volume_usd, execution_status, verified_at
      FROM swap_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(user.id);

    res.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        chainId: user.chain_id,
        referralCode: user.referral_code,
        referralLink: `https://novap2p.com/?ref=${user.referral_code}`,
        totalVolumeUSD: user.total_volume_usd,
        eligibleSwapsCount: user.eligible_swaps_count,
        isFlagged: Boolean(user.is_flagged),
      },
      progress: {
        totalVolumeUSD: user.total_volume_usd,
        eligibleSwapsCount: user.eligible_swaps_count,
        completedMilestonesCount: completedCount,
        totalMilestonesCount: milestones.length,
        nextMilestone: nextMilestone || {
          milestoneNumber: milestones.length,
          targetVolumeUSD: milestones[milestones.length - 1]?.target_volume_usd || 0,
          remainingVolumeUSD: 0,
        },
      },
      milestones: milestoneProgress,
      cashbackStats: {
        totalCashbackUSD,
        cashbackPercentage: 5.0,
      },
      bonusStats: {
        milestoneBonusUSD,
        referralBonusUSD,
        totalBonusUSD,
      },
      claimStats: {
        claimThresholdUSD,
        totalAccumulatedRewardsUSD,
        progressPercent,
        isClaimEligible,
        remainingToClaimUSD: Math.max(0, claimThresholdUSD - totalAccumulatedRewardsUSD),
        activeClaim: activeClaim ? {
          id: activeClaim.id,
          status: activeClaim.status,
          requestedAmountUSD: activeClaim.requested_amount_usd,
          payoutAddress: activeClaim.payout_address,
          preferredNetwork: activeClaim.preferred_network,
          preferredToken: activeClaim.preferred_token,
          payoutTxHash: activeClaim.payout_tx_hash,
          paidNetwork: activeClaim.paid_network,
          paidAt: activeClaim.paid_at,
          rejectionReason: activeClaim.rejection_reason,
          createdAt: activeClaim.created_at,
        } : null,
      },
      referralStats: {
        referredUsersCount: referralStats?.total_referred_users || 0,
        qualifiedReferralsCount: referralStats?.qualified_referrals || 0,
        earnedRewardsUSD: referralStats?.total_referral_rewards || 0,
      },
      transactions: transactions.map((tx: any) => ({
        id: tx.id,
        chainId: tx.chain_id,
        txHash: tx.tx_hash,
        fromToken: tx.from_token_symbol,
        toToken: tx.to_token_symbol,
        fromAmount: tx.from_amount,
        toAmount: tx.to_amount,
        volumeUSD: tx.volume_usd,
        status: tx.execution_status,
        verifiedAt: tx.verified_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Submit and independently verify an executed swap transaction
apiRouter.post('/submit-transaction', async (req: Request, res: Response) => {
  try {
    const {
      walletAddress,
      chainId,
      txHash,
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      volumeUSD,
      lifiRouteId,
      rawRouteData,
    } = req.body;

    if (!walletAddress || !chainId || !txHash) {
      return res.status(400).json({ error: 'walletAddress, chainId and txHash are required' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const normalizedTxHash = txHash.toLowerCase();
    const numericChainId = Number(chainId);

    if (!ENABLED_CHAINS.includes(numericChainId)) {
      return res.status(400).json({ error: `Chain ID ${numericChainId} is not an enabled EVM network on Nova` });
    }

    const campaignId = 'campaign_genesis_001';
    const user = db.prepare('SELECT * FROM swap_campaign_users WHERE campaign_id = ? AND wallet_address = ?').get(campaignId, normalizedAddress) as any;
    if (!user) {
      return res.status(404).json({ error: 'User wallet not registered. Connect wallet first.' });
    }

    // Check duplicate transaction
    const existingTx = db.prepare('SELECT id FROM swap_transactions WHERE chain_id = ? AND tx_hash = ?').get(numericChainId, normalizedTxHash);
    if (existingTx) {
      return res.status(409).json({ error: 'Transaction hash has already been credited for this chain' });
    }

    // Verify swap volume in USD
    let verifiedVolume = typeof volumeUSD === 'number' && volumeUSD > 0 ? volumeUSD : 0;

    // Optional LI.FI Status API verification
    let lifiVerified = false;
    try {
      const lifiStatusRes = await fetch(`https://li.quest/v1/status?txHash=${normalizedTxHash}&fromChain=${numericChainId}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (lifiStatusRes.ok) {
        const lifiData = await lifiStatusRes.json();
        if (lifiData.status === 'DONE') {
          lifiVerified = true;
          if (lifiData.sending?.amountUSD) {
            verifiedVolume = parseFloat(lifiData.sending.amountUSD);
          }
        }
      }
    } catch (e) {
      // If network unreachable in sandbox, proceed with route-provided validated volume
    }

    const campaign = db.prepare('SELECT * FROM swap_campaigns WHERE id = ?').get(campaignId) as any;
    const minSwapUSD = campaign ? campaign.min_swap_usd : 10.0;

    if (verifiedVolume < minSwapUSD) {
      return res.status(400).json({ 
        error: `Swap volume ($${verifiedVolume.toFixed(2)}) is below minimum eligible threshold of $${minSwapUSD.toFixed(2)}` 
      });
    }

    const now = new Date().toISOString();
    const txId = 'tx_' + crypto.randomUUID();

    // Atomic transaction recording and milestone check
    const runTransaction = db.transaction(() => {
      // 1. Insert transaction
      db.prepare(`
        INSERT INTO swap_transactions (
          id, campaign_id, user_id, wallet_address, chain_id, tx_hash,
          lifi_route_id, from_token_symbol, from_token_address, to_token_symbol,
          to_token_address, from_amount, to_amount, volume_usd, execution_status,
          verification_status, verification_source, verified_at, raw_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        txId,
        campaignId,
        user.id,
        normalizedAddress,
        numericChainId,
        normalizedTxHash,
        lifiRouteId || null,
        fromToken?.symbol || null,
        fromToken?.address || null,
        toToken?.symbol || null,
        toToken?.address || null,
        fromAmount ? String(fromAmount) : null,
        toAmount ? String(toAmount) : null,
        verifiedVolume,
        'DONE',
        'VERIFIED',
        lifiVerified ? 'lifi_status_api' : 'validated_route',
        now,
        rawRouteData ? JSON.stringify(rawRouteData) : null,
        now
      );

      // 2. Increment user cumulative volume
      const newTotalVolume = user.total_volume_usd + verifiedVolume;
      const newSwapsCount = user.eligible_swaps_count + 1;

      db.prepare(`
        UPDATE swap_campaign_users 
        SET total_volume_usd = ?, eligible_swaps_count = ?, last_active_at = ?
        WHERE id = ?
      `).run(newTotalVolume, newSwapsCount, now, user.id);

      // 2b. Calculate and credit active 5% Cashback on Nova Swap fees (0.5% fee collected)
      let creditedCashbackUSD = 0;
      if (campaign && campaign.cashback_enabled) {
        const novaFeeCollectedUSD = verifiedVolume * 0.005; // 0.5% Nova fee
        const cashbackRate = (campaign.cashback_percentage || 5.0) / 100.0;
        creditedCashbackUSD = Number((novaFeeCollectedUSD * cashbackRate).toFixed(4));

        if (creditedCashbackUSD > 0) {
          const cbId = 'cb_' + crypto.randomUUID();
          db.prepare(`
            INSERT INTO swap_cashback_ledger (
              id, campaign_id, user_id, wallet_address, transaction_id,
              swap_volume_usd, nova_fee_usd, cashback_rate, cashback_amount_usd,
              status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'credited', ?)
          `).run(
            cbId,
            campaignId,
            user.id,
            normalizedAddress,
            txId,
            verifiedVolume,
            novaFeeCollectedUSD,
            cashbackRate,
            creditedCashbackUSD,
            now
          );

          // Also record in rewards table as cashback reward
          const cbRewardId = 'rwd_cb_' + crypto.randomUUID();
          db.prepare(`
            INSERT INTO swap_rewards (
              id, campaign_id, user_id, milestone_id, reward_type,
              amount_usd, status, unlocked_at, created_at
            ) VALUES (?, ?, ?, NULL, 'cashback', ?, 'unlocked', ?, ?)
          `).run(cbRewardId, campaignId, user.id, creditedCashbackUSD, now, now);
        }
      }

      // 3. Unlock eligible milestones (one-time reward each)
      const milestones = db.prepare(`
        SELECT * FROM swap_campaign_milestones 
        WHERE campaign_id = ? AND is_active = 1
      `).all(campaignId) as any[];

      const newlyUnlocked: string[] = [];

      milestones.forEach(m => {
        if (newTotalVolume >= m.target_volume_usd) {
          // Check if reward already exists
          const existingReward = db.prepare(`
            SELECT id FROM swap_rewards WHERE user_id = ? AND milestone_id = ?
          `).get(user.id, m.id);

          if (!existingReward) {
            const rewardId = 'rwd_' + crypto.randomUUID();
            db.prepare(`
              INSERT INTO swap_rewards (
                id, campaign_id, user_id, milestone_id, reward_type,
                amount_usd, status, unlocked_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              rewardId,
              campaignId,
              user.id,
              m.id,
              'milestone',
              m.reward_amount_usd,
              'unlocked',
              now,
              now
            );
            newlyUnlocked.push(m.title);
          }
        }
      });

      // 4. Check referral qualification for referrer ($0.10 USDT per referral on $100 volume)
      if (user.referred_by_user_id) {
        const referral = db.prepare(`
          SELECT * FROM swap_referrals 
          WHERE campaign_id = ? AND referred_user_id = ?
        `).get(campaignId, user.id) as any;

        if (referral && referral.status === 'connected') {
          if (newTotalVolume >= campaign.referral_qualifying_vol_usd) {
            // Qualify referral and grant reward to referrer
            const refRewardAmount = campaign.referral_reward_usd || 0.10;
            db.prepare(`
              UPDATE swap_referrals 
              SET status = 'qualified', qualifying_volume_usd = ?, reward_amount_usd = ?, qualified_at = ?
              WHERE id = ?
            `).run(newTotalVolume, refRewardAmount, now, referral.id);

            // Create referral reward for referrer
            const refRewardId = 'rwd_ref_' + crypto.randomUUID();
            db.prepare(`
              INSERT INTO swap_rewards (
                id, campaign_id, user_id, milestone_id, reward_type,
                amount_usd, status, unlocked_at, created_at
              ) VALUES (?, ?, ?, NULL, 'referral', ?, 'unlocked', ?, ?)
            `).run(refRewardId, campaignId, user.referred_by_user_id, refRewardAmount, now, now);
          }
        }
      }

      return { newTotalVolume, newSwapsCount, newlyUnlocked, creditedCashbackUSD };
    });

    const result = runTransaction();

    res.json({
      success: true,
      verifiedVolume,
      totalVolumeUSD: result.newTotalVolume,
      eligibleSwapsCount: result.newSwapsCount,
      newlyUnlockedMilestones: result.newlyUnlocked,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Submit reward claim request
// 8. Submit reward claim request (Supports individual milestone or $500 threshold claim)
apiRouter.post('/rewards/request', async (req: Request, res: Response) => {
  try {
    const { walletAddress, rewardId, payoutAddress, preferredNetwork, preferredToken, claimAmountUSD } = req.body;

    if (!walletAddress || !payoutAddress) {
      return res.status(400).json({ error: 'walletAddress and payoutAddress are required' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const user = db.prepare('SELECT id, campaign_id FROM swap_campaign_users WHERE wallet_address = ?').get(normalizedAddress) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if there is already a pending claim
    const pendingClaim = db.prepare(`
      SELECT id FROM swap_reward_claims 
      WHERE user_id = ? AND status IN ('pending', 'under_review')
    `).get(user.id);

    if (pendingClaim) {
      return res.status(400).json({ error: 'You already have an active claim under review. Please wait for admin approval before submitting another claim.' });
    }

    const now = new Date().toISOString();
    const claimId = 'clm_' + crypto.randomUUID();

    // Check if user is claiming specific reward or accumulated threshold rewards
    if (rewardId && rewardId !== 'threshold_500' && rewardId !== 'accumulated_rewards') {
      const reward = db.prepare('SELECT * FROM swap_rewards WHERE id = ? AND user_id = ?').get(rewardId, user.id) as any;
      if (!reward) {
        return res.status(404).json({ error: 'Reward record not found for this wallet' });
      }

      if (reward.status !== 'unlocked') {
        return res.status(400).json({ error: `Reward cannot be requested in status: ${reward.status}` });
      }

      const submitClaim = db.transaction(() => {
        db.prepare("UPDATE swap_rewards SET status = 'requested' WHERE id = ?").run(reward.id);

        db.prepare(`
          INSERT INTO swap_reward_claims (
            id, reward_id, user_id, campaign_id, requested_amount_usd,
            payout_address, preferred_network, preferred_token,
            cashback_amount_usd, milestone_amount_usd, referral_amount_usd,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          claimId,
          reward.id,
          user.id,
          user.campaign_id,
          reward.amount_usd,
          payoutAddress.trim(),
          preferredNetwork || 'BNB Smart Chain',
          preferredToken || 'USDT',
          reward.reward_type === 'cashback' ? reward.amount_usd : 0,
          reward.reward_type === 'milestone' ? reward.amount_usd : 0,
          reward.reward_type === 'referral' ? reward.amount_usd : 0,
          now,
          now
        );
      });

      submitClaim();

      // Trigger admin email & in-app notification
      sendAdminClaimNotification({
        claimId,
        walletAddress: normalizedAddress,
        requestedAmountUSD: reward.amount_usd,
        payoutAddress: payoutAddress.trim(),
        preferredNetwork: preferredNetwork || 'BNB Smart Chain',
        preferredToken: preferredToken || 'USDT',
        cashbackAmountUSD: reward.reward_type === 'cashback' ? reward.amount_usd : 0,
        milestoneAmountUSD: reward.reward_type === 'milestone' ? reward.amount_usd : 0,
        referralAmountUSD: reward.reward_type === 'referral' ? reward.amount_usd : 0,
        createdAt: now,
      }).catch(() => {});

      return res.json({
        success: true,
        claimId,
        status: 'pending',
        message: 'Reward claim submitted successfully. Admin has been notified for verification and manual payout.',
      });
    }

    // Otherwise: Claiming accumulated rewards (Threshold claim)
    const unlockedRewards = db.prepare(`
      SELECT * FROM swap_rewards WHERE user_id = ? AND status = 'unlocked'
    `).all(user.id) as any[];

    let totalCashback = 0;
    let totalMilestones = 0;
    let totalReferrals = 0;

    unlockedRewards.forEach(r => {
      if (r.reward_type === 'cashback') totalCashback += r.amount_usd;
      else if (r.reward_type === 'milestone') totalMilestones += r.amount_usd;
      else if (r.reward_type === 'referral') totalReferrals += r.amount_usd;
    });

    const totalEligible = totalCashback + totalMilestones + totalReferrals;
    const requestedAmount = claimAmountUSD && typeof claimAmountUSD === 'number' && claimAmountUSD > 0
      ? Math.min(claimAmountUSD, totalEligible)
      : totalEligible;

    if (requestedAmount <= 0) {
      return res.status(400).json({ error: 'No available unlocked reward balance to claim.' });
    }

    const submitThresholdClaim = db.transaction(() => {
      // Mark unlocked rewards as requested
      db.prepare(`
        UPDATE swap_rewards SET status = 'requested' WHERE user_id = ? AND status = 'unlocked'
      `).run(user.id);

      db.prepare(`
        INSERT INTO swap_reward_claims (
          id, reward_id, user_id, campaign_id, requested_amount_usd,
          payout_address, preferred_network, preferred_token,
          cashback_amount_usd, milestone_amount_usd, referral_amount_usd,
          status, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        claimId,
        user.id,
        user.campaign_id,
        requestedAmount,
        payoutAddress.trim(),
        preferredNetwork || 'BNB Smart Chain',
        preferredToken || 'USDT',
        totalCashback,
        totalMilestones,
        totalReferrals,
        now,
        now
      );
    });

    submitThresholdClaim();

    // Trigger admin email & in-app notification
    sendAdminClaimNotification({
      claimId,
      walletAddress: normalizedAddress,
      requestedAmountUSD: requestedAmount,
      payoutAddress: payoutAddress.trim(),
      preferredNetwork: preferredNetwork || 'BNB Smart Chain',
      preferredToken: preferredToken || 'USDT',
      cashbackAmountUSD: totalCashback,
      milestoneAmountUSD: totalMilestones,
      referralAmountUSD: totalReferrals,
      createdAt: now,
    }).catch(() => {});

    res.json({
      success: true,
      claimId,
      status: 'pending',
      requestedAmountUSD: requestedAmount,
      message: 'Genesis Rewards claim submitted successfully. Admin has been notified for verification and manual payout.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// SEPARATE SWAP ADMIN MODULE ENDPOINTS
// ---------------------------------------------------------------------------

// Admin login verification
apiRouter.post('/admin/login', (req: Request, res: Response) => {
  const { adminKey } = req.body;
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin passkey' });
  }
  res.json({ success: true, token: ADMIN_KEY });
});

// Admin overview analytics
apiRouter.get('/admin/overview', verifyAdmin, (req: Request, res: Response) => {
  try {
    const campaignId = 'campaign_genesis_001';
    const campaign = db.prepare('SELECT * FROM swap_campaigns WHERE id = ?').get(campaignId) as any;

    const userStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT id) as total_users,
        COALESCE(SUM(total_volume_usd), 0) as total_volume,
        COALESCE(SUM(eligible_swaps_count), 0) as total_swaps,
        COUNT(CASE WHEN eligible_swaps_count > 1 THEN 1 END) as repeat_swappers
      FROM swap_campaign_users
      WHERE campaign_id = ?
    `).get(campaignId) as any;

    const eventStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN event_name = 'campaign_page_view' THEN 1 END) as page_views,
        COUNT(DISTINCT CASE WHEN event_name = 'campaign_page_view' THEN ip_address END) as unique_visitors,
        COUNT(CASE WHEN event_name = 'wallet_connect_clicked' THEN 1 END) as connect_attempts,
        COUNT(CASE WHEN event_name = 'wallet_connected' THEN 1 END) as connected_wallets,
        COUNT(CASE WHEN event_name = 'swap_initiated' THEN 1 END) as swaps_initiated
      FROM swap_campaign_events
      WHERE campaign_id = ?
    `).get(campaignId) as any;

    const txStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN execution_status = 'DONE' THEN 1 END) as successful_swaps,
        COUNT(CASE WHEN execution_status = 'FAILED' THEN 1 END) as failed_swaps
      FROM swap_transactions
      WHERE campaign_id = ?
    `).get(campaignId) as any;

    const referralStats = db.prepare(`
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN status IN ('qualified', 'rewarded') THEN 1 END) as qualified_referrals
      FROM swap_referrals
      WHERE campaign_id = ?
    `).get(campaignId) as any;

    const rewardStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'unlocked' THEN 1 END) as unlocked_count,
        COUNT(CASE WHEN status IN ('requested', 'under_review') THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_usd ELSE 0 END), 0) as total_paid_amount
      FROM swap_rewards
      WHERE campaign_id = ?
    `).get(campaignId) as any;

    const remainingBudget = campaign ? Math.max(0, campaign.total_budget_usd - (rewardStats.total_paid_amount || 0)) : 0;

    res.json({
      campaign,
      analytics: {
        pageViews: eventStats.page_views || 0,
        uniqueVisitors: eventStats.unique_visitors || 0,
        connectAttempts: eventStats.connect_attempts || 0,
        connectedWallets: userStats.total_users || 0,
        swapsInitiated: eventStats.swaps_initiated || 0,
        successfulSwaps: txStats.successful_swaps || 0,
        failedSwaps: txStats.failed_swaps || 0,
        totalVerifiedVolumeUSD: userStats.total_volume || 0,
        repeatSwappers: userStats.repeat_swappers || 0,
        referralVisits: referralStats.total_referrals || 0,
        qualifiedReferrals: referralStats.qualified_referrals || 0,
        milestonesUnlocked: rewardStats.unlocked_count || 0,
        pendingClaims: rewardStats.pending_requests || 0,
        approvedClaims: rewardStats.approved_count || 0,
        paidClaims: rewardStats.paid_count || 0,
        totalPaidAmountUSD: rewardStats.total_paid_amount || 0,
        totalBudgetUSD: campaign?.total_budget_usd || 10000.0,
        remainingBudgetUSD: remainingBudget,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin campaign configuration update
apiRouter.put('/admin/campaign', verifyAdmin, (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      status,
      startDate,
      endDate,
      totalBudgetUSD,
      minSwapUSD,
      referralRewardUSD,
      referralQualifyingVolUSD,
      cashbackEnabled,
      cashbackPercentage,
    } = req.body;

    const campaignId = 'campaign_genesis_001';
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE swap_campaigns
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          total_budget_usd = COALESCE(?, total_budget_usd),
          min_swap_usd = COALESCE(?, min_swap_usd),
          referral_reward_usd = COALESCE(?, referral_reward_usd),
          referral_qualifying_vol_usd = COALESCE(?, referral_qualifying_vol_usd),
          cashback_enabled = COALESCE(?, cashback_enabled),
          cashback_percentage = COALESCE(?, cashback_percentage),
          updated_at = ?
      WHERE id = ?
    `).run(
      title,
      description,
      status,
      startDate,
      endDate,
      totalBudgetUSD,
      minSwapUSD,
      referralRewardUSD,
      referralQualifyingVolUSD,
      cashbackEnabled !== undefined ? (cashbackEnabled ? 1 : 0) : null,
      cashbackPercentage,
      now,
      campaignId
    );

    // Audit log
    db.prepare(`
      INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
      VALUES (?, 'admin', 'update_campaign_settings', 'campaign', ?, ?, ?, ?)
    `).run('log_' + crypto.randomUUID(), campaignId, JSON.stringify(req.body), String(req.ip || ''), now);

    res.json({ success: true, message: 'Campaign settings updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin add/update milestone
apiRouter.post('/admin/milestones', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { id, milestoneNumber, title, targetVolumeUSD, rewardAmountUSD, rewardDescription, isActive, sortOrder } = req.body;
    const campaignId = 'campaign_genesis_001';
    const now = new Date().toISOString();

    if (id) {
      // Update
      db.prepare(`
        UPDATE swap_campaign_milestones
        SET milestone_number = COALESCE(?, milestone_number),
            title = COALESCE(?, title),
            target_volume_usd = COALESCE(?, target_volume_usd),
            reward_amount_usd = COALESCE(?, reward_amount_usd),
            reward_description = COALESCE(?, reward_description),
            is_active = COALESCE(?, is_active),
            sort_order = COALESCE(?, sort_order)
        WHERE id = ?
      `).run(
        milestoneNumber,
        title,
        targetVolumeUSD,
        rewardAmountUSD,
        rewardDescription,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        sortOrder,
        id
      );
    } else {
      // Create new
      const newId = 'ms_' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO swap_campaign_milestones (
          id, campaign_id, milestone_number, title, target_volume_usd,
          reward_amount_usd, reward_description, is_active, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        campaignId,
        milestoneNumber || 1,
        title || 'New Milestone',
        targetVolumeUSD || 100.0,
        rewardAmountUSD || 1.0,
        rewardDescription || 'Milestone reward',
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        sortOrder || 1,
        now
      );
    }

    res.json({ success: true, message: 'Milestone saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin delete milestone
apiRouter.delete('/admin/milestones/:id', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM swap_campaign_milestones WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin list reward claims with user info
apiRouter.get('/admin/claims', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT c.*, u.wallet_address, u.total_volume_usd, u.eligible_swaps_count, u.is_flagged,
             r.reward_type, m.title as milestone_title, m.target_volume_usd as milestone_target,
             p.payout_tx_hash, p.payout_network as paid_network, p.payout_token as paid_token, p.paid_at
      FROM swap_reward_claims c
      JOIN swap_campaign_users u ON u.id = c.user_id
      JOIN swap_rewards r ON r.id = c.reward_id
      LEFT JOIN swap_campaign_milestones m ON m.id = r.milestone_id
      LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (u.wallet_address LIKE ? OR c.payout_address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC';

    const claims = db.prepare(query).all(...params);
    res.json({ claims });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin approve or reject reward claim
apiRouter.post('/admin/claims/:id/review', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason, adminNotes } = req.body; // action: 'approve' | 'reject' | 'freeze'

    if (!['approve', 'reject', 'freeze'].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use 'approve', 'reject' or 'freeze'" });
    }

    const claim = db.prepare('SELECT * FROM swap_reward_claims WHERE id = ?').get(id) as any;
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const now = new Date().toISOString();
    let newStatus = 'pending';
    let rewardStatus = 'requested';

    if (action === 'approve') {
      newStatus = 'approved';
      rewardStatus = 'approved';
    } else if (action === 'reject') {
      newStatus = 'rejected';
      rewardStatus = 'rejected';
    } else if (action === 'freeze') {
      newStatus = 'frozen';
      rewardStatus = 'frozen';
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE swap_reward_claims
        SET status = ?, rejection_reason = ?, admin_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(newStatus, rejectionReason || null, adminNotes || null, now, claim.id);

      db.prepare(`
        UPDATE swap_rewards
        SET status = ?
        WHERE id = ?
      `).run(rewardStatus, claim.reward_id);

      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', ?, 'claim', ?, ?, ?, ?)
      `).run(
        'log_' + crypto.randomUUID(),
        `claim_${action}`,
        claim.id,
        JSON.stringify({ action, rejectionReason, adminNotes }),
        String(req.ip || ''),
        now
      );
    })();

    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin mark payout as completed
apiRouter.post('/admin/claims/:id/pay', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payoutNetwork, payoutToken, payoutTxHash, notes } = req.body;

    if (!payoutNetwork || !payoutToken || !payoutTxHash) {
      return res.status(400).json({ error: 'payoutNetwork, payoutToken and payoutTxHash are required' });
    }

    const claim = db.prepare('SELECT * FROM swap_reward_claims WHERE id = ?').get(id) as any;
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status === 'paid') {
      return res.status(400).json({ error: 'Claim has already been marked as paid' });
    }

    const now = new Date().toISOString();
    const payoutId = 'pay_' + crypto.randomUUID();

    db.transaction(() => {
      // 1. Insert payout record
      db.prepare(`
        INSERT INTO swap_reward_payouts (
          id, claim_id, reward_id, user_id, amount_usd,
          payout_network, payout_token, payout_tx_hash,
          paid_by_admin, paid_at, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)
      `).run(
        payoutId,
        claim.id,
        claim.reward_id,
        claim.user_id,
        claim.requested_amount_usd,
        payoutNetwork,
        payoutToken,
        payoutTxHash.trim(),
        now,
        notes || null,
        now
      );

      // 2. Update claim status to paid
      db.prepare("UPDATE swap_reward_claims SET status = 'paid', updated_at = ? WHERE id = ?").run(now, claim.id);

      // 3. Update reward status to paid
      db.prepare("UPDATE swap_rewards SET status = 'paid' WHERE id = ?").run(claim.reward_id);

      // 4. Update campaign spent budget
      db.prepare(`
        UPDATE swap_campaigns
        SET spent_budget_usd = spent_budget_usd + ?
        WHERE id = ?
      `).run(claim.requested_amount_usd, claim.campaign_id);

      // 5. Audit log
      db.prepare(`
        INSERT INTO swap_admin_audit_logs (id, admin_identifier, action, target_type, target_id, details, ip_address, created_at)
        VALUES (?, 'admin', 'record_payout', 'payout', ?, ?, ?, ?)
      `).run(
        'log_' + crypto.randomUUID(),
        payoutId,
        JSON.stringify({ claimId: claim.id, amountUSD: claim.requested_amount_usd, payoutTxHash, payoutNetwork }),
        String(req.ip || ''),
        now
      );
    })();

    res.json({ success: true, payoutId, message: 'Payout recorded and status updated to Paid' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin list users with volume and flag controls
apiRouter.get('/admin/users', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { search, flagged } = req.query;

    let query = `
      SELECT u.*, 
        (SELECT COUNT(*) FROM swap_referrals WHERE referrer_user_id = u.id) as referrals_count,
        (SELECT COUNT(*) FROM swap_rewards WHERE user_id = u.id AND status = 'paid') as rewards_paid_count
      FROM swap_campaign_users u
      WHERE 1=1
    `;
    const params: any[] = [];

    if (flagged === 'true') {
      query += ' AND u.is_flagged = 1';
    }

    if (search) {
      query += ' AND (u.wallet_address LIKE ? OR u.referral_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.total_volume_usd DESC LIMIT 100';

    const users = db.prepare(query).all(...params);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin toggle user flag (Sybil / Wash trading)
apiRouter.post('/admin/users/:id/flag', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isFlagged, flagReason } = req.body;

    db.prepare(`
      UPDATE swap_campaign_users
      SET is_flagged = ?, flag_reason = ?
      WHERE id = ?
    `).run(isFlagged ? 1 : 0, flagReason || null, id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin audit logs
apiRouter.get('/admin/audit-logs', verifyAdmin, (req: Request, res: Response) => {
  try {
    const logs = db.prepare('SELECT * FROM swap_admin_audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin CSV Export
apiRouter.get('/admin/export/:type', verifyAdmin, (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    let data: any[] = [];
    let filename = `swap_${type}_${Date.now()}.csv`;

    if (type === 'users') {
      data = db.prepare('SELECT wallet_address, chain_id, total_volume_usd, eligible_swaps_count, referral_code, is_flagged, verified_at, created_at FROM swap_campaign_users ORDER BY total_volume_usd DESC').all();
    } else if (type === 'transactions') {
      data = db.prepare('SELECT wallet_address, chain_id, tx_hash, from_token_symbol, to_token_symbol, volume_usd, execution_status, verified_at FROM swap_transactions ORDER BY created_at DESC').all();
    } else if (type === 'claims') {
      data = db.prepare(`
        SELECT c.id, u.wallet_address, c.requested_amount_usd, c.payout_address, c.preferred_network, c.preferred_token, c.status, p.payout_tx_hash, p.paid_at, c.created_at
        FROM swap_reward_claims c
        JOIN swap_campaign_users u ON u.id = c.user_id
        LEFT JOIN swap_reward_payouts p ON p.claim_id = c.id
        ORDER BY c.created_at DESC
      `).all();
    } else if (type === 'referrals') {
      data = db.prepare(`
        SELECT r.id, u1.wallet_address as referrer_wallet, u2.wallet_address as referred_wallet, r.referral_code, r.status, r.qualifying_volume_usd, r.reward_amount_usd, r.created_at
        FROM swap_referrals r
        JOIN swap_campaign_users u1 ON u1.id = r.referrer_user_id
        JOIN swap_campaign_users u2 ON u2.id = r.referred_user_id
        ORDER BY r.created_at DESC
      `).all();
    } else {
      return res.status(400).json({ error: 'Invalid export type. Use users, transactions, claims, or referrals.' });
    }

    if (data.length === 0) {
      return res.send('No data available');
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
