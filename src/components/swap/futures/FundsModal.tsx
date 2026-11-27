import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  ARBITRUM_CHAIN_ID,
  ARBITRUM_USDC,
  MIN_DEPOSIT_USDC,
  WITHDRAW_FEE_USDC,
  depositUsdc,
  hlErrorMessage,
  isUserRejection,
  transferUsdc,
  withdrawUsdc,
} from './hlClient';
import { readTokenBalance } from '../limit/limitTokens';
import type { PerpAccount } from './useHyperliquid';
import { cleanDecimal, fmtUsd, parseInput } from './format';

export type FundsTab = 'deposit' | 'withdraw';

interface FundsModalProps {
  user: string;
  account: PerpAccount | null;
  initialTab: FundsTab;
  onClose: () => void;
  onDone: () => void;
}

/** Deposit USDC from Arbitrum to Hyperliquid, or withdraw back to Arbitrum. */
export const FundsModal: React.FC<FundsModalProps> = ({ user, account, initialTab, onClose, onDone }) => {
  const [tab, setTab] = useState<FundsTab>(initialTab);
  const [amount, setAmount] = useState('');
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    readTokenBalance(ARBITRUM_CHAIN_ID, ARBITRUM_USDC, user)
      .then((b) => alive && setWalletUsdc(Number(b) / 1e6))
      .catch(() => alive && setWalletUsdc(null));
    return () => {
      alive = false;
    };
  }, [user, success]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [busy, onClose]);

  const switchTab = (t: FundsTab) => {
    setTab(t);
    setAmount('');
    setError(null);
    setSuccess(null);
  };

  // Withdrawable: perps balance, or spot USDC too for unified accounts
  const withdrawable = account ? (account.unified ? Math.max(account.withdrawable, account.spotUsdcFree) : account.withdrawable) : 0;
  const spotOnly = account && !account.unified ? account.spotUsdcFree : 0;
  const max = tab === 'deposit' ? walletUsdc ?? 0 : withdrawable;
  const n = parseInput(amount);

  let action: { label: string; disabled?: boolean } = { label: tab === 'deposit' ? 'Deposit' : 'Withdraw' };
  if (!(n > 0)) action = { label: 'Enter an amount', disabled: true };
  else if (tab === 'deposit' && n < MIN_DEPOSIT_USDC) action = { label: `Minimum deposit is ${MIN_DEPOSIT_USDC} USDC`, disabled: true };
  else if (tab === 'withdraw' && n <= WITHDRAW_FEE_USDC) action = { label: `Must be more than the ${WITHDRAW_FEE_USDC} USDC fee`, disabled: true };
  else if (n > max + 1e-9) action = { label: 'Insufficient balance', disabled: true };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const value = n.toFixed(6).replace(/\.?0+$/, '');
      if (tab === 'deposit') {
        await depositUsdc(user, value);
        setSuccess(`Deposited ${value} USDC. It usually shows in your Futures balance within a minute.`);
      } else {
        await withdrawUsdc(user, value);
        setSuccess(`Withdrawal of ${value} USDC sent. It arrives in your wallet on Arbitrum in about 5 minutes (minus the ${WITHDRAW_FEE_USDC} USDC fee).`);
      }
      setAmount('');
      onDone();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(hlErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const moveSpotToPerps = async () => {
    setBusy(true);
    setError(null);
    try {
      await transferUsdc(user, spotOnly.toFixed(6).replace(/\.?0+$/, ''), true);
      setSuccess('Moved your spot USDC to your Futures balance.');
      onDone();
    } catch (err: any) {
      if (!isUserRejection(err)) setError(hlErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onMouseDown={() => !busy && onClose()}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-gray-100 text-sm font-bold">
            {(['deposit', 'withdraw'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={`px-4 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                {t === 'deposit' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                {t === 'deposit' ? 'Deposit' : 'Withdraw'}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>{tab === 'deposit' ? 'From your wallet (USDC on Arbitrum)' : 'To your wallet (USDC on Arbitrum)'}</span>
          <button type="button" onClick={() => max > 0 && setAmount(String(Math.floor(max * 1e6) / 1e6))} className="hover:text-primary cursor-pointer">
            {tab === 'deposit' ? 'Wallet' : 'Available'}: {tab === 'deposit' && walletUsdc === null ? '…' : fmtUsd(max)}{' '}
            <span className="font-bold text-primary">MAX</span>
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-gray-50 border border-gray-100 focus-within:border-primary/50 px-4 py-3">
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(cleanDecimal(e.target.value))}
            className="flex-1 min-w-0 bg-transparent outline-none text-2xl font-semibold text-gray-900 placeholder:text-gray-300 tabular-nums"
          />
          <span className="text-sm font-bold text-gray-500">USDC</span>
        </div>

        <ul className="mt-3 space-y-1 text-[11px] text-gray-500 leading-relaxed">
          {tab === 'deposit' ? (
            <>
              <li>• Sends USDC on Arbitrum to Hyperliquid's official bridge. Your wallet will ask to switch to Arbitrum if needed.</li>
              <li>• Minimum {MIN_DEPOSIT_USDC} USDC. Smaller amounts are not credited by the bridge.</li>
              <li>• You need a little ETH on Arbitrum for gas. Have USDC elsewhere? Use the Cross Chain tab to bring it to Arbitrum.</li>
            </>
          ) : (
            <>
              <li>• Signed in your wallet, no gas needed. Hyperliquid charges a {WITHDRAW_FEE_USDC} USDC withdrawal fee.</li>
              <li>• Funds arrive in this wallet on Arbitrum in about 5 minutes.</li>
              <li>• Margin used by open positions cannot be withdrawn.</li>
            </>
          )}
        </ul>

        {tab === 'withdraw' && spotOnly >= 1 && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 flex items-center justify-between gap-2">
            <span>You have {fmtUsd(spotOnly)} USDC in your Hyperliquid spot balance.</span>
            <button type="button" onClick={moveSpotToPerps} disabled={busy} className="shrink-0 font-bold text-primary hover:underline cursor-pointer">
              Move to Futures
            </button>
          </div>
        )}

        {error && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}
        {success && (
          <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex gap-1.5">
            <CheckCircle2 size={14} className="shrink-0 mt-px" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={action.disabled || busy}
          className="mt-4 w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? 'Confirm in your wallet…' : action.label}
        </button>
      </div>
    </div>
  );
};
