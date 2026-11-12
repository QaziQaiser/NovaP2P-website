export type AffiliateRole = 'partner' | 'bdm';

export interface AffiliateStatusResponse {
  walletAddress: string;
  isApproved: boolean;
  status: 'active' | 'pending_activation' | 'inactive' | 'pending' | 'rejected' | 'none';
  role: AffiliateRole | null;
  affiliate: {
    id: string;
    wallet_address: string;
    role: AffiliateRole;
    full_name: string;
    email: string;
    telegram_username: string;
    bdm_wallet_address: string | null;
    status: string;
    total_referred_volume_usd: number;
    total_earnings_usd: number;
    pending_balance_usd: number;
    paid_balance_usd: number;
    active_users_count: number;
    created_at: string;
  } | null;
  application: {
    id: string;
    role: AffiliateRole;
    wallet_address: string;
    full_name: string;
    email: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
  } | null;
}

export interface PartnerCommissionItem {
  id: string;
  date: string;
  referredUser: string;
  swapVolumeUSD: number;
  platformFeeUSD: number;
  commissionRatePct: number;
  effectiveVolumePct: number;
  commissionAmountUSD: number;
  status: 'paid' | 'pending';
}

export interface PartnerReferralItem {
  id: string;
  walletAddress: string;
  totalVolumeUSD: number;
  swapsCount: number;
  joinedAt: string;
  lastSwapAt: string | null;
}

export interface AffiliatePayoutItem {
  id: string;
  affiliate_wallet_address: string;
  affiliate_role: AffiliateRole;
  amount_usd: number;
  payout_address: string;
  preferred_network: string;
  preferred_token: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  tx_hash: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface PartnerDashboardData {
  partner: {
    walletAddress: string;
    fullName: string;
    email: string;
    telegramUsername: string;
    status: string;
    bdmWalletAddress: string | null;
    referralLink: string;
    commissionRatePct: number;
    effectiveVolumePct: number;
    createdAt: string;
  };
  stats: {
    totalEarningsUSD: number;
    pendingBalanceUSD: number;
    paidBalanceUSD: number;
    referredVolumeUSD: number;
    activeUsers: number;
    referralsThisMonth: number;
    minWithdrawalUSD: number;
  };
  commissions: PartnerCommissionItem[];
  referrals: PartnerReferralItem[];
  payouts: AffiliatePayoutItem[];
}

export interface ManagedPartnerRow {
  id: string;
  walletAddress: string;
  fullName: string;
  telegramUsername: string;
  referredVolumeUSD: number;
  partnerEarningsUSD: number;
  bdmOverrideUSD: number;
  activeUsersCount: number;
  status: 'active' | 'pending_activation' | 'inactive';
  joinedAt: string;
}

export interface BdmDashboardData {
  bdm: {
    walletAddress: string;
    fullName: string;
    email: string;
    telegramUsername: string;
    status: string;
    referralLink: string;
    directCommissionRatePct: number;
    overrideRatePct: number;
    createdAt: string;
  };
  stats: {
    totalManagedVolumeUSD: number;
    partnersOnlyVolumeUSD: number;
    totalEarningsUSD: number;
    pendingPayoutUSD: number;
    paidBalanceUSD: number;
    activePartnersCount: number;
    totalPartnersCount: number;
    minWithdrawalUSD: number;
  };
  partners: ManagedPartnerRow[];
  commissions: {
    id: string;
    date: string;
    commissionType: 'direct_bdm' | 'bdm_override';
    sourcePartnerWallet: string | null;
    referredUser: string;
    swapVolumeUSD: number;
    commissionRatePct: number;
    commissionAmountUSD: number;
    status: 'paid' | 'pending';
  }[];
  payouts: AffiliatePayoutItem[];
}

const API_BASE = '/api/affiliate';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const affiliateApi = {
  getWalletStatus: (walletAddress: string) =>
    requestJson<AffiliateStatusResponse>(`${API_BASE}/status/${encodeURIComponent(walletAddress)}`),

  submitApplication: (payload: {
    role: AffiliateRole;
    walletAddress: string;
    fullName: string;
    email: string;
    telegramUsername: string;
    twitterLink: string;
    youtubeLink?: string;
    telegramChannelLink: string;
    audienceSize?: string;
    marketingExperience?: string;
    manageablePartnersCount?: string;
    message?: string;
    bdmWalletAddress?: string;
  }) =>
    requestJson<{ success: boolean; applicationId: string; role: AffiliateRole; status: string; message: string }>(
      `${API_BASE}/apply`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  trackReferral: (refWallet: string, traderWallet?: string | null) =>
    requestJson<{ success: boolean; valid: boolean; referrerRole: AffiliateRole | null; bound: boolean }>(
      `${API_BASE}/track-ref`,
      {
        method: 'POST',
        body: JSON.stringify({ refWallet, traderWallet: traderWallet || null }),
      }
    ).catch(() => ({ success: false, valid: false, referrerRole: null, bound: false })),

  getPartnerDashboard: (walletAddress: string) =>
    requestJson<PartnerDashboardData>(`${API_BASE}/partner/dashboard/${encodeURIComponent(walletAddress)}`),

  getBdmDashboard: (walletAddress: string) =>
    requestJson<BdmDashboardData>(`${API_BASE}/bdm/dashboard/${encodeURIComponent(walletAddress)}`),

  requestPayout: (payload: {
    walletAddress: string;
    payoutAddress: string;
    preferredNetwork: string;
    preferredToken?: string;
  }) =>
    requestJson<{ success: boolean; payoutId: string; amountUSD: number; status: string; message: string }>(
      `${API_BASE}/payout/request`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // Admin methods
  getAdminOverview: (adminKey: string) =>
    requestJson<{ applications: any[]; affiliates: any[]; payouts: any[] }>(`${API_BASE}/admin/overview`, {
      headers: { 'x-admin-key': adminKey },
    }),

  reviewApplication: (
    adminKey: string,
    id: string,
    payload: { action: 'approve' | 'reject'; assignRole?: AffiliateRole; bdmWalletAddress?: string; adminNotes?: string }
  ) =>
    requestJson<{ success: boolean; status: string }>(`${API_BASE}/admin/applications/${id}/review`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(payload),
    }),

  updateAffiliate: (
    adminKey: string,
    walletAddress: string,
    payload: { status?: 'active' | 'pending_activation' | 'inactive'; bdmWalletAddress?: string | null }
  ) =>
    requestJson<{ success: boolean }>(`${API_BASE}/admin/affiliates/${encodeURIComponent(walletAddress)}/update`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(payload),
    }),

  payPayout: (adminKey: string, id: string, payload: { txHash: string; adminNotes?: string }) =>
    requestJson<{ success: boolean; status: string }>(`${API_BASE}/admin/payouts/${id}/pay`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(payload),
    }),
};

