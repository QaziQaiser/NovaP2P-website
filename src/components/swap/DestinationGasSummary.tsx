import React, { useEffect, useRef, useState } from 'react';
import { widgetEvents, WidgetEvent } from '@lifi/widget';
import {
  LIFI_API_URL,
  buildRouteGasSummary,
  fetchGasDeliveryStatus,
  findGasZipStep,
  getSourceTxHash,
  onGasDecision,
  GasDeliveryStatus,
  RouteGasSummary,
} from './lifiGasRefuel';

// Chain names from LI.FI (one request per page load); a few common ones as fallback
const FALLBACK_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  1151111081099710: 'Solana',
};
let chainNamesPromise: Promise<Record<number, string>> | null = null;
const loadChainNames = (apiKey?: string) => {
  if (!chainNamesPromise) {
    chainNamesPromise = fetch(`${LIFI_API_URL}/chains?chainTypes=EVM,SVM,UTXO,MVM,TVM`, {
      headers: apiKey ? { 'x-lifi-api-key': apiKey } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const names: Record<number, string> = { ...FALLBACK_NAMES };
        for (const chain of data?.chains ?? []) {
          if (!FALLBACK_NAMES[chain.id]) names[chain.id] = chain.name;
        }
        return names;
      })
      .catch(() => ({ ...FALLBACK_NAMES }));
  }
  return chainNamesPromise;
};

const fmt = (n: number, max = 6) =>
  n === 0 ? '0' : n < 10 ** -max ? `<${10 ** -max}` : n.toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 4 : max });
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_POLL_MS = 10_000;
const STATUS_POLL_MAX = 60; // ~10 minutes

