import React, { useState } from 'react';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { hlErrorMessage, isUserRejection } from './hlClient';
import { cancelOrder, closePosition, setPositionTpsl } from './trade';
import type { PerpAccount, PerpFill, PerpMarket, PerpOpenOrder, PerpPosition } from './useHyperliquid';
import { CoinLogo } from './MarketHeader';
import { cleanDecimal, fmtNum, fmtPct, fmtPrice, fmtSignedUsd, fmtTime, fmtUsd, parseInput } from './format';

type Tab = 'positions' | 'orders' | 'history';

interface PositionsTabsProps {
  user: string | null;
  account: PerpAccount | null;
  fills: PerpFill[];
  markets: PerpMarket[];
  canTrade: boolean;
  builderApproved: boolean;
  onChanged: () => void;
  onSelectCoin: (coin: string) => void;
}

export const PositionsTabs: React.FC<PositionsTabsProps> = ({
  user,
  account,
  fills,
  markets,
  canTrade,
  builderApproved,
  onChanged,
  onSelectCoin,
}) => {
  const [tab, setTab] = useState<Tab>('positions');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tpslFor, setTpslFor] = useState<PerpPosition | null>(null);

  const positions = account?.positions || [];
  const orders = account?.openOrders || [];
  const market = (coin: string) => markets.find((m) => m.name === coin);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusyKey(key);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(hlErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const tpslOf = (coin: string) => {
    const list = orders.filter((o) => o.coin === coin && o.isTrigger && o.reduceOnly);
    const tp = list.find((o) => /take profit/i.test(o.orderType));
    const sl = list.find((o) => /stop/i.test(o.orderType));
    return { tp: tp?.triggerPx, sl: sl?.triggerPx };
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'positions', label: 'Positions', count: positions.length },
    { id: 'orders', label: 'Open Orders', count: orders.length },
    { id: 'history', label: 'Trade History' },
  ];

  const th = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap';
  const td = 'px-3 py-2.5 whitespace-nowrap tabular-nums';
  const smallBtn =
    'px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary disabled:opacity-40 cursor-pointer inline-flex items-center gap-1';

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-1 px-2 border-b border-gray-100 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer ${
              tab === t.id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count ? <span className="ml-1 text-primary">({t.count})</span> : null}
            {tab === t.id && <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-3 mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {!user ? (
        <Empty text="Connect your wallet to see your positions and trades." />
      ) : !account ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : tab === 'positions' ? (
        positions.length === 0 ? (
          <Empty text="No open positions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['Market', 'Size', 'Value', 'Entry Price', 'Mark Price', 'PnL (ROE)', 'Liq. Price', 'Margin', 'TP / SL', ''].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {positions.map((p) => {
                  const m = market(p.coin);
                  const long = p.size > 0;
                  const { tp, sl } = tpslOf(p.coin);
                  return (
                    <tr key={p.coin} className="hover:bg-gray-50/60">
                      <td className={td}>
                        <button type="button" onClick={() => onSelectCoin(p.coin)} className="flex items-center gap-2 cursor-pointer">
                          <CoinLogo coin={p.coin} size={18} />
                          <span className="font-bold text-gray-900">{p.coin}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${long ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                            {long ? 'Long' : 'Short'} {p.leverage}x
                          </span>
                        </button>
                      </td>
                      <td className={`${td} font-semibold ${long ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmtNum(Math.abs(p.size), 6)} {p.coin}
                      </td>
                      <td className={td}>{fmtUsd(p.positionValue)}</td>
                      <td className={td}>{fmtPrice(p.entryPx)}</td>
                      <td className={td}>{fmtPrice(m?.markPx)}</td>
                      <td className={`${td} font-semibold ${p.unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmtSignedUsd(p.unrealizedPnl)} <span className="font-normal">({fmtPct(p.returnOnEquity * 100)})</span>
                      </td>
                      <td className={`${td} text-amber-600`}>{p.liquidationPx ? fmtPrice(p.liquidationPx) : '–'}</td>
                      <td className={td}>
                        {fmtUsd(p.marginUsed)} <span className="text-gray-400 capitalize">({p.leverageType})</span>
                      </td>
                      <td className={td}>
                        <button type="button" disabled={!canTrade || !m} onClick={() => setTpslFor(p)} className={smallBtn}>
                          {tp || sl ? `${tp ? fmtPrice(tp) : '–'} / ${sl ? fmtPrice(sl) : '–'}` : 'Set'}
                        </button>
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          disabled={!canTrade || !m || !!busyKey}
                          onClick={() => m && run(`close:${p.coin}`, () => closePosition({ user, market: m, position: p, builderApproved }))}
                          className={smallBtn}
                        >
                          {busyKey === `close:${p.coin}` && <Loader2 size={11} className="animate-spin" />}
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : tab === 'orders' ? (
        orders.length === 0 ? (
          <Empty text="No open orders." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['Time', 'Market', 'Type', 'Side', 'Size', 'Trigger', 'Price', ''].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o: PerpOpenOrder) => {
                  const m = market(o.coin);
                  return (
                    <tr key={o.oid} className="hover:bg-gray-50/60">
                      <td className={`${td} text-gray-500`}>{fmtTime(o.timestamp)}</td>
                      <td className={`${td} font-bold text-gray-900`}>{o.coin}</td>
                      <td className={td}>{o.orderType}</td>
                      <td className={`${td} font-semibold ${o.side === 'B' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {o.side === 'B' ? 'Buy' : 'Sell'}
                        {o.reduceOnly ? <span className="text-gray-400 font-normal"> (reduce)</span> : null}
                      </td>
                      <td className={td}>{o.isPositionTpsl ? 'Position' : fmtNum(o.size, 6)}</td>
                      <td className={td}>{o.isTrigger ? fmtPrice(o.triggerPx) : '–'}</td>
                      <td className={td}>{o.isTrigger && /market/i.test(o.orderType) ? 'Market' : fmtPrice(o.limitPx)}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          disabled={!canTrade || !m || !!busyKey}
                          onClick={() => m && run(`cancel:${o.oid}`, () => cancelOrder(user, m.index, o.oid))}
                          className={smallBtn}
                        >
                          {busyKey === `cancel:${o.oid}` && <Loader2 size={11} className="animate-spin" />}
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : fills.length === 0 ? (
        <Empty text="No trades yet." />
      ) : (
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr>
                {['Time', 'Market', 'Direction', 'Price', 'Size', 'Value', 'Fee', 'Closed PnL', ''].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fills.map((f) => (
                <tr key={`${f.tid}-${f.hash}`} className="hover:bg-gray-50/60">
                  <td className={`${td} text-gray-500`}>{fmtTime(f.time)}</td>
                  <td className={`${td} font-bold text-gray-900`}>{f.coin}</td>
                  <td className={`${td} font-semibold ${/long/i.test(f.dir) === /open/i.test(f.dir) ? 'text-emerald-600' : 'text-red-500'}`}>{f.dir}</td>
                  <td className={td}>{fmtPrice(f.px)}</td>
                  <td className={td}>{fmtNum(f.sz, 6)}</td>
                  <td className={td}>{fmtUsd(f.px * f.sz)}</td>
                  <td className={`${td} text-gray-500`}>
                    {fmtNum(f.fee, 4)} {f.feeToken}
                  </td>
                  <td className={`${td} font-semibold ${f.closedPnl > 0 ? 'text-emerald-600' : f.closedPnl < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {f.closedPnl ? fmtSignedUsd(f.closedPnl) : '–'}
                  </td>
                  <td className={td}>
                    {/^0x0+$/.test(f.hash) ? null : (
                      <a
                        href={`https://app.hyperliquid.xyz/explorer/tx/${f.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-primary"
                        aria-label="View on explorer"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tpslFor && user && market(tpslFor.coin) && (
        <TpslModal
          position={tpslFor}
          market={market(tpslFor.coin)!}
          current={tpslOf(tpslFor.coin)}
          onClose={() => setTpslFor(null)}
          onSave={(tp, sl) =>
            setPositionTpsl({
              user,
              market: market(tpslFor.coin)!,
              position: tpslFor,
              openOrders: orders,
              takeProfit: tp,
              stopLoss: sl,
              builderApproved,
            }).then(onChanged)
          }
        />
      )}
    </div>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => <div className="py-10 text-center text-xs text-gray-400">{text}</div>;

/** Edit TP / SL for a whole position. */
const TpslModal: React.FC<{
  position: PerpPosition;
  market: PerpMarket;
  current: { tp?: number; sl?: number };
  onClose: () => void;
  onSave: (tp: number | null | undefined, sl: number | null | undefined) => Promise<void>;
}> = ({ position, market, current, onClose, onSave }) => {
  const [tp, setTp] = useState(current.tp ? String(current.tp) : '');
  const [sl, setSl] = useState(current.sl ? String(current.sl) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const long = position.size > 0;
  const mark = market.markPx;
  const tpN = parseInput(tp);
  const slN = parseInput(sl);
  const tpBad = tpN > 0 && (long ? tpN <= mark : tpN >= mark);
  const slBad = slN > 0 && (long ? slN >= mark : slN <= mark);
  const pnl = (px: number) => (px > 0 ? (px - position.entryPx) * position.size : null);

  // undefined = unchanged, null = remove, number = set
  const diff = (input: number, prev?: number) => (input > 0 ? (input === prev ? undefined : input) : prev ? null : undefined);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(diff(tpN, current.tp), diff(slN, current.sl));
      onClose();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(hlErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onMouseDown={() => !busy && onClose()}>
      <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-gray-900">
            TP / SL for {position.coin} {long ? 'Long' : 'Short'}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500 mb-3">
          <div>
            Entry <span className="font-semibold text-gray-800">{fmtPrice(position.entryPx)}</span>
          </div>
          <div>
            Mark <span className="font-semibold text-gray-800">{fmtPrice(mark)}</span>
          </div>
        </div>
        {[
          { label: 'Take profit price', v: tp, set: setTp, bad: tpBad, hint: `Must be ${long ? 'above' : 'below'} the mark price`, n: tpN },
          { label: 'Stop loss price', v: sl, set: setSl, bad: slBad, hint: `Must be ${long ? 'below' : 'above'} the mark price`, n: slN },
        ].map((f) => {
          const p = pnl(f.n);
          return (
            <div key={f.label} className="mb-3">
              <div className="text-xs text-gray-500 mb-1">{f.label}</div>
              <div className={`flex items-center rounded-xl bg-gray-50 border px-3 py-2.5 ${f.bad ? 'border-red-300' : 'border-gray-100 focus-within:border-primary/50'}`}>
                <input
                  inputMode="decimal"
                  placeholder="None"
                  value={f.v}
                  onChange={(e) => f.set(cleanDecimal(e.target.value))}
                  className="flex-1 bg-transparent outline-none text-sm font-semibold text-gray-900 tabular-nums"
                />
                {f.v && (
                  <button type="button" onClick={() => f.set('')} className="text-gray-400 hover:text-gray-700 cursor-pointer" aria-label="Clear">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className={`mt-1 text-[10px] ${f.bad ? 'text-red-500' : p === null ? 'text-gray-400' : p >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {f.bad ? f.hint : p === null ? 'Leave empty for none' : `Est. PnL ${fmtSignedUsd(p)}`}
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-gray-400 mb-3">Closes the whole position at market when the price is reached.</p>
        {error && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
        <button
          type="button"
          onClick={save}
          disabled={busy || tpBad || slBad}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
};
