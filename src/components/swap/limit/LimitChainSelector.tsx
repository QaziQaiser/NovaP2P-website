import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { COW_CHAINS, LIMIT_UNSUPPORTED_CHAINS, chainDisplayName } from './cowApi';

// Chain logos from the LI.FI chain list (loaded once; a letter badge is shown until then)
let logosPromise: Promise<Map<number, string>> | null = null;
function loadChainLogos(): Promise<Map<number, string>> {
  if (!logosPromise) {
    logosPromise = fetch('https://li.quest/v1/chains?chainTypes=EVM')
      .then((r) => (r.ok ? r.json() : { chains: [] }))
      .then((d) => new Map<number, string>((d?.chains || []).filter((c: any) => c?.logoURI).map((c: any) => [Number(c.id), c.logoURI])))
      .catch(() => {
        logosPromise = null;
        return new Map<number, string>();
      });
  }
  return logosPromise;
}

const ChainLogo: React.FC<{ chainId: number; logos: Map<number, string>; size?: number }> = ({ chainId, logos, size = 18 }) => {
  const [broken, setBroken] = useState(false);
  const src = logos.get(chainId);
  if (src && !broken) {
    return <img src={src} alt="" width={size} height={size} className="rounded-full shrink-0" onError={() => setBroken(true)} />;
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center shrink-0"
    >
      {chainDisplayName(chainId).charAt(0)}
    </span>
  );
};

interface LimitChainSelectorProps {
  value: number;
  walletChainId: number | null;
  onChange: (chainId: number) => void;
}

export const LimitChainSelector: React.FC<LimitChainSelectorProps> = ({ value, walletChainId, onChange }) => {
  const [open, setOpen] = useState(false);
  const [logos, setLogos] = useState<Map<number, string>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadChainLogos().then((m) => alive && setLogos(m));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (id: number) => {
    setOpen(false);
    if (id !== value) onChange(id);
  };

  const row = (id: number, supported: boolean) => (
    <li key={id}>
      <button
        type="button"
        role="option"
        aria-selected={id === value}
        onClick={() => pick(id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] cursor-pointer transition-colors ${
          id === value ? 'bg-primary/10' : 'hover:bg-gray-50'
        } ${supported ? 'text-gray-900 font-semibold' : 'text-gray-400 font-medium'}`}
      >
        <span className={supported ? '' : 'opacity-50 grayscale'}>
          <ChainLogo chainId={id} logos={logos} size={20} />
        </span>
        <span className="flex-1 min-w-0 truncate">{chainDisplayName(id)}</span>
        {walletChainId === id && (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-px">
            Wallet
          </span>
        )}
        {id === value && <Check size={14} className="text-primary shrink-0" />}
      </button>
    </li>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Network: ${chainDisplayName(value)}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 hover:border-primary rounded-full pl-1.5 pr-2.5 py-1 cursor-pointer outline-none focus-visible:border-primary"
      >
        <ChainLogo chainId={value} logos={logos} />
        <span className="max-w-[110px] truncate">{chainDisplayName(value)}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-[230px] max-w-[calc(100vw-48px)] rounded-2xl bg-white border border-gray-100 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.18)] p-1.5">
          <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Limit order networks</div>
          <ul role="listbox" className="max-h-[300px] overflow-y-auto">
            {COW_CHAINS.map((c) => row(c.id, true))}
            <li className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100 mt-1">
              Not supported yet
            </li>
            {LIMIT_UNSUPPORTED_CHAINS.map((c) => row(c.id, false))}
          </ul>
        </div>
      )}
    </div>
  );
};
