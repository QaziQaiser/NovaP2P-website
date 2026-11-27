import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Star } from 'lucide-react';
import type { PerpMarket } from './useHyperliquid';
import { fmtCompactUsd, fmtPct, fmtPrice } from './format';

export const CoinLogo: React.FC<{ coin: string; size?: number }> = ({ coin, size = 22 }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [coin]);
  if (!broken) {
    return (
      <img
        src={`https://app.hyperliquid.xyz/coins/${encodeURIComponent(coin)}.svg`}
        alt=""
        width={size}
        height={size}
        className="rounded-full shrink-0 bg-gray-100"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0"
    >
      {coin.replace(/^k/, '').charAt(0)}
    </span>
  );
};

const change24h = (m: PerpMarket) => (m.prevDayPx ? ((m.markPx - m.prevDayPx) / m.prevDayPx) * 100 : 0);

const FAV_KEY = 'nova_hl_favorites';
const readFavs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch {
    return [];
  }
};

const MarketPicker: React.FC<{ markets: PerpMarket[]; value: string; onChange: (coin: string) => void }> = ({
  markets,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<string[]>(readFavs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggleFav = (coin: string) => {
    const next = favs.includes(coin) ? favs.filter((c) => c !== coin) : [...favs, coin];
    setFavs(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {}
  };

  const list = useMemo(() => {
    const q = query.trim().toUpperCase();
    return markets
      .filter((m) => !q || m.name.toUpperCase().includes(q))
      .sort((a, b) => Number(favs.includes(b.name)) - Number(favs.includes(a.name)) || b.dayNtlVlm - a.dayNtlVlm);
  }, [markets, query, favs]);

  const current = markets.find((m) => m.name === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer"
      >
        <CoinLogo coin={value} size={26} />
        <span className="text-lg font-bold text-gray-900">{value}-USD</span>
        {current && (
          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold">{current.maxLeverage}x</span>
        )}
        <ChevronDown size={16} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[min(92vw,420px)] rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
          <div className="p-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <Search size={14} className="text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search markets"
                className="flex-1 bg-transparent outline-none text-sm text-gray-900"
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right w-16">24h</span>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {list.map((m) => {
              const ch = change24h(m);
              return (
                <div
                  key={m.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onChange(m.name);
                    setOpen(false);
                    setQuery('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (onChange(m.name), setOpen(false))}
                  className={`grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                    m.name === value ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      aria-label="Favorite"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFav(m.name);
                      }}
                      className="cursor-pointer"
                    >
                      <Star size={13} className={favs.includes(m.name) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                    </button>
                    <CoinLogo coin={m.name} size={20} />
                    <span className="font-semibold text-gray-900 truncate">{m.name}</span>
                    <span className="text-[10px] text-gray-400">{m.maxLeverage}x</span>
                  </span>
                  <span className="text-right tabular-nums text-gray-800">{fmtPrice(m.markPx)}</span>
                  <span className={`text-right tabular-nums w-16 font-medium ${ch >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtPct(ch)}
                  </span>
                </div>
              );
            })}
            {list.length === 0 && <div className="px-4 py-8 text-center text-xs text-gray-400">No markets found</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
  <div className="shrink-0">
    <div className="text-[10px] text-gray-400 font-medium">{label}</div>
    <div className={`text-xs font-semibold tabular-nums text-gray-800 ${className}`}>{value}</div>
  </div>
);

/** Market picker and live stats (price, 24h change, volume, open interest, funding). */
export const MarketHeader: React.FC<{ markets: PerpMarket[]; market: PerpMarket | undefined; onChange: (coin: string) => void; coin: string }> = ({
  markets,
  market,
  onChange,
  coin,
}) => {
  const ch = market ? change24h(market) : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 sm:px-4 py-2.5">
      <MarketPicker markets={markets} value={coin} onChange={onChange} />
      {market && (
        <>
          <div className="shrink-0">
            <div className={`text-lg font-bold tabular-nums ${ch >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtPrice(market.markPx)}</div>
          </div>
          <div className="flex items-center gap-5 overflow-x-auto [scrollbar-width:none]">
            <Stat label="24h Change" value={fmtPct(ch)} className={ch >= 0 ? 'text-emerald-600' : 'text-red-500'} />
            <Stat label="Oracle" value={fmtPrice(market.oraclePx)} />
            <Stat label="24h Volume" value={fmtCompactUsd(market.dayNtlVlm)} />
            <Stat label="Open Interest" value={fmtCompactUsd(market.openInterest * market.markPx)} />
            <Stat
              label="Funding / 1h"
              value={`${(market.funding * 100).toFixed(4)}%`}
              className={market.funding >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
          </div>
        </>
      )}
    </div>
  );
};
