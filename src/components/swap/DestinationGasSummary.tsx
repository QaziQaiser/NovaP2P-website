import React, { useEffect, useRef, useState } from 'react';
import { widgetEvents, WidgetEvent } from '@lifi/widget';
import {
  buildGasQuote,
  fetchGasDeliveryStatus,
  findGasZipStep,
  getLastGasFallback,
  getSourceTxHash,
  onGasFallback,
  GasDeliveryStatus,
  GasQuote,
} from './lifiGasRefuel';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  1151111081099710: 'Solana',
};
const chainName = (id?: number) => (id && CHAIN_NAMES[id]) || 'the destination chain';

const fmt = (n: number, max = 6) =>
  n === 0 ? '0' : n < 10 ** -max ? `<${10 ** -max}` : n.toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 4 : max });
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_POLL_MS = 10_000;
const STATUS_POLL_MAX = 60; // ~10 minutes

/**
 * Quote summary for LI.FI destination gas delivery. Renders nothing unless the selected route
 * includes LI.FI's gas leg (gasZip step) or LI.FI could not add gas to the current route.
 */
export const DestinationGasSummary: React.FC<{ apiKey?: string }> = ({ apiKey }) => {
  const [quote, setQuote] = useState<GasQuote | null>(null);
  const [fallbackChain, setFallbackChain] = useState<number | null>(null);
  const [delivery, setDelivery] = useState<(GasDeliveryStatus & { chainId: number }) | null>(null);
  const currentRoute = useRef<any>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const showRoute = async (route: any) => {
      currentRoute.current = route;
      const id = ++requestId.current;
      if (!route) {
        setQuote(null);
        setFallbackChain(null);
        return;
      }
      const next = await buildGasQuote(route, apiKey);
      if (id !== requestId.current) return;
      setQuote(next);

      // No gas leg although gas was requested: tell the user the swap runs without it
      const fb = getLastGasFallback();
      const fellBack =
        !findGasZipStep(route) &&
        fb &&
        fb.fromChainId === route.fromChainId &&
        fb.toChainId === route.toChainId &&
        Date.now() - fb.at < 2 * 60 * 1000;
      setFallbackChain(fellBack ? route.toChainId : null);
    };

    const onRoutes = (routes: any[]) => showRoute(routes?.[0] ?? null);
    const onSelected = (data: any) => showRoute(data?.route ?? null);
    const onField = (data: any) => {
      // Inputs changed: the old quote no longer applies until LI.FI returns new routes
      if (data?.fieldName && data.fieldName !== 'toAddress') {
        requestId.current++;
        setQuote(null);
        setFallbackChain(null);
        setDelivery(null);
      }
    };
    const offFallback = onGasFallback(() => {
      if (currentRoute.current) showRoute(currentRoute.current);
    });

    widgetEvents.on(WidgetEvent.AvailableRoutes, onRoutes);
    widgetEvents.on(WidgetEvent.RouteSelected, onSelected);
    widgetEvents.on(WidgetEvent.FormFieldChanged, onField);
    return () => {
      widgetEvents.off(WidgetEvent.AvailableRoutes, onRoutes);
      widgetEvents.off(WidgetEvent.RouteSelected, onSelected);
      widgetEvents.off(WidgetEvent.FormFieldChanged, onField);
      offFallback();
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
      setDelivery({ status: 'PENDING', chainId });
      let attempts = 0;
      const poll = async () => {
        if (disposed) return;
        attempts++;
        const status = await fetchGasDeliveryStatus(txHash, apiKey);
        if (disposed) return;
        if (status?.status === 'DONE') {
          setDelivery({ ...status, chainId });
          return;
        }
        if (attempts >= STATUS_POLL_MAX) {
          setDelivery({ status: 'NOT_FOUND', chainId });
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

  if (!quote && !fallbackChain && !delivery) return null;

  return (
    <div className="w-full max-w-[436px] mx-auto mt-3 px-4 sm:px-0">
      {quote && (
        <div className="rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm px-4 py-3 text-[13px] text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
            <span aria-hidden>⛽</span>
            <span>Includes {quote.gasSymbol} gas on {chainName(quote.destinationChainId)}</span>
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Gas delivered</dt>
              <dd className="text-right font-medium">
                {fmt(quote.gasAmount)} {quote.gasSymbol} <span className="text-slate-400">(~{usd(quote.gasUSD)})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Gas cost</dt>
              <dd className="text-right font-medium">
                {fmt(quote.costAmount)} {quote.costSymbol} <span className="text-slate-400">(~{usd(quote.costUSD)})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">You receive</dt>
              <dd className="text-right font-medium">
                {fmt(quote.toAmount, 4)} {quote.toSymbol} + {fmt(quote.gasAmount)} {quote.gasSymbol}
              </dd>
            </div>
            <div className="flex justify-between gap-3 pt-1 border-t border-slate-100">
              <dt className="text-slate-500">Estimated total value</dt>
              <dd className="text-right font-semibold text-slate-900">~{usd(quote.totalReceivedUSD)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">Gas delivered by Gas.zip via LI.FI. Turn off "Get gas" in the swap card to skip it.</p>
        </div>
      )}

      {!quote && fallbackChain && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-[12px] text-slate-600">
          Gas delivery to {chainName(fallbackChain)} isn't available for this route right now, so the swap runs without it.
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
            <>Gas delivery status not reported yet. Check your {chainName(delivery.chainId)} wallet balance.</>
          )}
        </div>
      )}
    </div>
  );
};
