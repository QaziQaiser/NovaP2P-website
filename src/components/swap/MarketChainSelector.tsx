import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/** A LI.FI network, as listed by https://li.quest/v1/chains */
export interface MarketChain {
  id: number;
  name: string;
  chainType: string;
  logoURI?: string;
}

// Shown first in the picker and used until the full LI.FI list has loaded
export const POPULAR_MARKET_CHAINS: MarketChain[] = [
  { id: 1, name: 'Ethereum', chainType: 'EVM' },
  { id: 42161, name: 'Arbitrum', chainType: 'EVM' },
  { id: 8453, name: 'Base', chainType: 'EVM' },
  { id: 56, name: 'BSC', chainType: 'EVM' },
  { id: 1151111081099710, name: 'Solana', chainType: 'SVM' },
  { id: 137, name: 'Polygon', chainType: 'EVM' },
  { id: 10, name: 'OP Mainnet', chainType: 'EVM' },
  { id: 43114, name: 'Avalanche', chainType: 'EVM' },
  { id: 728126428, name: 'Tron', chainType: 'TVM' },
  { id: 9270000000000000, name: 'Sui', chainType: 'MVM' },
];
const POPULAR_IDS = POPULAR_MARKET_CHAINS.map((c) => c.id);

// Same chain types the swap widget enables (EVM, Solana, Sui, TRON); testnets are left out
let chainsPromise: Promise<MarketChain[]> | null = null;
function loadLifiChains(): Promise<MarketChain[]> {
  if (!chainsPromise) {
    chainsPromise = fetch('https://li.quest/v1/chains?chainTypes=EVM,SVM,MVM,TVM')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) =>
        (d?.chains || [])
          .filter((c: any) => c && c.mainnet !== false && Number.isFinite(Number(c.id)))
          .map((c: any) => ({ id: Number(c.id), name: String(c.name), chainType: String(c.chainType), logoURI: c.logoURI }))
      )
      .catch(() => {
        chainsPromise = null;
        return [] as MarketChain[];
      });
  }
  return chainsPromise;
}

const TYPE_LABEL: Record<string, string> = { SVM: 'Solana', MVM: 'Sui', TVM: 'TRON' };

const ChainLogo: React.FC<{ chain?: MarketChain; size?: number }> = ({ chain, size = 20 }) => {
  const [broken, setBroken] = useState(false);
  if (chain?.logoURI && !broken) {
    return <img src={chain.logoURI} alt="" width={size} height={size} className="rounded-full shrink-0" onError={() => setBroken(true)} />;
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0"
    >
      {(chain?.name || '?').charAt(0)}
    </span>
  );
};

interface MarketChainSelectorProps {
  value: number;
  onChange: (chainId: number) => void;
}

export const MarketChainSelector: React.FC<MarketChainSelectorProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chains, setChains] = useState<MarketChain[]>(POPULAR_MARKET_CHAINS);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadLifiChains().then((list) => {
      if (alive && list.length) setChains(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const t = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const byId = useMemo(() => new Map(chains.map((c) => [c.id, c])), [chains]);
  const current = byId.get(value) || POPULAR_MARKET_CHAINS.find((c) => c.id === value);

  // Popular networks first, then the rest alphabetically
  const sorted = useMemo(() => {
    const popular = POPULAR_IDS.map((id) => byId.get(id)).filter(Boolean) as MarketChain[];
    const rest = chains.filter((c) => !POPULAR_IDS.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    return [...popular, ...rest];
  }, [chains, byId]);

  const q = query.trim().toLowerCase();
  const filtered = q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : sorted;

  const pick = (id: number) => {
    setOpen(false);
    if (id !== value) onChange(id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Network: ${current?.name || value}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 bg-white border border-gray-200 hover:border-primary rounded-full pl-1.5 pr-3 py-1.5 shadow-sm cursor-pointer outline-none focus-visible:border-primary transition-colors"
      >
        <ChainLogo chain={current} size={22} />
        <span className="max-w-[150px] truncate">{current?.name || 'Select network'}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40 w-[290px] max-w-[calc(100vw-32px)] rounded-2xl bg-white border border-gray-100 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.22)] p-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) pick(filtered[0].id);
              }}
              placeholder={`Search ${chains.length} networks`}
              aria-label="Search networks"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-primary outline-none pl-8 pr-3 py-2 text-[13px]"
            />
          </div>

          {!q && (
            <div className="grid grid-cols-5 gap-1.5 px-0.5 pt-2.5 pb-2 border-b border-gray-100">
              {POPULAR_IDS.map((id) => {
                const c = byId.get(id) || POPULAR_MARKET_CHAINS.find((p) => p.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    title={c?.name}
                    aria-label={c?.name}
                    onClick={() => pick(id)}
                    className={`h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                      id === value ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                    }`}
                  >
                    <ChainLogo chain={c} size={22} />
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-between px-2 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <span>{q ? 'Results' : 'All networks'}</span>
            <span>{filtered.length}</span>
          </div>
          <ul role="listbox" className="max-h-[280px] overflow-y-auto">
            {filtered.length === 0 && <li className="px-3 py-5 text-center text-xs text-gray-400">No network matches “{query}”</li>}
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  onClick={() => pick(c.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-[13px] font-semibold text-gray-900 cursor-pointer transition-colors ${
                    c.id === value ? 'bg-primary/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <ChainLogo chain={c} />
                  <span className="flex-1 min-w-0 truncate">{c.name}</span>
                  {TYPE_LABEL[c.chainType] && (
                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-px">{TYPE_LABEL[c.chainType]}</span>
                  )}
                  {c.id === value && <Check size={14} className="text-primary shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
