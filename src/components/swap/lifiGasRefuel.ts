/**
 * LI.FI destination gas delivery ("Get gas" / LI.Fuel, executed by Gas.zip).
 *
 * The LI.FI widget already requests destination gas by itself: when LI.FI's gas suggestion says gas is
 * available for the destination chain and the receiving wallet is low on native gas, it adds
 * `fromAmountForGas` to the routes request and LI.FI inserts a `gasZip` step into each route.
 *
 * This module adds what the widget does not do:
 *  - route comparison: for a gas request it fetches gas routes and normal routes side by side and keeps
 *    gas only when a gas route exists and is competitive with the best normal route. Otherwise the
 *    normal swap is quoted, so a swap is never blocked or made expensive by gas delivery;
 *  - the reason for every decision, for the quote summary;
 *  - helpers to read the gas leg of a route (amount delivered, cost, total fees);
 *  - a status check that confirms the gas actually arrived on the destination chain.
 */

export const LIFI_API_URL = 'https://li.quest/v1';

/** A gas route is "competitive" when its output + delivered gas is within this of the best normal route */
const GAS_TOLERANCE_MIN_USD = 0.1;
const GAS_TOLERANCE_PCT = 0.003;

const DECISION_TTL_MS = 60 * 1000;
const GAS_SUGGESTION_TTL_MS = 60 * 1000;

const lifiHeaders = (apiKey?: string): Record<string, string> => (apiKey ? { 'x-lifi-api-key': apiKey } : {});
const units = (raw: string | undefined, decimals: number) => (raw ? Number(raw) / 10 ** decimals : 0);

// ---------------------------------------------------------------------------------------------
// Gas suggestion (LI.FI's own support check for a destination chain)
// ---------------------------------------------------------------------------------------------

export interface GasSuggestion {
  available: boolean;
  message?: string;
  recommended?: { amount: string; amountUsd: string; token: { symbol: string; decimals: number; chainId: number } };
  limit?: { amount: string; amountUsd: string };
  fromAmount?: string;
}

const suggestionCache = new Map<string, { at: number; data: Promise<GasSuggestion | null> }>();

/** LI.FI gas suggestion: how much native gas is delivered on `toChainId` and what it costs in `fromToken`. */
export const fetchGasSuggestion = (
  toChainId: number,
  fromChainId: number,
  fromToken: string,
  apiKey?: string
): Promise<GasSuggestion | null> => {
  const key = `${toChainId}:${fromChainId}:${fromToken.toLowerCase()}`;
  const cached = suggestionCache.get(key);
  if (cached && Date.now() - cached.at < GAS_SUGGESTION_TTL_MS) return cached.data;
  const data = fetch(
    `${LIFI_API_URL}/gas/suggestion/${toChainId}?fromChain=${fromChainId}&fromToken=${encodeURIComponent(fromToken)}`,
    { headers: lifiHeaders(apiKey) }
  )
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  suggestionCache.set(key, { at: Date.now(), data });
  return data;
};

// ---------------------------------------------------------------------------------------------
// Route comparison: gas route only when it exists and is competitive
// ---------------------------------------------------------------------------------------------

export type GasDecision =
  | { kind: 'kept'; at: number }
  | { kind: 'no-route'; reason?: string; at: number }
  | { kind: 'not-competitive'; extraCostUSD: number; at: number };

/** Decisions per swap request (chains, tokens, amount), read by the quote summary */
const decisions = new Map<string, GasDecision>();
const decisionListeners = new Set<() => void>();

const requestKey = (fromChainId: any, fromToken: any, toChainId: any, toToken: any, fromAmount: any) =>
  [fromChainId, String(fromToken).toLowerCase(), toChainId, String(toToken).toLowerCase(), String(fromAmount)].join(':');

export const getGasDecisionForRoute = (route: any): GasDecision | null => {
  const d = decisions.get(
    requestKey(route?.fromChainId, route?.fromToken?.address, route?.toChainId, route?.toToken?.address, route?.fromAmount)
  );
  return d && Date.now() - d.at < DECISION_TTL_MS * 2 ? d : null;
};

export const onGasDecision = (listener: () => void) => {
  decisionListeners.add(listener);
  return () => {
    decisionListeners.delete(listener);
  };
};

const recordDecision = (key: string, decision: GasDecision) => {
  decisions.set(key, decision);
  decisionListeners.forEach((listener) => listener());
};

export const findGasZipStep = (route: any): any | null => {
  for (const step of route?.steps ?? []) {
    if (step?.tool === 'gasZip') return step;
    for (const included of step?.includedSteps ?? []) {
      if (included?.tool === 'gasZip') return included;
    }
  }
  return null;
};

/** Gas.zip's own error for a failed gas leg, e.g. "Quote: Chain Throttled" */
const gasZipFailure = (data: any): string | undefined => {
  for (const failed of data?.unavailableRoutes?.failed ?? []) {
    for (const errors of Object.values(failed?.subpaths ?? {}) as any[]) {
      for (const e of errors ?? []) {
        if (e?.tool === 'gasZip' && e?.message) return String(e.message);
      }
    }
  }
  return undefined;
};

