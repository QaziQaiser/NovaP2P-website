import { db, initDb } from './db.ts';
import { apiRouter } from './api.ts';
import { ethers } from 'ethers';
import crypto from 'crypto';

// In-memory HTTP simulator (Zero network sockets needed)
function callApi(method: string, path: string, body: any = {}, headers: any = {}) {
  return new Promise<{ status: number; body: any; headers: any }>((resolve) => {
    const url = new URL(path, 'http://localhost');
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });

    const req: any = {
      method,
      url: url.pathname + url.search,
      path: url.pathname,
      query,
      params: {},
      body,
      headers: { ...headers },
      socket: { remoteAddress: '127.0.0.1' },
      header: (name: string) => headers[name.toLowerCase()] || headers[name],
    };

    let statusCode = 200;
    const resHeaders: Record<string, string> = {};

    const res: any = {
      status: (code: number) => { statusCode = code; return res; },
      setHeader: (k: string, v: string) => { resHeaders[k] = v; },
      json: (data: any) => resolve({ status: statusCode, body: data, headers: resHeaders }),
      send: (data: any) => resolve({ status: statusCode, body: data, headers: resHeaders }),
    };

    // Dispatch into Express router
    apiRouter(req, res, (err: any) => {
      if (err) {
        resolve({ status: 500, body: { error: String(err) }, headers: resHeaders });
      } else {
        resolve({ status: 404, body: { error: 'Not found' }, headers: resHeaders });
      }
    });
  });
}

