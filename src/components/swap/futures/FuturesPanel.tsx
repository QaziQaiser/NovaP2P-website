// Futures tab: Hyperliquid perpetuals with the wallet connected in the swap (shared with every other tab).
// Futures trades are NOT reported to Genesis Rewards: nothing here calls the campaign API.
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Loader2, RefreshCw } from 'lucide-react';
import { HL_DEFAULT_COIN } from '../../../config/hyperliquid';
import { usePerpAccount, usePerpMarkets, useTradingSetup } from './useHyperliquid';
import { MarketHeader } from './MarketHeader';
import { FuturesChart } from './FuturesChart';
import { OrderBook } from './OrderBook';
import { OrderForm } from './OrderForm';
import { PositionsTabs } from './PositionsTabs';
import { FundsModal, type FundsTab } from './FundsModal';
import { fmtSignedUsd, fmtUsd } from './format';

const isEvm = (a?: string | null) => !!a && /^0x[a-fA-F0-9]{40}$/.test(a);

const readCoin = () => {
  try {
    return localStorage.getItem('nova_hl_coin') || HL_DEFAULT_COIN;
  } catch {
    return HL_DEFAULT_COIN;
  }
};

interface FuturesPanelProps {
  /** Wallet connected in the swap (shared with Market / Cross Chain / Limit) */
  account: string | null;
  /** Opens the swap's wallet connection and returns to Futures */
  onConnectWallet: () => void;
}

export const FuturesPanel: React.FC<FuturesPanelProps> = ({ account: connected, onConnectWallet }) => {
  const user = isEvm(connected) ? (connected as string).toLowerCase() : null;
  const { markets, error: marketsError } = usePerpMarkets();
  const { account, fills, refresh } = usePerpAccount(user);
  const setup = useTradingSetup(user);
  const [coin, setCoinState] = useState<string>(readCoin);
  const [funds, setFunds] = useState<FundsTab | null>(null);

  const setCoin = useCallback((c: string) => {
    setCoinState(c);
    try {
      localStorage.setItem('nova_hl_coin', c);
    } catch {}
  }, []);

  // Fall back to the default coin if a saved one was delisted
  useEffect(() => {
    if (markets.length && !markets.some((m) => m.name === coin)) setCoin(HL_DEFAULT_COIN);
  }, [markets, coin, setCoin]);

  const market = markets.find((m) => m.name === coin);
  const upnl = account?.positions.reduce((s, p) => s + p.unrealizedPnl, 0) ?? 0;
  const canTrade = !!user && setup.tradingEnabled;

  // Refresh soon after an action, then again once Hyperliquid has settled it
  const refreshSoon = useCallback(() => {
    refresh();
    setTimeout(refresh, 1500);
  }, [refresh]);

  const card = 'rounded-2xl bg-white border border-gray-200/80 shadow-sm overflow-hidden';

  return (
    <div className="w-full max-w-[1280px] mx-auto px-2 sm:px-4 flex flex-col gap-3">
      {marketsError && !markets.length && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">{marketsError}</div>
      )}

      {/* Market bar */}
      <div className={`${card} !overflow-visible relative z-20`}>
        {markets.length ? (
          <MarketHeader markets={markets} market={market} coin={coin} onChange={setCoin} />
        ) : (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading Hyperliquid markets…
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px_320px] gap-3">
        {/* Chart */}
        <div className={`${card} min-h-[360px] sm:min-h-[440px]`}>
          <FuturesChart coin={coin} refPrice={market?.markPx || 0} />
        </div>

        {/* Order book (desktop only, so the order form stays right under the chart on phones) */}
        <div className={`${card} hidden lg:block`}>
          <OrderBook coin={coin} />
        </div>

        {/* Order form + account */}
        <div className="flex flex-col gap-3 lg:row-span-1">
          <div className={card}>
            <OrderForm
              user={user}
              nonEvm={!!connected && !user}
              market={market}
              account={account}
              setup={setup}
              onConnectWallet={onConnectWallet}
              onDeposit={() => setFunds('deposit')}
              onTraded={refreshSoon}
            />
          </div>

          {user && (
            <div className={`${card} p-3 sm:p-4`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-gray-900">Account</span>
                <button type="button" onClick={refresh} aria-label="Refresh" className="p-1 text-gray-400 hover:text-primary cursor-pointer">
                  <RefreshCw size={13} />
                </button>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {[
                  ['Account value', fmtUsd(account?.unified ? (account?.accountValue || 0) + (account?.spotUsdc || 0) : account?.accountValue)],
                  ['Available to withdraw', fmtUsd(account ? (account.unified ? Math.max(account.withdrawable, account.spotUsdcFree) : account.withdrawable) : null)],
                  ['Margin used', fmtUsd(account?.totalMarginUsed)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-semibold text-gray-800 tabular-nums">{account ? v : '…'}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-gray-500">Unrealized PnL</span>
                  <span className={`font-semibold tabular-nums ${upnl > 0 ? 'text-emerald-600' : upnl < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                    {account ? fmtSignedUsd(upnl) : '…'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setFunds('deposit')}
                  className="py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownToLine size={13} /> Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setFunds('withdraw')}
                  className="py-2 rounded-xl bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpFromLine size={13} /> Withdraw
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PositionsTabs
        user={user}
        account={account}
        fills={fills}
        markets={markets}
        canTrade={canTrade}
        builderApproved={setup.builderApproved}
        onChanged={refreshSoon}
        onSelectCoin={setCoin}
      />

      <p className="text-center text-[10px] text-gray-400 pb-2">
        Futures are executed on Hyperliquid. Nova never holds your funds. Not available in restricted jurisdictions.
      </p>

      {funds && user && (
        <FundsModal user={user} account={account} initialTab={funds} onClose={() => setFunds(null)} onDone={refreshSoon} />
      )}
    </div>
  );
};
