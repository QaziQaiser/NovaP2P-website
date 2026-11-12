import React from 'react';
import { Wallet, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useWallet } from '../../context/WalletContext';

interface WalletConnectGateProps {
  title: string;
  subtitle: string;
  badgeText?: string;
  accentColor?: 'primary' | 'teal';
}

export const WalletConnectGate: React.FC<WalletConnectGateProps> = ({
  title,
  subtitle,
  badgeText = 'Wallet Authentication Required',
  accentColor = 'primary',
}) => {
  const { connectWallet, isConnecting } = useWallet();

  const isTeal = accentColor === 'teal';

  return (
    <div
      className={`rounded-3xl p-8 md:p-10 text-center border transition-all ${
        isTeal
          ? 'bg-[#0b131e] border-teal-500/25 text-white shadow-2xl shadow-teal-950/30'
          : 'bg-white border-gray-200 text-gray-900 shadow-xl shadow-gray-200/60'
      }`}
    >
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 ${
          isTeal
            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
            : 'bg-blue-50 text-primary border border-blue-100'
        }`}
      >
        <ShieldCheck size={14} />
        <span>{badgeText}</span>
      </div>

      <div
        className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-6 ${
          isTeal
            ? 'bg-gradient-to-br from-teal-500/25 to-emerald-500/10 border border-teal-400/30 text-teal-400'
            : 'bg-gradient-to-br from-primary/15 to-blue-100 border border-blue-200 text-primary'
        }`}
      >
        <Wallet size={30} />
      </div>

      <h2 className="text-2xl md:text-3xl font-bold mb-3">{title}</h2>
      <p className={`max-w-lg mx-auto mb-8 text-sm md:text-base leading-relaxed ${isTeal ? 'text-slate-400' : 'text-gray-600'}`}>
        {subtitle}
      </p>

      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className={`inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl font-semibold text-sm sm:text-base whitespace-nowrap transition-all cursor-pointer disabled:opacity-60 ${
          isTeal
            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/25'
            : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/30'
        }`}
      >
        {isConnecting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Connecting Wallet...
          </>
        ) : (
          <>
            <Wallet size={18} />
            Connect Wallet to Continue
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <p className={`mt-5 text-xs ${isTeal ? 'text-slate-500' : 'text-gray-400'}`}>
        Supports MetaMask, Trust Wallet, Coinbase Wallet, Phantom, TronLink &amp; WalletConnect
      </p>
    </div>
  );
};

