import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../../../context/WalletContext';
import { openAppKitModal } from '../../../config/appkit';
import {
  COW_CHAINS,
  COW_VAULT_RELAYER,
  NOVA_PARTNER_FEE_BPS,
  afterPartnerFee,
  getCowChain,
  getCowQuote,
  placeCowLimitOrder,
} from './cowApi';
import {
  loadLimitTokens,
  readTokenBalance,
  readCowAllowance,
  formatTokenAmount,
  parseDecimal,
  priceFromAmounts,
  buyAmountForPrice,
  type LimitToken,
} from './limitTokens';
import { approveForCow, getLimitSigner, getWalletChainId, isUserRejection } from './limitWallet';
import { TokenSelectModal, TokenLogo } from './TokenSelectModal';
import { LimitOrdersList } from './LimitOrdersList';

const EXPIRY_OPTIONS = [
  { label: '1 Day', seconds: 86400 },
  { label: '7 Days', seconds: 7 * 86400 },
  { label: '30 Days', seconds: 30 * 86400 },
  { label: '90 Days', seconds: 90 * 86400 },
  { label: '6 Months', seconds: 182 * 86400 },
];

const DEFAULT_CHAIN = 42161;
const isEvm = (a?: string | null) => !!a && /^0x[a-fA-F0-9]{40}$/.test(a);