async function runTestSuite() {
  console.log('============================================================');
  console.log('STARTING NOVA SWAP GENESIS CAMPAIGN TEST SUITE (UPDATED SPEC)');
  console.log('============================================================\n');

  initDb();

  const ADMIN_KEY = process.env.SWAP_ADMIN_KEY || 'nova-genesis-admin-2026';

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  try {
    // TEST 1: Public Campaign Settings
    console.log('\n--- 1. Testing Public Campaign Retrieval ---');
    const campRes = await callApi('GET', '/campaign');
    assert(campRes.status === 200, 'Public campaign endpoint returns 200 OK');
    assert(campRes.body.campaign.slug === 'genesis', 'Genesis campaign slug is active', campRes.body?.campaign?.slug);
    assert(campRes.body.milestones.length >= 3, 'Configured milestones loaded dynamically from DB', `Count: ${campRes.body?.milestones?.length}`);
    assert(campRes.body.campaign.cashbackEnabled === true, '5% Cashback is actively enabled');
    assert(campRes.body.campaign.cashbackPercentage === 5.0, 'Cashback rate is 5.0%');

    // TEST 2: Wallet Generation & Cryptographic Verification
    console.log('\n--- 2. Testing Wallet Cryptographic Verification ---');
    const referrerWallet = ethers.Wallet.createRandom();
    const nonceRes = await callApi('GET', `/auth/nonce?address=${referrerWallet.address}`);
    assert(Boolean(nonceRes.body.nonce && nonceRes.body.message), 'Retrieved cryptographic nonce and message');

    const signature = await referrerWallet.signMessage(nonceRes.body.message);
    const verifyRes = await callApi('POST', '/auth/verify', {
      address: referrerWallet.address,
      signature,
      message: nonceRes.body.message,
      chainId: 56, // BNB Smart Chain
    });
    assert(verifyRes.status === 200, 'Wallet ownership verified with valid signature');
    assert(Boolean(verifyRes.body.user.referralCode), 'User assigned unique referral code', verifyRes.body.user.referralCode);
    const referrerCode = verifyRes.body.user.referralCode;

    // TEST 3: Referral Attribution (Visitor opens with ?ref=CODE)
    console.log('\n--- 3. Testing Referral Tracking ---');
    const refTrackRes = await callApi('POST', '/track-referral', { refCode: referrerCode });
    assert(refTrackRes.body.valid === true, 'Referral code recognized and logged');

    // TEST 4: Second Wallet Connects using Referral Code
    console.log('\n--- 4. Testing Referred Wallet Onboarding ---');
    const referredWallet = ethers.Wallet.createRandom();
    const refNonceRes = await callApi('GET', `/auth/nonce?address=${referredWallet.address}`);
    const refSig = await referredWallet.signMessage(refNonceRes.body.message);

    const refVerifyRes = await callApi('POST', '/auth/verify', {
      address: referredWallet.address,
      signature: refSig,
      message: refNonceRes.body.message,
      chainId: 1, // Ethereum
      refCode: referrerCode,
    });
    assert(refVerifyRes.status === 200, 'Referred wallet bound to referrer code');

    // TEST 5: Self-Referral Prevention
    console.log('\n--- 5. Testing Anti-Sybil Self-Referral Guard ---');
    const selfNonceRes = await callApi('GET', `/auth/nonce?address=${referrerWallet.address}`);
    const selfSig = await referrerWallet.signMessage(selfNonceRes.body.message);
    await callApi('POST', '/auth/verify', {
      address: referrerWallet.address,
      signature: selfSig,
      message: selfNonceRes.body.message,
      chainId: 56,
      refCode: referrerCode, // Attempting self-referral
    });
    const referrerDbUser = db.prepare('SELECT referred_by_user_id FROM swap_campaign_users WHERE wallet_address = ?')
      .get(referrerWallet.address.toLowerCase()) as any;
    assert(referrerDbUser.referred_by_user_id === null, 'Self-referral blocked: user cannot refer their own wallet');

    // TEST 6: Minimum Swap Threshold Enforcement
    console.log('\n--- 6. Testing Minimum Eligible Swap Enforcement ---');
    const subMinRes = await callApi('POST', '/submit-transaction', {
      walletAddress: referredWallet.address,
      chainId: 56,
      txHash: '0x' + crypto.randomUUID().replace(/-/g, '') + '01',
      volumeUSD: 5.0, // Below $10 min
    });
    assert(subMinRes.status === 400, 'Swap below minimum threshold ($5 < $10) rejected');

    // TEST 7: Eligible Swap Transaction Submission & Cumulative Volume & 5% Cashback
    console.log('\n--- 7. Testing Swap Submission, 5% Cashback & Volume Update ---');
    const txHash1 = '0x' + crypto.randomUUID().replace(/-/g, '') + '11';
    const swap1Res = await callApi('POST', '/submit-transaction', {
      walletAddress: referredWallet.address,
      chainId: 56, // BNB Smart Chain
      txHash: txHash1,
      fromToken: { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
      toToken: { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
      fromAmount: '150.00',
      toAmount: '149.85',
      volumeUSD: 150.0, // Qualifies referral ($100 min)
      lifiRouteId: 'route_test_001',
    });
    assert(swap1Res.status === 200, 'Eligible swap transaction verified and credited');
    assert(swap1Res.body.totalVolumeUSD === 150.0, 'Cumulative volume matches $150.00', `Got: ${swap1Res.body.totalVolumeUSD}`);

    // Verify 5% cashback recorded in swap_cashback_ledger
    // On $150 volume, Nova fee (0.5%) = $0.75. 5% cashback on fee = $0.0375
    const cashbackEntry = db.prepare('SELECT cashback_amount_usd FROM swap_cashback_ledger WHERE wallet_address = ?')
      .get(referredWallet.address.toLowerCase()) as any;
    assert(Boolean(cashbackEntry && cashbackEntry.cashback_amount_usd > 0), '5% cashback credited to swap_cashback_ledger on Nova fee', `Cashback: ${cashbackEntry?.cashback_amount_usd}`);

    // TEST 8: Duplicate Transaction Prevention
    console.log('\n--- 8. Testing Duplicate Tx Hash Guard ---');
    const dupRes = await callApi('POST', '/submit-transaction', {
      walletAddress: referredWallet.address,
      chainId: 56,
      txHash: txHash1, // Same hash and chain
      volumeUSD: 150.0,
    });
    assert(dupRes.status === 409, 'Duplicate transaction hash rejected with 409 Conflict');

    // TEST 9: Referral Milestone Qualified for Referrer ($0.10 USDT)
    console.log('\n--- 9. Testing Automatic Referral Reward Credit ($0.10 USDT) ---');
    const referrerDashRes = await callApi('GET', `/user/${referrerWallet.address}`);
    assert(referrerDashRes.body.referralStats.qualifiedReferralsCount === 1, 'Referrer credited with 1 qualified referral');
    assert(referrerDashRes.body.referralStats.earnedRewardsUSD === 0.10, 'Referrer credited with $0.10 referral bonus reward', `Got: ${referrerDashRes.body.referralStats.earnedRewardsUSD}`);

    // TEST 10: Milestone 1 Unlocks at $10,000 Volume ($25 USDT Reward)
    console.log('\n--- 10. Testing Milestone 1 Unlock at $10,000 Volume ---');
    const txHash2 = '0x' + crypto.randomUUID().replace(/-/g, '') + '22';
    const swap2Res = await callApi('POST', '/submit-transaction', {
      walletAddress: referredWallet.address,
      chainId: 56,
      txHash: txHash2,
      volumeUSD: 9850.0, // Total = 150 + 9850 = 10,000
    });
    assert(swap2Res.status === 200, 'Subsequent swap verified');
    assert(swap2Res.body.totalVolumeUSD === 10000.0, 'Total volume reached exactly $10,000.00');
    assert(swap2Res.body.newlyUnlockedMilestones.includes('Milestone 1'), 'Milestone 1 unlocked automatically upon reaching $10,000');

    // TEST 11: User Dashboard Reflects Milestone 1 & Rewards
    console.log('\n--- 11. Testing User Dashboard Data Structure ---');
    const userDashRes = await callApi('GET', `/user/${referredWallet.address}`);
    const ms1 = userDashRes.body.milestones.find((m: any) => m.milestoneNumber === 1);
    assert(ms1.isCompleted === true, 'Milestone 1 marked completed in user dashboard');
    assert(ms1.status === 'unlocked', 'Milestone 1 status is unlocked', ms1.status);
    assert(ms1.rewardAmountUSD === 25.0, 'Milestone 1 reward is $25.00 USDT');

    // Check $500 claim activation progress
    assert(userDashRes.body.claimStats.claimThresholdUSD === 500.0, 'Claim activation threshold is $500');
    assert(userDashRes.body.claimStats.totalAccumulatedRewardsUSD >= 25.0, 'Accumulated rewards include Milestone 1 ($25) + Cashback', `Got: ${userDashRes.body.claimStats.totalAccumulatedRewardsUSD}`);

    // TEST 12: Reward Claim Submission
    console.log('\n--- 12. Testing Reward Claim Submission ---');
    const rewardRecord = db.prepare('SELECT id FROM swap_rewards WHERE user_id = ? AND milestone_id = ?')
      .get(userDashRes.body.user.id, ms1.id) as any;

    const claimRes = await callApi('POST', '/rewards/request', {
      walletAddress: referredWallet.address,
      rewardId: rewardRecord.id,
      payoutAddress: referredWallet.address,
      preferredNetwork: 'BNB Smart Chain (BEP-20)',
      preferredToken: 'USDT',
    });
    assert(claimRes.status === 200, 'Reward claim submitted successfully');
    assert(claimRes.body.status === 'pending', 'Claim status initialized as pending review');

    // TEST 13: Admin Claim Review & Manual Payout
    console.log('\n--- 13. Testing Admin Review & Payout Execution ---');
    // Approve claim
    const approveRes = await callApi('POST', `/admin/claims/${claimRes.body.claimId}/review`, { action: 'approve' }, { 'x-admin-key': ADMIN_KEY });
    assert(approveRes.status === 200, 'Admin approved reward claim');

    // Mark as paid
    const payoutTxHash = '0x' + crypto.randomUUID().replace(/-/g, '') + '99';
    const payRes = await callApi('POST', `/admin/claims/${claimRes.body.claimId}/pay`, {
      payoutNetwork: 'BNB Smart Chain (BEP-20)',
      payoutToken: 'USDT',
      payoutTxHash,
      notes: 'Transferred via Nova Treasury Wallet',
    }, { 'x-admin-key': ADMIN_KEY });
    assert(payRes.status === 200, 'Admin marked claim as paid with transaction hash');

    // TEST 14: User Dashboard Reflects Paid Status with Tx Hash
    console.log('\n--- 14. Testing Dashboard Paid Status & Explorer Link ---');
    const paidDashRes = await callApi('GET', `/user/${referredWallet.address}`);
    const paidMs1 = paidDashRes.body.milestones.find((m: any) => m.milestoneNumber === 1);
    assert(paidMs1.status === 'paid', 'User dashboard reflects Paid status');
    assert(paidMs1.rewardRecord.payoutTxHash === payoutTxHash, 'Payout transaction hash attached');

    // TEST 15: Admin CSV Exports
    console.log('\n--- 15. Testing Admin CSV Export ---');
    const exportRes = await callApi('GET', '/admin/export/users', {}, { 'x-admin-key': ADMIN_KEY });
    assert(exportRes.status === 200 && typeof exportRes.body === 'string' && exportRes.body.includes('wallet_address'), 'Users CSV export generated with headers');

    console.log('\n============================================================');
    console.log(`TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('============================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (error) {
    console.error('Fatal test execution error:', error);
    process.exit(1);
  }
}

runTestSuite();
