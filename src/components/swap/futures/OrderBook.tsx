import React, { useEffect, useMemo, useState } from 'react';
import { getSubscriptions } from './hlClient';
import { fmtPrice, fmtNum } from './format';

interface Level {
  px: number;
  sz: number;
}

const ROWS = 9;

const Row: React.FC<{ l: Level & { cum: number }; side: 'ask' | 'bid'; max: number }> = ({ l, side, max }) => (
  <div className="relative w-full grid grid-cols-3 gap-2 px-3 py-[3px] text-[11px] tabular-nums">
    <span
      className={`absolute inset-y-0 right-0 ${side === 'ask' ? 'bg-red-50' : 'bg-emerald-50'}`}
      style={{ width: `${(l.cum / max) * 100}%` }}
    />
    <span className={`relative ${side === 'ask' ? 'text-red-500' : 'text-emerald-600'} font-medium`}>{fmtPrice(l.px)}</span>
    <span className="relative text-right text-gray-700">{fmtNum(l.sz, 4)}</span>
    <span className="relative text-right text-gray-400">{fmtNum(l.cum, 4)}</span>
  </div>
);

/** Live order book (top levels on each side) from Hyperliquid's WebSocket. */
export const OrderBook: React.FC<{ coin: string }> = ({ coin }) => {
  const [book, setBook] = useState<{ coin: string; bids: Level[]; asks: Level[] } | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;
    setBook(null);
    getSubscriptions()
      .l2Book({ coin }, (data) => {
        if (!alive || data.coin !== coin) return;
        const map = (l: { px: string; sz: string }) => ({ px: Number(l.px), sz: Number(l.sz) });
        setBook({ coin, bids: data.levels[0].slice(0, ROWS).map(map), asks: data.levels[1].slice(0, ROWS).map(map) });
      })
      .then((sub) => {
        if (alive) unsubscribe = () => void sub.unsubscribe().catch(() => {});
        else sub.unsubscribe().catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [coin]);

  const { asks, bids, max, spread, spreadPct } = useMemo(() => {
    const asks = book?.asks || [];
    const bids = book?.bids || [];
    // Cumulative depth for the background bars
    let a = 0;
    const asksCum = asks.map((l) => ({ ...l, cum: (a += l.sz) }));
    let b = 0;
    const bidsCum = bids.map((l) => ({ ...l, cum: (b += l.sz) }));
    const max = Math.max(a, b, 1e-12);
    const spread = asks[0] && bids[0] ? asks[0].px - bids[0].px : null;
    const spreadPct = spread !== null && bids[0] ? (spread / bids[0].px) * 100 : null;
    return { asks: asksCum.reverse(), bids: bidsCum, max, spread, spreadPct };
  }, [book]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 text-xs font-bold text-gray-900">Order Book</div>
      <div className="grid grid-cols-3 gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span>Price</span>
        <span className="text-right">Size ({coin})</span>
        <span className="text-right">Total</span>
      </div>
      {!book ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-10">Loading order book…</div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex flex-col justify-end flex-1">
            {asks.map((l) => (
              <Row key={`a${l.px}`} l={l} side="ask" max={max} />
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 my-0.5 bg-gray-50 text-[11px]">
            <span className="text-gray-500">Spread</span>
            <span className="tabular-nums text-gray-700 font-medium">
              {spread !== null ? fmtPrice(spread) : '–'}
              {spreadPct !== null && <span className="text-gray-400 ml-1">({spreadPct.toFixed(3)}%)</span>}
            </span>
          </div>
          <div className="flex-1">
            {bids.map((l) => (
              <Row key={`b${l.px}`} l={l} side="bid" max={max} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
