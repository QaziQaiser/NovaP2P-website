// Data hooks for the Futures tab: markets, the user's account, and the one-time trading setup.
import { useCallback, useEffect, useRef, useState } from 'react';
import { info, isBuilderFeeApproved, isTradingEnabled } from './hlClient';

export interface PerpMarket {
  /** Asset index used in orders */
  index: number;
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
  markPx: number;
  midPx: number;
  prevDayPx: number;
  dayNtlVlm: number;
  funding: number;
  openInterest: number;
  oraclePx: number;
}

const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/** Runs `fn` now and every `ms` while the page is visible (and again when it becomes visible). */
function usePolling(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    ref.current();
    const t = setInterval(() => visible() && ref.current(), ms);
    const onVis = () => visible() && ref.current();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms, enabled]);
}

/** All listed Hyperliquid perps with live market stats (refreshed every few seconds). */
export function usePerpMarkets() {
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [error, setError] = useState<string | null>(null);

  usePolling(() => {
    info
      .metaAndAssetCtxs()
      .then(([meta, ctxs]) => {
        const list: PerpMarket[] = [];
        meta.universe.forEach((u, i) => {
          const c = ctxs[i];
          if (!c || u.isDelisted) return;
          list.push({
            index: i,
            name: u.name,
            szDecimals: u.szDecimals,
            maxLeverage: u.maxLeverage,
            onlyIsolated: !!u.onlyIsolated || u.marginMode === 'strictIsolated' || u.marginMode === 'noCross',
            markPx: Number(c.markPx),
            midPx: Number(c.midPx ?? c.markPx),
            prevDayPx: Number(c.prevDayPx),
            dayNtlVlm: Number(c.dayNtlVlm),
            funding: Number(c.funding),
            openInterest: Number(c.openInterest),
            oraclePx: Number(c.oraclePx),
          });
        });
        setMarkets(list);
        setError(null);
      })
      .catch(() => setError('Could not load Hyperliquid markets. Retrying…'));
  }, 5000);

  return { markets, error };
}

export interface PerpPosition {
  coin: string;
  /** Signed size: positive = long, negative = short */
  size: number;
  entryPx: number;
  positionValue: number;
  unrealizedPnl: number;
  returnOnEquity: number;
  liquidationPx: number | null;
  marginUsed: number;
  leverage: number;
  leverageType: 'cross' | 'isolated';
}

export interface PerpOpenOrder {
  oid: number;
  coin: string;
  side: 'B' | 'A';
  limitPx: number;
  size: number;
  origSize: number;
  triggerPx: number;
  isTrigger: boolean;
  orderType: string;
  reduceOnly: boolean;
  isPositionTpsl: boolean;
  timestamp: number;
}

export interface PerpFill {
  tid: number;
  coin: string;
  px: number;
  sz: number;
  side: 'B' | 'A';
  dir: string;
  time: number;
  closedPnl: number;
  fee: number;
  feeToken: string;
  hash: string;
}

export interface PerpAccount {
  accountValue: number;
  withdrawable: number;
  totalMarginUsed: number;
  totalNtlPos: number;
  spotUsdc: number;
  spotUsdcFree: number;
  /** Unified account: spot USDC is used as perps collateral directly */
  unified: boolean;
  positions: PerpPosition[];
  openOrders: PerpOpenOrder[];
  /** True once the address has any Hyperliquid balance or history */
  exists: boolean;
}

