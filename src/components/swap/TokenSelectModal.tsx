import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Token, POPULAR_TOKENS } from '../../constants/tokens';
import { useWallet } from '../../context/WalletContext';
import { TokenIcon } from './TokenIcon';

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: Token;
  chainId: number;
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  chainId,
}) => {
  const [search, setSearch] = useState('');
  const [balances, setBalances] = useState<Record<string, string>>({});
  const { account, getTokenBalance } = useWallet();

  const tokenList = POPULAR_TOKENS[chainId] || POPULAR_TOKENS[1];

  // Fetch balances for popular tokens if connected
  useEffect(() => {
    if (!account || !isOpen) return;

    let isMounted = true;
    const fetchAllBalances = async () => {
      const balanceMap: Record<string, string> = {};
      for (const token of tokenList) {
        try {
          const bal = await getTokenBalance(token.address, token.decimals);
          if (isMounted) {
            balanceMap[token.symbol] = parseFloat(bal).toFixed(4);
          }
        } catch {
          balanceMap[token.symbol] = '0.00';
        }
      }
      if (isMounted) {
        setBalances(balanceMap);
      }
    };

    fetchAllBalances();
    return () => {
      isMounted = false;
    };
  }, [account, isOpen, chainId, getTokenBalance]);

  if (!isOpen) return null;

  const filteredTokens = tokenList.filter((token) => {
    const q = search.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-900">Select a token</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, symbol, or paste address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5500]/30 focus:border-[#ff5500] text-gray-800 transition-all"
            />
          </div>
        </div>

        {/* Quick select pills */}
        <div className="px-4 py-3 flex gap-2 flex-wrap bg-gray-50/50">
          {tokenList.slice(0, 4).map((token) => (
            <button
              key={token.symbol}
              onClick={() => {
                onSelect(token);
                onClose();
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                selectedToken?.symbol === token.symbol
                  ? 'bg-orange-50 border-[#ff5500] text-[#ff5500]'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TokenIcon symbol={token.symbol} size={16} />
              {token.symbol}
            </button>
          ))}
        </div>

        {/* Token List */}
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 p-2">
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No tokens found matching "{search}"
            </div>
          ) : (
            filteredTokens.map((token) => {
              const isSelected = selectedToken?.symbol === token.symbol;
              const bal = balances[token.symbol];

              return (
                <div
                  key={token.symbol}
                  onClick={() => {
                    onSelect(token);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-orange-50/60' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={token.symbol} size={36} />
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                        {token.symbol}
                        {isSelected && (
                          <span className="text-xs bg-orange-100 text-[#ff5500] font-medium px-2 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{token.name}</div>
                    </div>
                  </div>

                  {account && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {bal !== undefined ? bal : '...'}
                      </div>
                      <div className="text-xs text-gray-400">Balance</div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