const postRoutes = async (options: any, body: string) => {
  const res = await fetch(`${LIFI_API_URL}/advanced/routes`, {
    method: 'POST',
    headers: options.headers,
    body,
    signal: options.signal,
  });
  return res.ok ? res.json() : null;
};

/**
 * LI.FI SDK request interceptor (passed through the widget's `sdkConfig`).
 * Only touches POST /advanced/routes requests that ask for destination gas; everything else
 * (quotes, step transactions, status, tokens, ...) passes through unchanged.
 */
export const gasFallbackRequestInterceptor = async (options: any): Promise<any> => {
  try {
    if (options?.method !== 'POST' || typeof options.body !== 'string' || !options.body.includes('fromAmountForGas')) {
      return options;
    }
    const params = JSON.parse(options.body);
    // A routes request has these top-level fields; a step transaction body does not
    if (!params?.fromAmountForGas || params.fromChainId === undefined || params.toChainId === undefined) {
      return options;
    }

    const key = requestKey(params.fromChainId, params.fromTokenAddress, params.toChainId, params.toTokenAddress, params.fromAmount);
    const { fromAmountForGas: _gas, ...plainParams } = params;
    const plainBody = JSON.stringify(plainParams);

    let decision = decisions.get(key);
    if (!decision || Date.now() - decision.at >= DECISION_TTL_MS) {
      const apiKey = options.headers?.['x-lifi-api-key'];
      const [withGas, plain, suggestion] = await Promise.all([
        postRoutes(options, options.body),
        postRoutes(options, plainBody),
        fetchGasSuggestion(Number(params.toChainId), Number(params.fromChainId), String(params.fromTokenAddress), apiKey),
      ]);
      const gasRoutes = (withGas?.routes ?? []).filter((r: any) => findGasZipStep(r));
      if (!gasRoutes.length) {
        decision = { kind: 'no-route', reason: gasZipFailure(withGas), at: Date.now() };
      } else {
        const gasUSD = Number(suggestion?.recommended?.amountUsd) || 0;
        const bestGasTotal = Math.max(...gasRoutes.map((r: any) => Number(r.toAmountUSD) || 0)) + gasUSD;
        const bestPlain = Math.max(0, ...(plain?.routes ?? []).map((r: any) => Number(r.toAmountUSD) || 0));
        const tolerance = Math.max(GAS_TOLERANCE_MIN_USD, bestPlain * GAS_TOLERANCE_PCT);
        decision =
          bestPlain > 0 && bestGasTotal < bestPlain - tolerance
            ? { kind: 'not-competitive', extraCostUSD: bestPlain - bestGasTotal, at: Date.now() }
            : { kind: 'kept', at: Date.now() };
      }
      recordDecision(key, decision);
    }

    return decision.kind === 'kept' ? options : { ...options, body: plainBody };
  } catch {
    // Aborted probe, network error or unexpected body: send the widget's request unchanged
    return options;
  }
};

// ---------------------------------------------------------------------------------------------
// Quote summary for a route
// ---------------------------------------------------------------------------------------------

export type GasStatus = 'included' | 'unavailable' | 'normal';

export interface RouteGasSummary {
  status: GasStatus;
  /** Plain-language reason when gas is not included */
  reason?: string;
  destinationChainId: number;
  /** Swap output (excludes the gas leg) */
  toAmount: number;
  toSymbol: string;
  toAmountUSD: number;
  /** Destination gas, when included */
  gasAmount?: number;
  gasSymbol?: string;
  gasUSD?: number;
  gasCostAmount?: number;
  gasCostSymbol?: string;
  gasCostUSD?: number;
  /** Nova + LI.FI + bridge fees, network gas and gas delivery cost, in USD */
  totalFeesUSD: number;
  /** Swap output + delivered gas, in USD */
  totalReceivedUSD: number;
}

/** Bridge, Nova and LI.FI fees on a route, counted once (a step's feeCosts already include its included steps) */
export const routeFeesUSD = (route: any): number => {
  let total = 0;
  for (const step of route?.steps ?? []) {
    const parts = step?.includedSteps?.length ? step.includedSteps : [step];
    for (const part of parts) {
      for (const fee of part?.estimate?.feeCosts ?? []) total += Number(fee?.amountUSD) || 0;
    }
  }
  return total;
};

