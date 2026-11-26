import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { loadLimitTokens, type LimitToken } from './limitTokens';

interface TokenSelectModalProps {
  chainId: number;
  title: string;
  excludeAddress?: string;
  onSelect: (token: LimitToken) => void;
  onClose: () => void;
}

export const TokenLogo: React.FC<{ token?: LimitToken | null; size?: number }> = ({ token, size = 28 }) => {
  const [failed, setFailed] = useState(false);
  if (!token) return null;
  if (!token.logoURI || failed) {
    return (
      <span
        className="rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {token.symbol.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={token.logoURI}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="rounded-full shrink-0 bg-gray-100"
      style={{ width: size, height: size }}
    />
  );
};

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({ chainId, title, excludeAddress, onSelect, onClose }) => {
  const [tokens, setTokens] = useState<LimitToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadLimitTokens(chainId)
      .then((list) => alive && setTokens(list))
      .catch(() => alive && setError('Could not load tokens. Please try again.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [chainId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tokens.filter((t) => t.address.toLowerCase() !== (excludeAddress || '').toLowerCase());
    if (!q) return list.slice(0, 150);
    // exact symbol, then symbol prefix, then other matches
    const score = (t: LimitToken) => {
      const s = t.symbol.toLowerCase();
      return s === q || t.address.toLowerCase() === q ? 0 : s.startsWith(q) ? 1 : 2;
    };
    return list
      .filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase() === q)
      .sort((a, b) => score(a) - score(b))
      .slice(0, 150);
  }, [tokens, query, excludeAddress]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 focus-within:border-primary">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, symbol or address"
              className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="overflow-y-auto px-2 pb-4 min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {error && <div className="text-center text-sm text-red-500 py-8">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-8">No tokens found</div>
          )}
          {!loading &&
            !error &&
            filtered.map((t) => (
              <button
                key={t.address}
                onClick={() => onSelect(t)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50 text-left cursor-pointer"
              >
                <TokenLogo token={t} size={32} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{t.symbol}</div>
                  <div className="text-xs text-gray-500 truncate">{t.name}</div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