export const LimitOrderPanel: React.FC = () => {
  const { account } = useWallet();
  const owner = isEvm(account) ? (account as string) : null;

  const [chainId, setChainId] = useState<number>(DEFAULT_CHAIN);
  const [sellToken, setSellToken] = useState<LimitToken | null>(null);
  const [buyToken, setBuyToken] = useState<LimitToken | null>(null);
  const [picker, setPicker] = useState<'sell' | 'buy' | null>(null);
  const [sellInput, setSellInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[1].seconds);

  const [marketPrice, setMarketPrice] = useState<string>('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [walletChain, setWalletChain] = useState<number | null>(null);

  const [busy, setBusy] = useState<'approve' | 'place' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ordersRefresh, setOrdersRefresh] = useState(0);

  // Start on the wallet's network when Limit orders support it
  const initialChainSet = useRef(false);
  useEffect(() => {
    if (initialChainSet.current || !owner) return;
    getWalletChainId().then((id) => {
      if (id && getCowChain(id)) setChainId(id);
      initialChainSet.current = true;
    });
  }, [owner]);

  // Track the wallet's current network (to show "Switch network")
  useEffect(() => {
    if (!owner) return;
    let alive = true;
    const check = () => getWalletChainId().then((id) => alive && setWalletChain(id));
    check();
    const t = setInterval(check, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [owner]);

  // Default pair per network: wrapped native -> USDC
  useEffect(() => {
    let alive = true;
    setSellToken(null);
    setBuyToken(null);
    setMarketPrice('');
    setPriceInput('');
    setPriceTouched(false);
    loadLimitTokens(chainId)
      .then((list) => {
        if (!alive) return;
        const wrapped = getCowChain(chainId)?.wrappedNative.toUpperCase();
        const bySymbol = (s: string) => list.find((t) => t.symbol.toUpperCase() === s);
        setSellToken(bySymbol(wrapped || '') || list[0] || null);
        setBuyToken(bySymbol('USDC') || bySymbol('USDT') || list[1] || null);
      })
      .catch(() => alive && setError('Could not load tokens for this network.'));
    return () => {
      alive = false;
    };
  }, [chainId]);

  const sellAmount = useMemo(
    () => (sellToken ? parseDecimal(sellInput, sellToken.decimals) : null),
    [sellInput, sellToken]
  );

  // Balance + allowance of the sell token
  const refreshBalance = useCallback(async () => {
    if (!owner || !sellToken) {
      setBalance(null);
      setAllowance(null);
      return;
    }
    try {
      const [b, a] = await Promise.all([
        readTokenBalance(chainId, sellToken.address, owner),
        readCowAllowance(chainId, sellToken.address, owner),
      ]);
      setBalance(b);
      setAllowance(a);
    } catch {
      setBalance(null);
      setAllowance(null);
    }
  }, [owner, sellToken, chainId]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Market price (debounced): based on the entered amount, or 1 token when empty
  useEffect(() => {
    if (!sellToken || !buyToken) return;
    let alive = true;
    const amount = sellAmount && sellAmount > 0n ? sellAmount : 10n ** BigInt(sellToken.decimals);
    setQuoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await getCowQuote({
          chainId,
          sellToken: sellToken.address,
          buyToken: buyToken.address,
          sellAmount: amount.toString(),
          from: owner,
        });
        if (!alive) return;
        // What the market gives for the full amount right now, after network costs and the Nova fee
        const price = priceFromAmounts(amount, sellToken.decimals, afterPartnerFee(q.buyAmount), buyToken.decimals);
        setMarketPrice(price);
        setQuoteError(null);
        if (!priceTouched) setPriceInput(price);
      } catch (err: any) {
        if (!alive) return;
        setMarketPrice('');
        setQuoteError(err?.message || 'Market price unavailable.');
      } finally {
        if (alive) setQuoteLoading(false);
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, sellToken, buyToken, sellAmount, owner]);

  const buyAmount = useMemo(() => {
    if (!sellToken || !buyToken || !sellAmount || sellAmount <= 0n) return null;
    return buyAmountForPrice(sellAmount, sellToken.decimals, priceInput, buyToken.decimals);
  }, [sellAmount, sellToken, buyToken, priceInput]);

  const priceDiffPct = useMemo(() => {
    const m = Number(marketPrice);
    const p = Number(priceInput);
    if (!m || !p) return null;
    return ((p - m) / m) * 100;
  }, [marketPrice, priceInput]);

  const setPriceFromMarket = (pct: number) => {
    const m = Number(marketPrice);
    if (!m) return;
    const v = m * (1 + pct / 100);
    // Plain decimal (never scientific notation like 1.2e-7) with up to 10 significant digits
    setPriceInput(v.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 10 }));
    setPriceTouched(true);
  };

  const flipTokens = () => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellInput('');
    setPriceInput('');
    setPriceTouched(false);
    setMarketPrice('');
  };

  const needsApproval = !!(sellAmount && allowance !== null && allowance < sellAmount);
  const insufficient = !!(sellAmount && balance !== null && balance < sellAmount);
  const wrongNetwork = !!owner && walletChain !== null && walletChain !== chainId;
  const chain = getCowChain(chainId);

  const handleApprove = async () => {
    if (!owner || !sellToken) return;
    try {
      setBusy('approve');
      setError(null);
      await approveForCow(owner, chainId, sellToken.address, COW_VAULT_RELAYER);
      await refreshBalance();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(err?.shortMessage || err?.message || 'Approval failed.');
    } finally {
      setBusy(null);
    }
  };

  const handlePlace = async () => {
    if (!owner || !sellToken || !buyToken || !sellAmount || !buyAmount) return;
    try {
      setBusy('place');
      setError(null);
      setSuccess(null);
      const signer = await getLimitSigner(owner, chainId);
      await placeCowLimitOrder({
        chainId,
        signer,
        owner,
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount,
        buyAmount,
        validTo: Math.floor(Date.now() / 1000) + expiry,
      });
      setSuccess(
        `Limit order placed: ${formatTokenAmount(sellAmount, sellToken.decimals)} ${sellToken.symbol} for at least ${formatTokenAmount(
          buyAmount,
          buyToken.decimals
        )} ${buyToken.symbol}.`
      );
      setSellInput('');
      setOrdersRefresh((n) => n + 1);
    } catch (err: any) {
      if (!isUserRejection(err)) setError(err?.message || 'Could not place the order.');
    } finally {
      setBusy(null);
    }
  };

  let action: { label: string; onClick?: () => void; disabled?: boolean } = { label: 'Place Limit Order', onClick: handlePlace };
  if (!owner) action = { label: account ? 'Connect an EVM wallet' : 'Connect Wallet', onClick: () => openAppKitModal('Connect') };
  else if (!sellToken || !buyToken) action = { label: 'Select tokens', disabled: true };
  else if (!sellAmount || sellAmount <= 0n) action = { label: 'Enter an amount', disabled: true };
  else if (!buyAmount || buyAmount <= 0n) action = { label: 'Enter a limit price', disabled: true };
  else if (insufficient) action = { label: `Insufficient ${sellToken.symbol} balance`, disabled: true };
  else if (wrongNetwork) action = { label: `Switch to ${chain?.name}`, onClick: () => getLimitSigner(owner, chainId).catch(() => {}) };
  else if (needsApproval) action = { label: `Approve ${sellToken.symbol}`, onClick: handleApprove };

  const box = 'rounded-2xl bg-gray-50 border border-gray-100 p-3.5';

  return (
    <div className="w-full flex flex-col items-center px-4">
      <div className="w-full max-w-[436px] rounded-3xl bg-white p-4 sm:p-5 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]">
        {/* Network (same chain only) */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-900">Limit Order</span>
          <label className="relative">
            <span className="sr-only">Network</span>
            <select
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value))}
              className="appearance-none text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-7 py-1.5 cursor-pointer outline-none focus:border-primary"
            >
              {COW_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </label>
        </div>

        {/* Sell */}
        <div className={box}>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>You sell</span>
            {owner && sellToken && balance !== null && (
              <button
                type="button"
                onClick={() => setSellInput(formatTokenAmount(balance, sellToken.decimals, sellToken.decimals).replace(/,/g, ''))}
                className="hover:text-primary cursor-pointer"
              >
                Balance: {formatTokenAmount(balance, sellToken.decimals)} <span className="font-bold text-primary ml-0.5">MAX</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              placeholder="0"
              value={sellInput}
              onChange={(e) => setSellInput(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="min-w-0 flex-1 bg-transparent outline-none text-xl sm:text-2xl font-semibold text-gray-900 placeholder:text-gray-300"
            />
            <TokenButton token={sellToken} onClick={() => setPicker('sell')} />
          </div>
        </div>

        <div className="flex justify-center -my-2.5 relative z-10">
          <button
            type="button"
            onClick={flipTokens}
            aria-label="Switch tokens"
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-primary cursor-pointer"
          >
            ↓
          </button>
        </div>

        {/* Buy */}
        <div className={box}>
          <div className="text-xs text-gray-500 mb-1.5">You receive at least</div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-xl sm:text-2xl font-semibold text-gray-900 truncate">
              {buyAmount && buyToken ? formatTokenAmount(buyAmount, buyToken.decimals, 4) : <span className="text-gray-300">0</span>}
            </div>
            <TokenButton token={buyToken} onClick={() => setPicker('buy')} />
          </div>
        </div>

        {/* Limit price */}
        <div className={`${box} mt-3`}>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>
              Limit price {sellToken && buyToken ? `(1 ${sellToken.symbol} in ${buyToken.symbol})` : ''}
            </span>
            {priceDiffPct !== null && Math.abs(priceDiffPct) >= 0.01 && (
              <span className={priceDiffPct >= 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {priceDiffPct >= 0 ? '+' : ''}
                {priceDiffPct.toFixed(2)}% vs market
              </span>
            )}
          </div>
          <input
            inputMode="decimal"
            placeholder="0"
            value={priceInput}
            onChange={(e) => {
              setPriceInput(e.target.value.replace(/[^0-9.,]/g, ''));
              setPriceTouched(true);
            }}
            className="w-full bg-transparent outline-none text-xl font-semibold text-gray-900 placeholder:text-gray-300"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              { label: 'Market', pct: 0 },
              { label: '+1%', pct: 1 },
              { label: '+5%', pct: 5 },
              { label: '+10%', pct: 10 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                disabled={!marketPrice}
                onClick={() => setPriceFromMarket(b.pct)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary disabled:opacity-40 cursor-pointer"
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 text-[11px] text-gray-500 flex items-center gap-1.5">
            {quoteLoading && <Loader2 size={11} className="animate-spin" />}
            {marketPrice && sellToken && buyToken ? (
              <span>
                Current market price: 1 {sellToken.symbol} = {marketPrice} {buyToken.symbol}
                <span className="text-gray-400"> (after fee)</span>
              </span>
            ) : quoteError ? (
              <span className="text-amber-600">{quoteError}</span>
            ) : (
              <span>Loading market price…</span>
            )}
          </div>
          {priceDiffPct !== null && priceDiffPct < -0.5 && (
            <div className="mt-1.5 text-[11px] text-amber-600">
              Your price is below the market, so the order will likely fill right away near the market price.
            </div>
          )}
        </div>

        {/* Nova fee */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-gray-500">Nova fee</span>
          <span className="text-gray-700 font-semibold">
            {(NOVA_PARTNER_FEE_BPS / 100).toFixed(2)}%
            {buyAmount && buyToken && buyAmount > 0n ? (
              <span className="text-gray-400 font-normal">
                {' '}
                (≈ {formatTokenAmount((buyAmount * BigInt(NOVA_PARTNER_FEE_BPS)) / BigInt(10000 - NOVA_PARTNER_FEE_BPS), buyToken.decimals, 4)}{' '}
                {buyToken.symbol})
              </span>
            ) : null}
          </span>
        </div>

        {/* Expiry */}
        <div className="mt-3 text-xs">
          <div className="text-gray-500 mb-1.5">Expires in</div>
          <div className="flex flex-wrap gap-1.5">
            {EXPIRY_OPTIONS.map((o) => (
              <button
                key={o.seconds}
                type="button"
                onClick={() => setExpiry(o.seconds)}
                className={`px-2.5 py-1 rounded-full font-semibold border cursor-pointer ${
                  expiry === o.seconds ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
        {success && (
          <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex gap-1.5">
            <CheckCircle2 size={14} className="shrink-0 mt-px" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled || !!busy}
          className="mt-4 w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy === 'approve' ? 'Approving…' : busy === 'place' ? 'Confirm in your wallet…' : action.label}
        </button>

        <div className="mt-3 flex gap-1.5 text-[11px] text-gray-500 leading-relaxed">
          <Info size={13} className="shrink-0 mt-px text-gray-400" />
          <span>
            Same-network only. Placing and cancelling is free (a signature, no gas). A {(NOVA_PARTNER_FEE_BPS / 100).toFixed(2)}% Nova
            fee is included in the signed order and taken only if it fills; you still receive at least the amount shown. Your tokens stay in your wallet until
            the order fills at your price or better. To sell {chain?.wrappedNative.replace(/^W/, '') || 'the native coin'}, use{' '}
            {chain?.wrappedNative}. Powered by CoW Protocol.
          </span>
        </div>
      </div>

      {owner && <LimitOrdersList chainId={chainId} account={owner} refreshKey={ordersRefresh} />}

      {picker && (
        <TokenSelectModal
          chainId={chainId}
          title={picker === 'sell' ? 'Select token to sell' : 'Select token to receive'}
          excludeAddress={picker === 'sell' ? buyToken?.address : sellToken?.address}
          onClose={() => setPicker(null)}
          onSelect={(t) => {
            if (picker === 'sell') setSellToken(t);
            else setBuyToken(t);
            setPicker(null);
            setPriceTouched(false);
            setPriceInput('');
            setMarketPrice('');
          }}
        />
      )}
    </div>
  );
};

const TokenButton: React.FC<{ token: LimitToken | null; onClick: () => void }> = ({ token, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-full bg-white border border-gray-200 hover:border-primary shadow-sm text-sm font-semibold text-gray-900 cursor-pointer"
  >
    {token ? <TokenLogo token={token} size={22} /> : null}
    <span className="max-w-[80px] truncate">{token ? token.symbol : 'Select'}</span>
    <ChevronDown size={14} className="text-gray-400" />
  </button>
);
