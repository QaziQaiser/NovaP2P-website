/**
 * LI.FI destination gas delivery ("Get gas" / LI.Fuel, executed by Gas.zip).
 *
 * The LI.FI widget already requests destination gas by itself: when LI.FI's gas suggestion says gas is
 * available for the destination chain and the receiving wallet is low on native gas, it adds
 * `fromAmountForGas` to the routes request and LI.FI inserts a `gasZip` step into each route.
 *
 * This module adds the pieces the widget does not do:
 *  - a fallback: LI.FI can report gas as "available" yet return no route once gas is added
 *    (seen live for e.g. BNB Chain -> Ethereum). The request interceptor then drops the gas part so the
 *    normal swap routes still load instead of "no routes found";
 *  - helpers to read the gas leg of a route (amount delivered, cost) for the quote summary;
 *  - a status check that confirms the gas actually arrived on the destination chain.
 */

export const LIFI_API_URL = 'https://li.quest/v1';

const GAS_ROUTABILITY_TTL_MS = 5 * 60 * 1000;
const GAS_SUGGESTION_TTL_MS = 60 * 1000;

const lifiHeaders = (apiKey?: string): Record<string, string> => (apiKey ? { 'x-lifi-api-key': apiKey } : {});

// ---------------------------------------------------------------------------------------------
// Fallback: keep normal routes working when LI.FI has no route that includes destination gas
// ---------------------------------------------------------------------------------------------

/** Pairs (and amount size) for which LI.FI returned no gas-inclusive route recently. */
const gasRoutability = new Map<string, { routable: boolean; at: number }>();

/** Last time the gas part was dropped, so the quote summary can tell the user why no gas is included. */
let lastGasFallback: { fromChainId: number; toChainId: number; at: number } | null = null;
const fallbackListeners = new Set<() => void>();

export const getLastGasFallback = () => lastGasFallback;
export const onGasFallback = (listener: () => void) => {
  fallbackListeners.add(listener);
  return () => {
    fallbackListeners.delete(listener);
  };
};

const routabilityKey = (p: any) =>
  [
    p.fromChainId,
    String(p.fromTokenAddress).toLowerCase(),
    p.toChainId,
    String(p.toTokenAddress).toLowerCase(),
    // order of magnitude of the amount: a small amount can fail with gas while a larger one works
    String(p.fromAmount ?? '').length,
  ].join(':');

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

    const key = routabilityKey(params);
    const cached = gasRoutability.get(key);
    let routable: boolean;
    if (cached && Date.now() - cached.at < GAS_ROUTABILITY_TTL_MS) {
      routable = cached.routable;
    } else {
      const probe = await fetch(`${LIFI_API_URL}/advanced/routes`, {
        method: 'POST',
        headers: options.headers,
        body: options.body,
        signal: options.signal,
      });
      if (probe.ok) {
        const data = await probe.json();
        routable = Array.isArray(data?.routes) && data.routes.length > 0;
      } else {
        // 4xx/5xx with gas requested: fall back to the normal swap rather than show an error
        routable = false;
      }
      gasRoutability.set(key, { routable, at: Date.now() });
    }

    if (routable) return options;

    delete params.fromAmountForGas;
    lastGasFallback = { fromChainId: Number(params.fromChainId), toChainId: Number(params.toChainId), at: Date.now() };
    fallbackListeners.forEach((listener) => listener());
    return { ...options, body: JSON.stringify(params) };
  } catch {
    // Aborted probe, network error or unexpected body: send the widget's request unchanged
    return options;
  }
};

// ---------------------------------------------------------------------------------------------
// Reading the gas leg of a route
// ---------------------------------------------------------------------------------------------

/** The LI.FI `gasZip` step inside a route, or null when the route does not deliver destination gas. */
export const findGasZipStep = (route: any): any | null => {
  for (const step of route?.steps ?? []) {
    if (step?.tool === 'gasZip') return step;
    for (const included of step?.includedSteps ?? []) {
      if (included?.tool === 'gasZip') return included;
    }
  }
  return null;
};

export interface GasSuggestion {
  available: boolean;
  message?: string;
  recommended?: { amount: string; amountUsd: string; token: { symbol: string; decimals: number; chainId: number } };
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

export interface GasQuote {
  /** Native gas delivered on the destination chain */
  gasAmount: number;
  gasSymbol: string;
  gasUSD: number;
  /** Part of the input spent on the gas leg */
  costAmount: number;
  costSymbol: string;
  costUSD: number;
  /** Swap output (excludes the gas leg) */
  toAmount: number;
  toSymbol: string;
  toAmountUSD: number;
  /** Swap output + delivered gas, in USD */
  totalReceivedUSD: number;
  destinationChainId: number;
}

const units = (raw: string | undefined, decimals: number) => (raw ? Number(raw) / 10 ** decimals : 0);

/** Builds the quote summary for a route that includes a gas leg; null when it has none. */
export const buildGasQuote = async (route: any, apiKey?: string): Promise<GasQuote | null> => {
  const gasStep = findGasZipStep(route);
  if (!gasStep) return null;

  const payToken = gasStep.action?.fromToken;
  const suggestion = await fetchGasSuggestion(
    route.toChainId,
    gasStep.action?.fromChainId ?? route.fromChainId,
    payToken?.address ?? route.fromToken?.address ?? '',
    apiKey
  );
  if (!suggestion?.available || !suggestion.recommended) return null;

  const gasToken = suggestion.recommended.token;
  const gasAmount = units(suggestion.recommended.amount, gasToken.decimals);
  const gasUSD = Number(suggestion.recommended.amountUsd) || 0;

  // The gasZip step converts this much of the input into destination gas
  const spentRaw =
    gasStep.estimate?.fromAmount && gasStep.estimate?.toAmount
      ? (BigInt(gasStep.estimate.fromAmount) - BigInt(gasStep.estimate.toAmount)).toString()
      : suggestion.fromAmount;
  const costAmount = units(spentRaw, payToken?.decimals ?? 18);
  const costUSD = costAmount * (Number(payToken?.priceUSD) || 0);

  const toAmount = units(route.toAmount, route.toToken?.decimals ?? 18);
  const toAmountUSD = Number(route.toAmountUSD) || 0;

  return {
    gasAmount,
    gasSymbol: gasToken.symbol,
    gasUSD,
    costAmount,
    costSymbol: payToken?.symbol ?? '',
    costUSD,
    toAmount,
    toSymbol: route.toToken?.symbol ?? '',
    toAmountUSD,
    totalReceivedUSD: toAmountUSD + gasUSD,
    destinationChainId: route.toChainId,
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
