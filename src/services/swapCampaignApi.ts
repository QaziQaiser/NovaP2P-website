// Nova Swap Genesis Campaign API Client Service

export interface CampaignData {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'active' | 'paused' | 'ended';
  startDate: string;
  endDate: string;
  daysRemaining: number;
  minSwapUSD: number;
  totalBudgetUSD: number;
  spentBudgetUSD: number;
  remainingBudgetUSD: number;
  referralRewardUSD: number;
  referralQualifyingVolUSD: number;
  cashbackEnabled: boolean;
  cashbackPercentage: number;
  enabledChains: number[];
}

export interface MilestoneItem {
  id: string;
  milestoneNumber: number;
  title: string;
  targetVolumeUSD: number;
  rewardAmountUSD: number;
  rewardDescription: string;
}

export interface UserDashboardData {
  user: {
    id: string;
    walletAddress: string;
    chainId: number | null;
    referralCode: string;
    referralLink: string;
    totalVolumeUSD: number;
    eligibleSwapsCount: number;
    isFlagged: boolean;
  };
  progress: {
    totalVolumeUSD: number;
    eligibleSwapsCount: number;
    completedMilestonesCount: number;
    totalMilestonesCount: number;
    nextMilestone: {
      milestoneNumber: number;
      targetVolumeUSD: number;
      remainingVolumeUSD: number;
    };
  };
  milestones: Array<{
    id: string;
    milestoneNumber: number;
    title: string;
    targetVolumeUSD: number;
    rewardAmountUSD: number;
    rewardDescription: string;
    isCompleted: boolean;
    status: 'locked' | 'in_progress' | 'unlocked' | 'requested' | 'under_review' | 'approved' | 'paid' | 'rejected';
    rewardRecord?: {
      id: string;
      amountUSD: number;
      status: string;
      claimId?: string;
      payoutTxHash?: string;
      paidNetwork?: string;
      paidAt?: string;
    } | null;
  }>;
  cashbackStats?: {
    totalCashbackUSD: number;
    cashbackPercentage: number;
  };
  bonusStats?: {
    milestoneBonusUSD: number;
    referralBonusUSD: number;
    totalBonusUSD: number;
  };
  claimStats?: {
    claimThresholdUSD: number;
    totalAccumulatedRewardsUSD: number;
    progressPercent: number;
    isClaimEligible: boolean;
    remainingToClaimUSD: number;
    activeClaim?: {
      id: string;
      status: string;
      requestedAmountUSD: number;
      payoutAddress: string;
      preferredNetwork: string;
      preferredToken: string;
      payoutTxHash?: string;
      paidNetwork?: string;
      paidAt?: string;
      rejectionReason?: string;
      createdAt: string;
    } | null;
  };
  referralStats: {
    referredUsersCount: number;
    qualifiedReferralsCount: number;
    earnedRewardsUSD: number;
  };
  transactions: Array<{
    id: string;
    chainId: number;
    txHash: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    volumeUSD: number;
    status: string;
    verifiedAt: string;
  }>;
}

const API_BASE = '/api/swap';

export const swapCampaignApi = {
  // Public campaign settings & milestones
  async getCampaign(): Promise<{ campaign: CampaignData; milestones: MilestoneItem[]; stats: any }> {
    const res = await fetch(`${API_BASE}/campaign`);
    if (!res.ok) throw new Error('Failed to load campaign data');
    return res.json();
  },

  // Track referral visit
  async trackReferral(refCode: string): Promise<{ success: boolean; valid: boolean; referrerCode: string }> {
    const res = await fetch(`${API_BASE}/track-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refCode }),
    });
    return res.json();
  },

  // Track analytics event
  async trackEvent(eventName: string, walletAddress?: string | null, eventData?: any): Promise<void> {
    try {
      await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, walletAddress, eventData }),
      });
    } catch {
      // non-blocking
    }
  },

  // Request nonce to sign
  async getNonce(walletAddress: string): Promise<{ nonce: string; message: string }> {
    const res = await fetch(`${API_BASE}/auth/nonce?address=${encodeURIComponent(walletAddress)}`);
    if (!res.ok) throw new Error('Failed to retrieve authentication nonce');
    return res.json();
  },

  // Verify wallet signature
  async verifyWallet(
    address: string,
    signature: string,
    message: string,
    chainId?: number | null,
    refCode?: string | null
  ): Promise<{ success: boolean; user: any }> {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature, message, chainId, refCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Wallet verification failed');
    }
    return res.json();
  },

  // Get user dashboard data
  async getUserDashboard(walletAddress: string): Promise<UserDashboardData> {
    const res = await fetch(`${API_BASE}/user/${encodeURIComponent(walletAddress.toLowerCase())}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch user rewards data');
    }
    return res.json();
  },

  // Submit executed swap transaction
  async submitTransaction(payload: {
    walletAddress: string;
    chainId: number;
    txHash: string;
    fromToken?: any;
    toToken?: any;
    fromAmount?: string;
    toAmount?: string;
    volumeUSD: number;
    lifiRouteId?: string;
    rawRouteData?: any;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/submit-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit transaction for verification');
    }
    return res.json();
  },

  // Submit claim for unlocked reward or $500 threshold
  async requestRewardClaim(payload: {
    walletAddress: string;
    rewardId?: string;
    payoutAddress: string;
    preferredNetwork?: string;
    preferredToken?: string;
    claimAmountUSD?: number;
    signature: string;
    message: string;
    signerAddress: string;
  }): Promise<{ success: boolean; claimId: string; message: string }> {
    const res = await fetch(`${API_BASE}/rewards/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to request reward claim');
    }
    return res.json();
  },

  // -------------------------------------------------------------------------
  // ADMIN API CLIENT
  // -------------------------------------------------------------------------
  async adminLogin(adminKey: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey }),
    });
    if (!res.ok) throw new Error('Invalid Admin Key');
    return res.json();
  },

  async getAdminOverview(adminKey: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/overview`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to load admin analytics');
    return res.json();
  },

  async updateAdminCampaign(adminKey: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/campaign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update campaign');
    return res.json();
  },

  async saveAdminMilestone(adminKey: string, milestone: any): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(milestone),
    });
    if (!res.ok) throw new Error('Failed to save milestone');
    return res.json();
  },

  async deleteAdminMilestone(adminKey: string, id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/milestones/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to delete milestone');
    return res.json();
  },

  async getAdminClaims(adminKey: string, status?: string, search?: string): Promise<any> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    const res = await fetch(`${API_BASE}/admin/claims?${params.toString()}`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to fetch claims');
    return res.json();
  },

  async reviewAdminClaim(adminKey: string, id: string, data: { action: string; rejectionReason?: string; adminNotes?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/claims/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to review claim');
    return res.json();
  },

  async payAdminClaim(adminKey: string, id: string, data: { payoutNetwork: string; payoutToken: string; payoutTxHash: string; notes?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/claims/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to mark claim as paid');
    return res.json();
  },

  async getAdminUsers(adminKey: string, search?: string, flagged?: boolean): Promise<any> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (flagged !== undefined) params.append('flagged', String(flagged));

    const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async flagAdminUser(adminKey: string, id: string, isFlagged: boolean, flagReason?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(id)}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ isFlagged, flagReason }),
    });
    if (!res.ok) throw new Error('Failed to update user flag');
    return res.json();
  },

  async getAdminAuditLogs(adminKey: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  getExportUrl(adminKey: string, type: 'users' | 'transactions' | 'claims' | 'referrals'): string {
    return `${API_BASE}/admin/export/${type}`;
  },
};