const BADGES: Record<RouteGasSummary['status'], { label: string; className: string }> = {
  included: { label: 'Destination Gas Included', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  unavailable: { label: 'Gas Delivery Unavailable', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  normal: { label: 'Normal Swap Route', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/**
 * Quote summary for a cross-chain route: whether LI.FI destination gas is included, the gas amount and
 * its cost, total fees and the final estimated amount received. Hidden for same-chain swaps.
 */
export const DestinationGasSummary: React.FC<{ apiKey?: string }> = ({ apiKey }) => {
  const [summary, setSummary] = useState<RouteGasSummary | null>(null);
  const [chainNames, setChainNames] = useState<Record<number, string>>(FALLBACK_NAMES);
  const [delivery, setDelivery] = useState<(GasDeliveryStatus & { chainId: number; txHash: string }) | null>(null);
  const currentRoute = useRef<any>(null);
  const requestId = useRef(0);
  const namesRef = useRef(chainNames);

  const chainName = (id?: number) => (id && chainNames[id]) || 'the destination chain';

  useEffect(() => {
    let alive = true;
    loadChainNames(apiKey).then((names) => {
      if (!alive) return;
      namesRef.current = names;
      setChainNames(names);
    });
    return () => {
      alive = false;
    };
  }, [apiKey]);

  useEffect(() => {
    const showRoute = async (route: any) => {
      currentRoute.current = route;
      const id = ++requestId.current;
      if (!route) {
        setSummary(null);
        return;
      }
      const name = namesRef.current[route.toChainId] || 'the destination chain';
      const next = await buildRouteGasSummary(route, name, apiKey);
      if (id === requestId.current) setSummary(next);
    };

    const onRoutes = (routes: any[]) => showRoute(routes?.[0] ?? null);
    const onSelected = (data: any) => showRoute(data?.route ?? null);
    const onField = (data: any) => {
      // Inputs changed: the old quote no longer applies until LI.FI returns new routes
      if (data?.fieldName && data.fieldName !== 'toAddress') {
        requestId.current++;
        currentRoute.current = null;
        setSummary(null);
        setDelivery(null);
      }
    };
    const offDecision = onGasDecision(() => {
      if (currentRoute.current) showRoute(currentRoute.current);
    });

    widgetEvents.on(WidgetEvent.AvailableRoutes, onRoutes);
    widgetEvents.on(WidgetEvent.RouteSelected, onSelected);
    widgetEvents.on(WidgetEvent.FormFieldChanged, onField);
    return () => {
      widgetEvents.off(WidgetEvent.AvailableRoutes, onRoutes);
      widgetEvents.off(WidgetEvent.RouteSelected, onSelected);
      widgetEvents.off(WidgetEvent.FormFieldChanged, onField);
      offDecision();
    };
  }, [apiKey]);

  // After a swap with a gas leg completes, confirm the gas arrived via LI.FI's gas status
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const onCompleted = (route: any) => {
      if (!findGasZipStep(route)) return;
      const txHash = getSourceTxHash(route);
      if (!txHash) return;
      const chainId = route.toChainId;
      setDelivery({ status: 'PENDING', chainId, txHash });
      let attempts = 0;
      const poll = async () => {
        if (disposed) return;
        attempts++;
        const status = await fetchGasDeliveryStatus(txHash, apiKey);
        if (disposed) return;
        if (status?.status === 'DONE') {
          setDelivery({ ...status, chainId, txHash });
          return;
        }
        if (attempts >= STATUS_POLL_MAX) {
          setDelivery({ status: 'NOT_FOUND', chainId, txHash });
          return;
        }
        timer = setTimeout(poll, STATUS_POLL_MS);
      };
      poll();
    };

    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onCompleted);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onCompleted);
    };
  }, [apiKey]);

  if (!summary && !delivery) return null;

  const badge = summary ? BADGES[summary.status] : null;

  return (
    <div className="w-full max-w-[436px] mx-auto mt-3 px-4 sm:px-0">
      {summary && badge && (
        <div className="rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm px-4 py-3 text-[13px] text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-semibold text-slate-900">Quote details</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Estimated swap output</dt>
              <dd className="text-right font-medium">
                {fmt(summary.toAmount, 4)} {summary.toSymbol}{' '}
                <span className="text-slate-400">(~{usd(summary.toAmountUSD)})</span>
              </dd>
            </div>
            {summary.status === 'included' && (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Gas on {chainName(summary.destinationChainId)}</dt>
                  <dd className="text-right font-medium">
                    {fmt(summary.gasAmount ?? 0)} {summary.gasSymbol}{' '}
                    <span className="text-slate-400">(~{usd(summary.gasUSD ?? 0)})</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Gas delivery cost</dt>
                  <dd className="text-right font-medium">
                    {fmt(summary.gasCostAmount ?? 0)} {summary.gasCostSymbol}{' '}
                    <span className="text-slate-400">(~{usd(summary.gasCostUSD ?? 0)})</span>
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Total fees</dt>
              <dd className="text-right font-medium">~{usd(summary.totalFeesUSD)}</dd>
            </div>
            <div className="flex justify-between gap-3 pt-1 border-t border-slate-100">
              <dt className="text-slate-500">Final estimated received</dt>
              <dd className="text-right font-semibold text-slate-900">
                {summary.status === 'included'
                  ? `${fmt(summary.toAmount, 4)} ${summary.toSymbol} + ${fmt(summary.gasAmount ?? 0)} ${summary.gasSymbol}`
                  : `${fmt(summary.toAmount, 4)} ${summary.toSymbol}`}{' '}
                <span className="text-slate-400 font-medium">(~{usd(summary.totalReceivedUSD)})</span>
              </dd>
            </div>
          </dl>
          {summary.reason && <p className="mt-2 text-[12px] text-slate-500">{summary.reason}</p>}
          {summary.status === 'included' && (
            <p className="mt-2 text-[11px] text-slate-400">
              Gas delivered by Gas.zip via LI.FI. Turn off "Get gas" in the swap card to skip it.
            </p>
          )}
        </div>
      )}

      {delivery && (
        <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-[12px] text-slate-600">
          {delivery.status === 'DONE' ? (
            <>
              Gas delivered on {chainName(delivery.chainId)}
              {delivery.amount !== undefined && `: ${fmt(delivery.amount)} ${delivery.symbol ?? ''}`}
              {delivery.txLink && (
                <>
                  {' '}
                  <a href={delivery.txLink} target="_blank" rel="noopener noreferrer" className="text-[#4F7DF3] underline">
                    View transaction
                  </a>
                </>
              )}
            </>
          ) : delivery.status === 'PENDING' ? (
            <>Confirming gas delivery on {chainName(delivery.chainId)}…</>
          ) : (
            <>
              Gas delivery status not reported yet. Check your {chainName(delivery.chainId)} wallet balance or{' '}
              <a
                href={`https://scan.li.fi/tx/${delivery.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4F7DF3] underline"
              >
                track it on LI.FI
              </a>
              .
            </>
          )}
        </div>
      )}
    </div>
  );
};
