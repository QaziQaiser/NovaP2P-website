import { useEffect, useState } from 'react';
import { affiliateApi, type AffiliateRatesResponse } from './affiliateApi';

// Shown until the server answers (and if it can't be reached); matches the original program rates.
export const DEFAULT_AFFILIATE_RATES: AffiliateRatesResponse = {
  partnerRatePct: 20,
  bdmDirectRatePct: 20,
  bdmOverrideRatePct: 10,
  platformFeePct: 0.5,
  partnerVolumePct: 0.1,
  bdmDirectVolumePct: 0.1,
  bdmOverrideVolumePct: 0.05,
};

let cached: AffiliateRatesResponse | null = null;
let inflight: Promise<AffiliateRatesResponse> | null = null;

function loadRates(): Promise<AffiliateRatesResponse> {
  if (!inflight) {
    inflight = affiliateApi
      .getRates()
      .then((r) => {
        cached = { ...DEFAULT_AFFILIATE_RATES, ...r };
        return cached;
      })
      .catch(() => {
        inflight = null; // retry on the next mount
        return cached || DEFAULT_AFFILIATE_RATES;
      });
  }
  return inflight;
}

/** Formats a percentage without trailing zeros: 20 -> "20", 0.1 -> "0.10", 0.05 -> "0.05". */
export function fmtPct(value: number, volume = false): string {
  if (volume) {
    const exact = String(Number(value.toFixed(4)));
    const decimals = exact.includes('.') ? exact.split('.')[1].length : 0;
    return decimals > 2 ? exact : value.toFixed(2);
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** Current Partner / BDM commission rates set in the admin panel. */
export function useAffiliateRates(): AffiliateRatesResponse {
  const [rates, setRates] = useState<AffiliateRatesResponse>(cached || DEFAULT_AFFILIATE_RATES);
  useEffect(() => {
    let alive = true;
    loadRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, []);
  return rates;
}