/** The connected user's Hyperliquid account (balances, positions, orders), refreshed every 3 seconds. */
export function usePerpAccount(user: string | null) {
  const [account, setAccount] = useState<PerpAccount | null>(null);
  const [fills, setFills] = useState<PerpFill[]>([]);
  const [loading, setLoading] = useState(false);
  const unifiedRef = useRef<{ user: string; unified: boolean } | null>(null);

  useEffect(() => {
    setAccount(null);
    setFills([]);
  }, [user]);

  const loadAccount = useCallback(async () => {
    if (!user) return;
    const u = user as `0x${string}`;
    try {
      if (!unifiedRef.current || unifiedRef.current.user !== user) {
        const mode = await info.userAbstraction({ user: u }).catch(() => 'default' as const);
        unifiedRef.current = { user, unified: mode === 'unifiedAccount' || mode === 'portfolioMargin' };
      }
      const [ch, spot, orders] = await Promise.all([
        info.clearinghouseState({ user: u }),
        info.spotClearinghouseState({ user: u }),
        info.frontendOpenOrders({ user: u }),
      ]);
      const usdc = spot.balances.find((b) => b.coin === 'USDC');
      const spotTotal = Number(usdc?.total || 0);
      const spotHold = Number(usdc?.hold || 0);
      const positions: PerpPosition[] = ch.assetPositions
        .map(({ position: p }) => ({
          coin: p.coin,
          size: Number(p.szi),
          entryPx: Number(p.entryPx),
          positionValue: Number(p.positionValue),
          unrealizedPnl: Number(p.unrealizedPnl),
          returnOnEquity: Number(p.returnOnEquity),
          liquidationPx: p.liquidationPx ? Number(p.liquidationPx) : null,
          marginUsed: Number(p.marginUsed),
          leverage: p.leverage.value,
          leverageType: p.leverage.type,
        }))
        .filter((p) => p.size !== 0);
      const flatten = (o: (typeof orders)[number]): PerpOpenOrder => ({
        oid: o.oid,
        coin: o.coin,
        side: o.side,
        limitPx: Number(o.limitPx),
        size: Number(o.sz),
        origSize: Number(o.origSz),
        triggerPx: Number(o.triggerPx),
        isTrigger: o.isTrigger,
        orderType: o.orderType,
        reduceOnly: o.reduceOnly,
        isPositionTpsl: o.isPositionTpsl,
        timestamp: o.timestamp,
      });
      const accountValue = Number(ch.marginSummary.accountValue);
      setAccount({
        accountValue,
        withdrawable: Number(ch.withdrawable),
        totalMarginUsed: Number(ch.marginSummary.totalMarginUsed),
        totalNtlPos: Number(ch.marginSummary.totalNtlPos),
        spotUsdc: spotTotal,
        spotUsdcFree: Math.max(0, spotTotal - spotHold),
        unified: unifiedRef.current.unified,
        positions,
        openOrders: orders.map(flatten),
        exists: accountValue > 0 || spotTotal > 0 || positions.length > 0 || spot.balances.length > 0,
      });
    } catch {
      // Keep the last good snapshot on a network hiccup
    }
  }, [user]);

  const loadFills = useCallback(async () => {
    if (!user) return;
    try {
      const res = await info.userFills({ user: user as `0x${string}`, aggregateByTime: true });
      setFills(
        res
          .filter((f) => !f.coin.startsWith('@') && !f.coin.includes('/'))
          .slice(0, 100)
          .map((f) => ({
            tid: f.tid,
            coin: f.coin,
            px: Number(f.px),
            sz: Number(f.sz),
            side: f.side,
            dir: f.dir,
            time: f.time,
            closedPnl: Number(f.closedPnl),
            fee: Number(f.fee) + Number(f.builderFee || 0),
            feeToken: f.feeToken,
            hash: f.hash,
          }))
      );
    } catch {
      // keep previous
    }
  }, [user]);

  usePolling(loadAccount, 3000, !!user);
  usePolling(loadFills, 10000, !!user);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAccount(), loadFills()]);
    setLoading(false);
  }, [loadAccount, loadFills]);

  return { account, fills, loading, refresh };
}

/** Whether this browser can trade for `user` (trading key active) and the builder fee is approved. */
export function useTradingSetup(user: string | null) {
  const [state, setState] = useState<{ user: string; trading: boolean; builder: boolean } | null>(null);

  const check = useCallback(async () => {
    if (!user) {
      setState(null);
      return;
    }
    const [trading, builder] = await Promise.all([
      isTradingEnabled(user),
      isBuilderFeeApproved(user).catch(() => false),
    ]);
    setState({ user, trading, builder });
  }, [user]);

  useEffect(() => {
    setState(null);
    check();
  }, [check]);

  const current = state && state.user === user ? state : null;
  return {
    checked: !!current,
    tradingEnabled: !!current?.trading,
    builderApproved: !!current?.builder,
    recheck: check,
  };
}
