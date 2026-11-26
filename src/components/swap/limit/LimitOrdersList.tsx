import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ExternalLink, X } from 'lucide-react';
import { cancelCowOrders, getCowAccountOrders, orderExplorerUrl, getCowChain, type CowOrder } from './cowApi';
import { loadLimitTokens, formatTokenAmount, priceFromAmounts, type LimitToken } from './limitTokens';
import { getLimitSigner, isUserRejection } from './limitWallet';

interface LimitOrdersListProps {
  chainId: number;
  account: string;
  refreshKey: number;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-blue-50 text-primary border-blue-200' },
  presignaturePending: { label: 'Pending', cls: 'bg-blue-50 text-primary border-blue-200' },
  fulfilled: { label: 'Filled', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  expired: { label: 'Expired', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const POLL_MS = 20000;

export const LimitOrdersList: React.FC<LimitOrdersListProps> = ({ chainId, account, refreshKey }) => {
  const [orders, setOrders] = useState<CowOrder[]>([]);
  const [tokens, setTokens] = useState<Map<string, LimitToken>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [list, tokenList] = await Promise.all([
        getCowAccountOrders(chainId, account),
        loadLimitTokens(chainId).catch(() => [] as LimitToken[]),
      ]);
      setOrders(list);
      setTokens(new Map(tokenList.map((t) => [t.address.toLowerCase(), t])));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load your orders.');
    } finally {
      setLoading(false);
    }
  }, [chainId, account]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  const cancel = async (order: CowOrder) => {
    try {
      setCancelling(order.uid);
      setError(null);
      const signer = await getLimitSigner(account, chainId);
      await cancelCowOrders({ chainId, signer, orderUids: [order.uid] });
      await load();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(err?.message || 'Could not cancel the order.');
    } finally {
      setCancelling(null);
    }
  };

  const isActive = (o: CowOrder) => o.status === 'open' || o.status === 'presignaturePending';
  const active = orders.filter(isActive);
  const history = orders.filter((o) => !isActive(o)).slice(0, 10);
  const visible = showHistory ? [...active, ...history] : active;
  const chainName = getCowChain(chainId)?.name || '';

  const tokenOf = (addr: string) => tokens.get(addr.toLowerCase());
  const amount = (addr: string, value: string) => {
    const t = tokenOf(addr);
    return t ? `${formatTokenAmount(BigInt(value), t.decimals)} ${t.symbol}` : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  return (
    <div className="w-full max-w-[436px] mx-auto mt-4 rounded-3xl bg-white p-4 sm:p-5 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">
          Your Limit Orders <span className="text-gray-400 font-medium">· {chainName}</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold text-primary hover:underline px-2 py-1 cursor-pointer"
          >
            {showHistory ? 'Hide history' : 'Show history'}
          </button>
          <button onClick={load} aria-label="Refresh orders" className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {error && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}

      {visible.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-5">
          {loading ? 'Loading…' : showHistory ? 'No limit orders yet on this network.' : 'No open limit orders on this network.'}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((o) => {
            const st = STATUS_STYLE[o.status] || STATUS_STYLE.open;
            const sellT = tokenOf(o.sellToken);
            const buyT = tokenOf(o.buyToken);
            const price =
              sellT && buyT ? priceFromAmounts(BigInt(o.sellAmount), sellT.decimals, BigInt(o.buyAmount), buyT.decimals) : '';
            const expires = new Date(o.validTo * 1000);
            return (
              <li key={o.uid} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-xs text-gray-700">
                    <div className="font-semibold text-gray-900 text-[13px] break-words">
                      {amount(o.sellToken, o.sellAmount)} → {amount(o.buyToken, o.buyAmount)}
                    </div>
                    {price && sellT && buyT && (
                      <div className="text-gray-500 mt-0.5">
                        Limit: 1 {sellT.symbol} = {price} {buyT.symbol}
                      </div>
                    )}
                    <div className="text-gray-400 mt-0.5">
                      {o.status === 'fulfilled'
                        ? `Received ${amount(o.buyToken, o.executedBuyAmount)}`
                        : `Expires ${expires.toLocaleDateString()} ${expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <a
                    href={orderExplorerUrl(chainId, o.uid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-500 hover:text-primary inline-flex items-center gap-1"
                  >
                    View details <ExternalLink size={11} />
                  </a>
                  {o.status === 'open' && (
                    <button
                      onClick={() => cancel(o)}
                      disabled={cancelling === o.uid}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-200 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {cancelling === o.uid ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10px] text-gray-400 mt-3">Cancelling is free (a signature, no gas).</p>
    </div>
  );
};
