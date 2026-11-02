import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  SlidersHorizontal, ChevronDown, ArrowDown, AlertTriangle, 
  Loader2, CheckCircle2, ExternalLink, RefreshCw 
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { Token, DEFAULT_PAY_TOKEN, DEFAULT_RECEIVE_TOKEN } from '../../constants/tokens';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from '../../constants/chains';
import { TokenIcon } from './TokenIcon';
import { TokenSelectModal } from './TokenSelectModal';
import { SwapSettingsModal } from './SwapSettingsModal';
import { getPriceRoute, buildSwapTransaction, PriceRouteResponse, DEFAULT_SPENDERS } from '../../services/veloraApi';
import { parseUnits, formatUnits } from 'ethers';

export const VeloraSwapWidget: React.FC = () => {
  const {
    account,
    chainId,
    isConnected,
    isConnecting,
    connectWallet,
    switchNetwork,
    getTokenBalance,
    checkAllowance,
    approveToken,
    signer,
  } = useWallet();

  // Active Network
  const activeChainId = chainId && SUPPORTED_CHAINS[chainId] ? chainId : DEFAULT_CHAIN_ID;
  const activeChain = SUPPORTED_CHAINS[activeChainId] || SUPPORTED_CHAINS[1];

  // Active Tab: Swap, Limit, OTC, TWAP
  const [activeTab, setActiveTab] = useState<'Swap' | 'Limit' | 'OTC' | 'TWAP'>('Swap');

  // Token Selection
  const [payToken, setPayToken] = useState<Token>(DEFAULT_PAY_TOKEN);
  const [receiveToken, setReceiveToken] = useState<Token>(DEFAULT_RECEIVE_TOKEN);

  // Amounts
  const [payAmount, setPayAmount] = useState<string>('1,000');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [payBalance, setPayBalance] = useState<string>('0.00');
  const [receiveBalance, setReceiveBalance] = useState<string>('0.00');

  // Modals
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'pay' | 'receive'>('pay');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);

  // Settings
  const [slippage, setSlippage] = useState<number>(0.5);
  const [degenMode, setDegenMode] = useState<boolean>(true); // default true to match screenshot
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(20);

  // API Quote & Pricing State
  const [priceRoute, setPriceRoute] = useState<PriceRouteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Approval & Swap Execution State
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<boolean>(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Debounce timer for rate fetching
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch balances when account, tokens, or network changes
  const refreshBalances = useCallback(async () => {
    if (!account) return;
    try {
      const [pBal, rBal] = await Promise.all([
        getTokenBalance(payToken.address, payToken.decimals),
        getTokenBalance(receiveToken.address, receiveToken.decimals),
      ]);
      setPayBalance(parseFloat(pBal).toLocaleString(undefined, { maximumFractionDigits: 4 }));
      setReceiveBalance(parseFloat(rBal).toLocaleString(undefined, { maximumFractionDigits: 4 }));
    } catch (e) {
      console.error('Balance fetch failed:', e);
    }
  }, [account, payToken, receiveToken, getTokenBalance]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Clean numeric string from commas
  const sanitizeNumber = (val: string) => val.replace(/,/g, '').trim();

  // Rate Quote Fetching via Velora / ParaSwap V5 API
  const fetchRate = useCallback(async () => {
    const rawVal = sanitizeNumber(payAmount);
    const num = parseFloat(rawVal);

    if (isNaN(num) || num <= 0) {
      setReceiveAmount('');
      setPriceRoute(null);
      setQuoteError(null);
      return;
    }

    try {
      setIsLoadingQuote(true);
      setQuoteError(null);

      const atomicAmount = parseUnits(num.toString(), payToken.decimals).toString();

      const route = await getPriceRoute({
        srcToken: payToken.address,
        destToken: receiveToken.address,
        amount: atomicAmount,
        srcDecimals: payToken.decimals,
        destDecimals: receiveToken.decimals,
        network: activeChainId,
        userAddress: account || undefined,
      });

      setPriceRoute(route);
      const formattedDest = formatUnits(route.destAmount, receiveToken.decimals);
      setReceiveAmount(parseFloat(formattedDest).toLocaleString(undefined, { maximumFractionDigits: 6 }));

      // Check allowance if user wallet is connected
      if (account) {
        const spender = route.tokenTransferProxy || DEFAULT_SPENDERS[activeChainId] || DEFAULT_SPENDERS[1];
        const allowance = await checkAllowance(payToken.address, spender);
        const requiredAmount = BigInt(atomicAmount);
        setIsApproved(allowance >= requiredAmount);
      }
    } catch (err: any) {
      console.warn('Quote calculation error:', err);
      setQuoteError(err.message || 'Route not found');
    } finally {
      setIsLoadingQuote(false);
    }
  }, [payAmount, payToken, receiveToken, activeChainId, account, checkAllowance]);

  // Debounced rate fetch on amount / token change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRate();
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchRate]);

  // Flip Pay & Receive Tokens
  const handleFlipTokens = () => {
    const tempToken = payToken;
    setPayToken(receiveToken);
    setReceiveToken(tempToken);
    if (receiveAmount) {
      setPayAmount(receiveAmount);
    }
  };

  // Set Max Amount from Balance
  const handleSetMax = () => {
    const cleanBal = payBalance.replace(/,/g, '');
    if (cleanBal && parseFloat(cleanBal) > 0) {
      setPayAmount(cleanBal);
    }
  };

  // Handle Token Approval
  const handleApprove = async () => {
    if (!account || !priceRoute) return;
    try {
      setIsApproving(true);
      setTxError(null);
      const spender = priceRoute.tokenTransferProxy || DEFAULT_SPENDERS[activeChainId] || DEFAULT_SPENDERS[1];
      await approveToken(payToken.address, spender);
      setIsApproved(true);
    } catch (err: any) {
      setTxError(err.message || 'Token approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Swap Execution
  const handleSwap = async () => {
    if (!account || !signer || !priceRoute) return;

    try {
      setIsSwapping(true);
      setTxError(null);
      setTxSuccess(false);

      const rawVal = sanitizeNumber(payAmount);
      const atomicAmount = parseUnits(rawVal, payToken.decimals).toString();

      // Build transaction through Velora API
      const txData = await buildSwapTransaction({
        srcToken: payToken.address,
        destToken: receiveToken.address,
        srcAmount: atomicAmount,
        destAmount: priceRoute.destAmount,
        priceRoute,
        userAddress: account,
        network: activeChainId,
        slippageBps: Math.round(slippage * 100),
      });

      // Submit transaction via connected signer
      const tx = await signer.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value || '0',
        gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
      });

      setTxHash(tx.hash);
      await tx.wait(1);
      setTxSuccess(true);
      refreshBalances();
    } catch (err: any) {
      console.error('Swap failed:', err);
      setTxError(err.reason || err.message || 'Swap transaction was rejected or failed');
    } finally {
      setIsSwapping(false);
    }
  };

  // Compute button state
  const rawPayNum = parseFloat(sanitizeNumber(payAmount));
  const rawPayBal = parseFloat(sanitizeNumber(payBalance));
  const isInsufficientBalance = isConnected && !isNaN(rawPayNum) && !isNaN(rawPayBal) && rawPayNum > rawPayBal && rawPayBal > 0;

  return (
    <div className="w-full max-w-[480px] mx-auto">
      {/* Widget Card */}
      <div className="bg-white rounded-[28px] border border-gray-100 shadow-2xl shadow-gray-200/60 p-5 md:p-6 transition-all relative">
        
        {/* Top Header & Tabs */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-5 sm:gap-6">
            {(['Swap', 'Limit', 'OTC', 'TWAP'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm sm:text-base font-semibold transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'text-gray-900 font-bold'
                    : 'text-gray-400 hover:text-gray-700 font-medium'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Settings Tune Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
            title="Swap settings"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* PAY SECTION CARD */}
        <div className="bg-[#f5f6f8] rounded-2xl p-4 transition-colors">
          {/* Pay Top Row */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <div className="relative">
              <button
                onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                className="flex items-center gap-1.5 font-medium hover:text-gray-800 transition-colors cursor-pointer"
              >
                Pay on <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span> {activeChain.name}
                <ChevronDown size={14} />
              </button>

              {/* Network Dropdown */}
              {isNetworkDropdownOpen && (
                <div className="absolute left-0 top-6 z-30 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 w-40 animate-in fade-in zoom-in-95">
                  {Object.values(SUPPORTED_CHAINS).map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        switchNetwork(chain.id);
                        setIsNetworkDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {chain.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Wallet Balance Display & Max button */}
            {isConnected && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Balance: {payBalance}</span>
                <button
                  onClick={handleSetMax}
                  className="text-[#ff5500] hover:underline font-semibold text-[11px] cursor-pointer"
                >
                  MAX
                </button>
              </div>
            )}
          </div>

          {/* Pay Input & Token Selector */}
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0"
              className="text-3xl sm:text-4xl font-medium tracking-tight text-gray-900 bg-transparent outline-none w-full placeholder:text-gray-300"
            />

            {/* Token Selector Pill */}
            <button
              onClick={() => {
                setSelectingFor('pay');
                setIsTokenModalOpen(true);
              }}
              className="bg-white hover:bg-gray-50 border border-gray-200/80 shadow-xs px-3.5 py-1.5 rounded-full flex items-center gap-2 font-bold text-sm text-gray-800 transition-all cursor-pointer shrink-0"
            >
              <TokenIcon symbol={payToken.symbol} size={22} />
              <span>{payToken.symbol}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* SWITCH BUTTON (Circle in the middle) */}
        <div className="relative flex justify-center -my-3 z-10">
          <button
            onClick={handleFlipTokens}
            className="w-9 h-9 rounded-full bg-white border border-gray-200/90 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 cursor-pointer"
            title="Switch tokens"
          >
            <ArrowDown size={16} />
          </button>
        </div>

        {/* RECEIVE SECTION CARD */}
        <div className="bg-[#f5f6f8] rounded-2xl p-4 transition-colors">
          {/* Receive Top Row */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <div className="flex items-center gap-1.5 font-medium">
              Receive on <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span> {activeChain.name}
            </div>

            {isConnected && (
              <div className="text-xs text-gray-500">
                Balance: {receiveBalance}
              </div>
            )}
          </div>

          {/* Receive Amount Output & Token Selector */}
          <div className="flex items-center justify-between gap-3">
            <div className="w-full">
              {isLoadingQuote ? (
                <div className="h-9 w-36 bg-gray-200/80 rounded-lg animate-pulse"></div>
              ) : (
                <div className="text-3xl sm:text-4xl font-medium tracking-tight text-gray-900 truncate">
                  {receiveAmount || (
                    <div className="h-9 w-40 bg-gray-200/60 rounded-lg"></div>
                  )}
                </div>
              )}
            </div>

            {/* Token Selector Pill */}
            <button
              onClick={() => {
                setSelectingFor('receive');
                setIsTokenModalOpen(true);
              }}
              className="bg-white hover:bg-gray-50 border border-gray-200/80 shadow-xs px-3.5 py-1.5 rounded-full flex items-center gap-2 font-bold text-sm text-gray-800 transition-all cursor-pointer shrink-0"
            >
              <TokenIcon symbol={receiveToken.symbol} size={22} />
              <span>{receiveToken.symbol}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* PRICE IMPACT / DEGEN MODE ALERT BOX (Matches Screenshot) */}
        <div className="mt-4 bg-rose-50/70 border border-rose-200/70 rounded-2xl p-3.5 flex items-start gap-2.5">
          <AlertTriangle size={17} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-500 leading-snug">
            <div className="font-semibold text-rose-600">
              Price impact couldn't be calculated.
            </div>
            <div className="text-rose-500/90 mt-0.5">
              Ape in anyway with <span className="font-medium underline decoration-rose-400 cursor-pointer" onClick={() => setIsSettingsOpen(true)}>Degen Mode enabled</span> (Not recommended).
            </div>
          </div>
        </div>

        {/* PRIMARY CTA BUTTON (Vibrant Orange / Connect Wallet) */}
        <div className="mt-4">
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full py-4 px-6 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-semibold rounded-2xl text-base shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting Wallet...
                </>
              ) : (
                'Connect Wallet'
              )}
            </button>
          ) : !payAmount || parseFloat(sanitizeNumber(payAmount)) <= 0 ? (
            <button
              disabled
              className="w-full py-4 px-6 bg-gray-200 text-gray-400 font-semibold rounded-2xl text-base cursor-not-allowed"
            >
              Enter an amount
            </button>
          ) : isInsufficientBalance ? (
            <button
              disabled
              className="w-full py-4 px-6 bg-gray-200 text-gray-400 font-semibold rounded-2xl text-base cursor-not-allowed"
            >
              Insufficient {payToken.symbol} Balance
            </button>
          ) : !isApproved ? (
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="w-full py-4 px-6 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-semibold rounded-2xl text-base shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isApproving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Approving {payToken.symbol}...
                </>
              ) : (
                `Approve ${payToken.symbol}`
              )}
            </button>
          ) : (
            <button
              onClick={handleSwap}
              disabled={isSwapping || isLoadingQuote}
              className="w-full py-4 px-6 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-semibold rounded-2xl text-base shadow-lg shadow-orange-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSwapping ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Confirming Swap in Wallet...
                </>
              ) : isLoadingQuote ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Fetching Best Route...
                </>
              ) : (
                'Swap'
              )}
            </button>
          )}
        </div>

        {/* DETAILS ACCORDION & ROWS (Matches Screenshot) */}
        <div className="mt-3.5 space-y-2">
          {/* Rate & Status Row */}
          <div className="bg-[#f5f6f8] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-gray-500 font-mono">
            <span className="font-semibold text-gray-700">
              {priceRoute && receiveAmount
                ? `1 ${payToken.symbol} ≈ ${(parseFloat(sanitizeNumber(receiveAmount)) / parseFloat(sanitizeNumber(payAmount) || '1')).toFixed(4)} ${receiveToken.symbol}`
                : '-'}
            </span>
            <span className="text-rose-500 flex items-center gap-1 font-medium">
              ~ Not Available <ChevronDown size={14} />
            </span>
          </div>

          {/* Swap Mode Row */}
          <div className="bg-[#f5f6f8] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-gray-500 font-mono">
            <span>Swap Mode</span>
            <span className="font-medium text-gray-800 flex items-center gap-1">
              Market <ChevronDown size={14} />
            </span>
          </div>
        </div>

        {/* FOOTER: POWERED BY VELORA PROTOCOL (Matches Screenshot) */}
        <div className="mt-4 pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-mono">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-gray-400" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>Powered by Velora Protocol</span>
        </div>

        {/* Transaction Feedback Notification (Toast) */}
        {txSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Swap executed successfully!</span>
            </div>
            {txHash && (
              <a
                href={`${activeChain.blockExplorerUrls[0]}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline flex items-center gap-1 font-medium"
              >
                View <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {txError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {txError}
          </div>
        )}
      </div>

      {/* Token Selection Modal */}
      <TokenSelectModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        selectedToken={selectingFor === 'pay' ? payToken : receiveToken}
        chainId={activeChainId}
        onSelect={(token) => {
          if (selectingFor === 'pay') {
            if (token.symbol === receiveToken.symbol) {
              setReceiveToken(payToken);
            }
            setPayToken(token);
          } else {
            if (token.symbol === payToken.symbol) {
              setPayToken(receiveToken);
            }
            setReceiveToken(token);
          }
        }}
      />

      {/* Swap Settings Modal */}
      <SwapSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        slippage={slippage}
        setSlippage={setSlippage}
        degenMode={degenMode}
        setDegenMode={setDegenMode}
        deadlineMinutes={deadlineMinutes}
        setDeadlineMinutes={setDeadlineMinutes}
      />
    </div>
  );
};