const plainReason = (message: string | undefined, chain: string, nativeSymbol?: string): string => {
  const m = (message ?? '').toLowerCase();
  if (m.includes('outbound transfers are disabled')) return `Gas.zip has paused gas deliveries to ${chain}.`;
  if (m.includes('insufficient gaszip destination liquidity'))
    return `Gas.zip doesn't have enough ${nativeSymbol ?? 'gas'} on ${chain} to deliver right now.`;
  if (m.includes('chain throttled')) return `Gas.zip is limiting gas deliveries to ${chain} right now.`;
  if (m.includes('failed to calculate')) return `LI.FI can't price gas on ${chain} right now.`;
  if (m.includes('not supported') || m.includes('missing a recommended amount'))
    return `LI.FI doesn't offer gas delivery to ${chain}.`;
  return `LI.FI found no route that delivers gas to ${chain}.`;
};

export const buildRouteGasSummary = async (route: any, chainName: string, apiKey?: string): Promise<RouteGasSummary | null> => {
  if (!route || route.fromChainId === route.toChainId) return null;

  const toAmount = units(route.toAmount, route.toToken?.decimals ?? 18);
  const toAmountUSD = Number(route.toAmountUSD) || 0;
  const feesUSD = routeFeesUSD(route) + (Number(route.gasCostUSD) || 0);
  const base = {
    destinationChainId: route.toChainId,
    toAmount,
    toSymbol: route.toToken?.symbol ?? '',
    toAmountUSD,
  };

  const gasStep = findGasZipStep(route);
  const payToken = gasStep?.action?.fromToken ?? route.fromToken;
  const suggestion = await fetchGasSuggestion(
    route.toChainId,
    gasStep?.action?.fromChainId ?? route.fromChainId,
    payToken?.address ?? '',
    apiKey
  );
  const nativeSymbol = suggestion?.recommended?.token?.symbol;

  if (gasStep && suggestion?.recommended) {
    const gasToken = suggestion.recommended.token;
    const gasAmount = units(suggestion.recommended.amount, gasToken.decimals);
    const gasUSD = Number(suggestion.recommended.amountUsd) || 0;
    // The gasZip step converts this much of the input into destination gas
    const spentRaw =
      gasStep.estimate?.fromAmount && gasStep.estimate?.toAmount
        ? (BigInt(gasStep.estimate.fromAmount) - BigInt(gasStep.estimate.toAmount)).toString()
        : suggestion.fromAmount;
    const gasCostAmount = units(spentRaw, payToken?.decimals ?? 18);
    const gasCostUSD = gasCostAmount * (Number(payToken?.priceUSD) || 0);
    return {
      ...base,
      status: 'included',
      gasAmount,
      gasSymbol: gasToken.symbol,
      gasUSD,
      gasCostAmount,
      gasCostSymbol: payToken?.symbol ?? '',
      gasCostUSD,
      totalFeesUSD: feesUSD + gasCostUSD,
      totalReceivedUSD: toAmountUSD + gasUSD,
    };
  }

  const common = { ...base, totalFeesUSD: feesUSD, totalReceivedUSD: toAmountUSD };
  const decision = getGasDecisionForRoute(route);
  if (decision?.kind === 'no-route') {
    return { ...common, status: 'unavailable', reason: plainReason(decision.reason, chainName, nativeSymbol) };
  }
  if (decision?.kind === 'not-competitive') {
    return {
      ...common,
      status: 'normal',
      reason: `Gas delivery to ${chainName} would cost about $${decision.extraCostUSD.toFixed(2)} more than the best normal route, so the normal route is shown.`,
    };
  }
  if (suggestion && !suggestion.available) {
    return { ...common, status: 'unavailable', reason: plainReason(suggestion.message, chainName, nativeSymbol) };
  }
  return {
    ...common,
    status: 'normal',
    reason: `Your wallet already has ${nativeSymbol ?? 'gas'} on ${chainName}, or "Get gas" is switched off.`,
  };
};

// ---------------------------------------------------------------------------------------------
// Delivery verification after the swap
// ---------------------------------------------------------------------------------------------

export interface GasDeliveryStatus {
  status: 'NOT_FOUND' | 'PENDING' | 'DONE' | string;
  amount?: number;
  symbol?: string;
  txLink?: string;
}

/** LI.FI gas status for the source transaction (GET /v1/gas/status). */
export const fetchGasDeliveryStatus = async (txHash: string, apiKey?: string): Promise<GasDeliveryStatus | null> => {
  try {
    const res = await fetch(`${LIFI_API_URL}/gas/status?txHash=${encodeURIComponent(txHash)}`, {
      headers: lifiHeaders(apiKey),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const receiving = data?.receiving;
    return {
      status: data?.status ?? 'NOT_FOUND',
      amount: receiving?.amount && receiving?.token ? units(receiving.amount, receiving.token.decimals) : undefined,
      symbol: receiving?.token?.symbol,
      txLink: receiving?.txLink,
    };
  } catch {
    return null;
  }
};

/** First real source-chain transaction hash of an executed route. */
export const getSourceTxHash = (route: any): string | null => {
  for (const step of route?.steps ?? []) {
    for (const entry of [...(step.execution?.actions ?? []), ...(step.execution?.process ?? [])]) {
      if (entry?.txHash) return entry.txHash;
    }
  }
  return null;
};
