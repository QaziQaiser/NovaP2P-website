import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Info, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { HL_BUILDER, HL_BUILDER_FEE_TENTHS_BPS, HL_MARKET_SLIPPAGE } from '../../../config/hyperliquid';
import { approveBuilderFee, enableTrading, hlErrorMessage, info, isUserRejection, toOrderSize } from './hlClient';
import { placeMarketOrder, type CoinLeverage } from './trade';
import type { PerpAccount, PerpMarket } from './useHyperliquid';
import { cleanDecimal, fmtNum, fmtPrice, fmtSignedUsd, fmtUsd, parseInput } from './format';

const TAKER_FEE = 0.00045; // Hyperliquid base taker fee (lower with volume / staking)
const MIN_NOTIONAL = 10;

interface OrderFormProps {
  user: string | null;
  /** A non-EVM wallet is connected in the swap */
  nonEvm: boolean;
  market: PerpMarket | undefined;
  account: PerpAccount | null;
  setup: { checked: boolean; tradingEnabled: boolean; builderApproved: boolean; recheck: () => Promise<void> };
  onConnectWallet: () => void;
  onDeposit: () => void;
  onTraded: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  user,
  nonEvm,
  market,
  account,
  setup,
  onConnectWallet,
  onDeposit,
  onTraded,
}) => {
  const coin = market?.name || '';
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [isCross, setIsCross] = useState(true);
  const [leverage, setLeverage] = useState(10);
  const [levOpen, setLevOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [tpslOn, setTpslOn] = useState(false);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [busy, setBusy] = useState<'order' | 'enable' | 'builder' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The user's current leverage and buying power for this coin
  const [current, setCurrent] = useState<{ coin: string; lev: CoinLeverage; maxSz: [number, number]; px: number } | null>(null);
  const [assetRefresh, setAssetRefresh] = useState(0);
  useEffect(() => {
    if (!user || !coin) {
      setCurrent(null);
      return;
    }
    let alive = true;
    info
      .activeAssetData({ user: user as `0x${string}`, coin })
      .then((d) => {
        if (!alive) return;
        setCurrent({
          coin,
          lev: { value: d.leverage.value, type: d.leverage.type },
          // Largest size (in coin) that can be bought / sold now at the current leverage
          maxSz: [Number(d.maxTradeSzs[0]), Number(d.maxTradeSzs[1])],
          px: Number(d.markPx),
        });
      })
      .catch(() => alive && setCurrent(null));
    return () => {
      alive = false;
    };
  }, [user, coin, assetRefresh, account?.withdrawable]);

  // Start from the user's own leverage for the coin (or 10x, capped at the coin's max)
  useEffect(() => {
    if (!market) return;
    if (current && current.coin === market.name) {
      setLeverage(Math.min(current.lev.value, market.maxLeverage));
      setIsCross(market.onlyIsolated ? false : current.lev.type === 'cross');
    } else {
      setLeverage((l) => Math.min(Math.max(l, 1), market.maxLeverage, 10));
      if (market.onlyIsolated) setIsCross(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.name, current?.coin, current?.lev.value, current?.lev.type]);

  useEffect(() => {
    setTp('');
    setSl('');
    setError(null);
    setSuccess(null);
  }, [coin]);

  const isBuy = side === 'long';
  const refPx = market ? market.midPx || market.markPx : 0;
  const notional = parseInput(amount);

  // Buying power: margin available for this side, times the selected leverage
  const availableMargin = useMemo(() => {
    if (current && current.coin === coin) {
      // Max size at the user's current leverage, converted to margin
      const curLev = current.lev.value || 1;
      return ((isBuy ? current.maxSz[0] : current.maxSz[1]) * current.px) / curLev;
    }
    if (!account) return 0;
    return account.unified ? account.spotUsdcFree : account.withdrawable;
  }, [current, coin, isBuy, account]);
  const maxNotional = availableMargin * leverage;

  const size = market && notional > 0 && refPx ? toOrderSize(notional / refPx, market.szDecimals) : null;
  const sizeNum = size ? Number(size) : 0;
  const realNotional = sizeNum * refPx;
  const margin = realNotional / leverage;
  const builderRate = HL_BUILDER && setup.builderApproved ? HL_BUILDER_FEE_TENTHS_BPS / 100000 : 0;
  const estFee = realNotional * (TAKER_FEE + builderRate);

  const tpNum = tpslOn ? parseInput(tp) : NaN;
  const slNum = tpslOn ? parseInput(sl) : NaN;
  const tpInvalid = tpNum > 0 && (isBuy ? tpNum <= refPx : tpNum >= refPx);
  const slInvalid = slNum > 0 && (isBuy ? slNum >= refPx : slNum <= refPx);
  const pnlAt = (px: number) => (px > 0 && sizeNum ? (px - refPx) * sizeNum * (isBuy ? 1 : -1) : null);

  const setPct = (pct: number) => {
    if (maxNotional <= 0) return;
    // Leave room for fees and price movement at 100%
    const v = maxNotional * pct * (pct === 1 ? 0.98 : 1);
    setAmount(v >= 1 ? v.toFixed(2) : '');
  };

  const run = async (kind: 'order' | 'enable' | 'builder', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setSuccess(null);
    try {
      await fn();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(hlErrorMessage(err));
      // A rejected trading key or builder approval shows the setup step again
      if (kind === 'order') setup.recheck();
    } finally {
      setBusy(null);
    }
  };

  const handleEnable = () =>
    run('enable', async () => {
      await enableTrading(user!);
      await setup.recheck();
    });

  const handleBuilder = () =>
    run('builder', async () => {
      await approveBuilderFee(user!);
      await setup.recheck();
    });

  const handleOrder = () =>
    run('order', async () => {
      if (!market || !size) return;
      const res = await placeMarketOrder({
        user: user!,
        market,
        isBuy,
        size,
        leverage,
        isCross,
        currentLeverage: current?.coin === coin ? current.lev : null,
        takeProfit: tpNum > 0 ? tpNum : undefined,
        stopLoss: slNum > 0 ? slNum : undefined,
        builderApproved: setup.builderApproved,
      });
      setSuccess(
        res.filledSize > 0
          ? `${isBuy ? 'Long' : 'Short'} ${fmtNum(res.filledSize, 6)} ${coin} filled at ${fmtPrice(res.avgPx)}.`
          : 'Order sent.'
      );
      setAmount('');
      setTp('');
      setSl('');
      setAssetRefresh((n) => n + 1);
      onTraded();
    });

  // ---- Main button
  let action: { label: string; onClick?: () => void; disabled?: boolean; tone?: 'long' | 'short' | 'primary' };
  const needsDeposit = !!account && !account.exists;
  if (!user) action = { label: nonEvm ? 'Connect an EVM wallet' : 'Connect Wallet', onClick: onConnectWallet, tone: 'primary' };
  else if (!market || !setup.checked || !account) action = { label: 'Loading…', disabled: true, tone: 'primary' };
  else if (needsDeposit) action = { label: 'Deposit USDC to start', onClick: onDeposit, tone: 'primary' };
  else if (!setup.tradingEnabled) action = { label: 'Enable Trading', onClick: handleEnable, tone: 'primary' };
  else if (HL_BUILDER && !setup.builderApproved) action = { label: 'Approve Builder Fee', onClick: handleBuilder, tone: 'primary' };
  else if (!(notional > 0)) action = { label: 'Enter an amount', disabled: true, tone: side };
  else if (!size || realNotional < MIN_NOTIONAL) action = { label: `Minimum order is $${MIN_NOTIONAL}`, disabled: true, tone: side };
  else if (margin > availableMargin * 1.0001) action = { label: 'Not enough margin', disabled: true, tone: side };
  else if (tpInvalid) action = { label: `Take profit must be ${isBuy ? 'above' : 'below'} the price`, disabled: true, tone: side };
  else if (slInvalid) action = { label: `Stop loss must be ${isBuy ? 'below' : 'above'} the price`, disabled: true, tone: side };
  else action = { label: `${isBuy ? 'Buy / Long' : 'Sell / Short'} ${coin}`, onClick: handleOrder, tone: side };

  const toneClass =
    action.tone === 'long'
      ? 'bg-emerald-500 hover:bg-emerald-600'
      : action.tone === 'short'
      ? 'bg-red-500 hover:bg-red-600'
      : 'bg-primary hover:bg-primary-dark';

  const showSetup = !!user && setup.checked && !!account && account.exists && (!setup.tradingEnabled || (HL_BUILDER && !setup.builderApproved));
  const input = 'w-full bg-transparent outline-none text-sm font-semibold text-gray-900 placeholder:text-gray-300 tabular-nums';
  const field = 'flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 focus-within:border-primary/50 px-3 py-2.5';
  const maxLev = market?.maxLeverage || 1;

  return (
    <div className="p-3 sm:p-4 flex flex-col gap-3">
      {/* Long / Short */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-gray-100">
        {(['long', 'short'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
              side === s ? (s === 'long' ? 'bg-emerald-500 text-white shadow' : 'bg-red-500 text-white shadow') : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {s === 'long' ? 'Long' : 'Short'}
          </button>
        ))}
      </div>

      {/* Margin mode + leverage */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid grid-cols-2 p-0.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-semibold">
          {[true, false].map((c) => (
            <button
              key={String(c)}
              type="button"
              disabled={c && market?.onlyIsolated}
              onClick={() => setIsCross(c)}
              className={`py-1.5 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isCross === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {c ? 'Cross' : 'Isolated'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLevOpen((o) => !o)}
          className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 hover:border-primary/50 px-3 text-xs font-semibold text-gray-900 cursor-pointer"
        >
          <span>
            Leverage <span className="text-primary font-bold">{leverage}x</span>
          </span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${levOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {levOpen && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={maxLev}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="flex-1 accent-[#4F7DF3] cursor-pointer"
            />
            <div className="flex items-center rounded-lg bg-white border border-gray-200 px-2 py-1 w-16">
              <input
                inputMode="numeric"
                value={leverage}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value.replace(/\D/g, '')) || 1);
                  setLeverage(Math.min(Math.max(n, 1), maxLev));
                }}
                className="w-full bg-transparent outline-none text-xs font-bold text-gray-900 text-right"
              />
              <span className="text-xs text-gray-400 ml-0.5">x</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Array.from(new Set([1, 2, 5, 10, 20, 25, 40, 50, maxLev])).filter((v) => v <= maxLev).sort((a, b) => a - b).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLeverage(v)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${
                  leverage === v ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                }`}
              >
                {v}x
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-500 leading-relaxed">
            Max {maxLev}x on {coin}. Higher leverage moves your liquidation price closer to the entry price.
          </p>
        </div>
      )}

      {/* Amount */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>Order value</span>
          {user && account && (
            <span>
              Available: <span className="font-semibold text-gray-800">{fmtUsd(availableMargin)}</span>
            </span>
          )}
        </div>
        <div className={field}>
          <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(cleanDecimal(e.target.value))} className={input} />
          <span className="text-xs font-bold text-gray-500">USDC</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <button
              key={p}
              type="button"
              disabled={maxNotional <= 0}
              onClick={() => setPct(p)}
              className="py-1 rounded-lg text-[11px] font-semibold bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary disabled:opacity-40 cursor-pointer"
            >
              {p * 100}%
            </button>
          ))}
        </div>
      </div>

      {/* TP / SL */}
      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
        <input type="checkbox" checked={tpslOn} onChange={(e) => setTpslOn(e.target.checked)} className="accent-[#4F7DF3] w-3.5 h-3.5" />
        Take Profit / Stop Loss
      </label>
      {tpslOn && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'TP price', value: tp, set: setTp, invalid: tpInvalid, pnl: pnlAt(tpNum) },
            { label: 'SL price', value: sl, set: setSl, invalid: slInvalid, pnl: pnlAt(slNum) },
          ].map((f) => (
            <div key={f.label}>
              <div className={`${field} ${f.invalid ? '!border-red-300' : ''}`}>
                <input inputMode="decimal" placeholder={f.label} value={f.value} onChange={(e) => f.set(cleanDecimal(e.target.value))} className={input} />
              </div>
              <div className={`mt-1 text-[10px] tabular-nums ${f.pnl === null ? 'text-gray-400' : f.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {f.pnl === null ? 'Est. PnL –' : `Est. PnL ${fmtSignedUsd(f.pnl)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order summary */}
      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 text-[11px]">
        {[
          ['Size', sizeNum ? `${fmtNum(sizeNum, market?.szDecimals ?? 4)} ${coin}` : '–'],
          ['Margin required', sizeNum ? fmtUsd(margin) : '–'],
          ['Market price', fmtPrice(refPx)],
          ['Max slippage', `${(HL_MARKET_SLIPPAGE * 100).toFixed(0)}%`],
          ['Est. fee', sizeNum ? fmtUsd(estFee, 4) : '–'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-3 py-1.5">
            <span className="text-gray-500">{k}</span>
            <span className="font-semibold text-gray-800 tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      {/* One-time setup */}
      {showSetup && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-gray-700">
          <div className="font-bold text-gray-900 text-xs mb-2">One-time setup (free, no gas)</div>
          <Step done={setup.tradingEnabled} label="Enable trading" note="Creates a Nova trading key in this browser. It can place orders but can never withdraw your funds." />
          {HL_BUILDER && (
            <Step done={setup.builderApproved} label="Approve builder fee" note={`Allows a ${(HL_BUILDER_FEE_TENTHS_BPS / 1000).toString()}% Nova fee per trade.`} />
          )}
        </div>
      )}

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
      {success && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex gap-1.5">
          <CheckCircle2 size={14} className="shrink-0 mt-px" />
          <span>{success}</span>
        </div>
      )}

      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled || !!busy}
        className={`w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${toneClass}`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : action.label === 'Enable Trading' ? <Zap size={15} /> : action.label === 'Approve Builder Fee' ? <ShieldCheck size={15} /> : null}
        {busy === 'order' ? 'Placing order…' : busy ? 'Confirm in your wallet…' : action.label}
      </button>

      <div className="flex gap-1.5 text-[10px] text-gray-400 leading-relaxed">
        <Info size={12} className="shrink-0 mt-px" />
        <span>
          Perpetual futures on Hyperliquid. Market orders fill instantly at the best price within the max slippage. Leveraged trading is
          high risk and you can lose your margin. Futures volume does not count toward Genesis Rewards.
        </span>
      </div>
    </div>
  );
};

const Step: React.FC<{ done: boolean; label: string; note: string }> = ({ done, label, note }) => (
  <div className="flex gap-2 mt-1.5 first:mt-0">
    <span
      className={`mt-px w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'border border-gray-300 bg-white'}`}
    >
      {done && <CheckCircle2 size={12} />}
    </span>
    <span>
      <span className="font-semibold text-gray-900">{label}</span>
      <span className="block text-gray-500">{note}</span>
    </span>
  </div>
);
