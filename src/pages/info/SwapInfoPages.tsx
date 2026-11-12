import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowRightLeft,
  Coins,
  Route,
  CheckCircle2,
  Radar,
  Globe,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';

export const HowSwapWorksPage: React.FC = () => {
  useEffect(() => {
    document.title = 'How Swap Works — Nova Swap | Universal Cross-Chain DEX';
    window.scrollTo(0, 0);
  }, []);

  const steps = [
    {
      step: '01',
      title: 'Connect Your Wallet',
      desc: 'Click Connect Wallet and choose MetaMask, Trust Wallet, Coinbase Wallet, Phantom, TronLink, Sui Wallet, or any mobile wallet via WalletConnect.',
      icon: <Wallet className="text-primary" size={24} />,
    },
    {
      step: '02',
      title: 'Select Source Token & Chain',
      desc: 'Choose the blockchain network and cryptocurrency you currently hold (for example USDC on Ethereum, BNB on BSC, or SOL on Solana).',
      icon: <Layers className="text-primary" size={24} />,
    },
    {
      step: '03',
      title: 'Select Destination Token & Chain',
      desc: 'Choose the exact network and token you want to receive — whether on the same chain or cross-chain across 70+ supported networks.',
      icon: <Coins className="text-primary" size={24} />,
    },
    {
      step: '04',
      title: 'Enter Amount',
      desc: 'Type the amount you want to swap or use quick percentage buttons (25%, 50%, 75%, MAX) based on your live wallet balance.',
      icon: <ArrowRightLeft className="text-primary" size={24} />,
    },
    {
      step: '05',
      title: 'Review Best Route (Powered by LI.FI)',
      desc: 'Our aggregator scans dozens of DEXs and bridges via LI.FI in real time to find the fastest, lowest-slippage, highest-return route automatically.',
      icon: <Route className="text-primary" size={24} />,
    },
    {
      step: '06',
      title: 'Confirm Transaction',
      desc: 'Review the transparent fee and output quote breakdown, then sign and approve the transaction directly inside your own self-custody wallet.',
      icon: <CheckCircle2 className="text-primary" size={24} />,
    },
    {
      step: '07',
      title: 'Track Until Tokens Arrive',
      desc: 'Follow live bridge and confirmation status in real time until your tokens settle safely into your destination wallet.',
      icon: <Radar className="text-primary" size={24} />,
    },
  ];

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary text-xs sm:text-sm font-semibold mb-4">
            <Zap size={14} /> Powered by LI.FI • 70+ Chains Supported
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            How Nova Swap Works
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Swap and bridge tokens seamlessly across <strong>70+ EVM and Non-EVM blockchains</strong> in a few simple, non-custodial steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {steps.map((item) => (
            <div
              key={item.step}
              className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Step {item.step}</span>
                <h2 className="text-lg font-bold text-gray-900 mt-0.5 mb-2">{item.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center shadow-sm">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Make Your First Cross-Chain Swap?</h3>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto text-sm sm:text-base">
            Enjoy automated best-rate routing across 70+ blockchains and earn 5% cashback on eligible Nova Swap trading fees.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/swap"
              className="px-8 py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm sm:text-base shadow-lg shadow-primary/25 flex items-center gap-2"
            >
              Start Swapping Now <ArrowRight size={18} />
            </Link>
            <Link
              to="/supported-chains"
              className="px-8 py-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-sm sm:text-base"
            >
              View Supported Chains
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SupportedChainsPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Supported Chains — Nova Swap | 70+ Blockchains';
    window.scrollTo(0, 0);
  }, []);

  const majorChains = [
    { name: 'Ethereum', badge: 'EVM • Layer 1', desc: 'Mainnet DeFi, ETH, USDT, USDC, and ERC-20 liquidity.' },
    { name: 'Arbitrum One', badge: 'EVM • Layer 2', desc: 'Ultra-fast Ethereum scaling with low gas fees.' },
    { name: 'Optimism', badge: 'EVM • Layer 2', desc: 'High-speed OP Mainnet swaps & native bridging.' },
    { name: 'Base', badge: 'EVM • Layer 2', desc: 'Coinbase-backed Layer 2 ecosystem & deep USDC liquidity.' },
    { name: 'Polygon', badge: 'EVM • PoS', desc: 'Low-cost POL, USDT, and USDC multi-chain transfers.' },
    { name: 'BNB Smart Chain', badge: 'EVM • BSC', desc: 'High-volume BEP-20 swapping across PancakeSwap & aggregators.' },
    { name: 'Avalanche', badge: 'EVM • C-Chain', desc: 'Sub-second finality swaps and AVAX ecosystem tokens.' },
    { name: 'Solana', badge: 'Non-EVM • SPL', desc: 'Lightning-fast SOL & SPL tokens via Phantom / Solflare.' },
    { name: 'Bitcoin', badge: 'UTXO • Native', desc: 'Cross-chain BTC liquidity via decentralized bridge routes.' },
    { name: 'Sui', badge: 'Non-EVM • Move', desc: 'Next-gen SUI swaps via Sui Wallet and native aggregators.' },
    { name: 'TRON', badge: 'Non-EVM • TRC20', desc: 'High-throughput TRX & TRC-20 USDT transfers via TronLink.' },
    { name: 'Stellar', badge: 'Non-EVM • XLM', desc: 'Fast cross-border Stellar asset routing and settlement.' },
  ];

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary text-xs sm:text-sm font-semibold mb-4">
            <Globe size={14} /> 70+ Blockchains Dynamically Supported
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Supported Chains &amp; Networks
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Nova Swap connects over <strong>70+ blockchains dynamically</strong> through LI.FI routing infrastructure, bridging EVM and Non-EVM ecosystems in one interface.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {majorChains.map((chain) => (
            <div
              key={chain.name}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">{chain.name}</h2>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-primary border border-blue-100">
                  {chain.badge}
                </span>
              </div>
              <p className="text-sm text-gray-600">{chain.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-primary to-blue-700 rounded-3xl p-8 text-white text-center shadow-xl">
          <h3 className="text-2xl font-bold mb-2">Plus 60+ Additional Rollups, AppChains &amp; L1s</h3>
          <p className="text-blue-100 text-sm sm:text-base max-w-2xl mx-auto mb-6">
            Including Linea, Scroll, zkSync Era, Blast, Mantle, Sonic, Berachain, Polygon zkEVM, Fantom, Gnosis, Cronos, Sei, Metis, Mode, Taiko, and more — updated automatically in the Swap Widget.
          </p>
          <Link
            to="/swap"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-primary font-bold text-sm hover:bg-blue-50 transition-colors"
          >
            Launch Nova Swap <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export const SwapFeesPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Swap Fees — Nova Swap | Transparent Pricing & 5% Cashback';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs sm:text-sm font-semibold mb-4">
            <ShieldCheck size={14} /> 100% Transparent Fee Breakdown
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nova Swap Fees
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Best route selected automatically. Clear breakdown shown before confirmation with zero hidden markups.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-10 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-100">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Platform Trading Fee</h2>
              <div className="text-3xl font-extrabold text-primary mb-2">0.5%</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Flat, transparent 0.5% integrator fee displayed upfront in the route quote before you confirm any swap.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <h2 className="text-lg font-bold text-gray-900 mb-2">User Swap Cashback</h2>
              <div className="text-3xl font-extrabold text-emerald-600 mb-2">5% Cashback</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every normal user receives 5% cashback on eligible Nova Swap trading fees — whether swapping directly or via a Partner/BDM link.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-3">
              <Sparkles className="text-primary shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-bold text-gray-900">Automatic Best-Route Selection</h3>
                <p className="text-sm text-gray-600">
                  Our smart routing engine compares liquidity sources across DEXs and cross-chain bridges to pick the highest net return automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Zap className="text-primary shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-bold text-gray-900">Network Gas &amp; Bridge Costs</h3>
                <p className="text-sm text-gray-600">
                  Standard blockchain gas fees and underlying bridge protocol fees are shown transparently inside the preview screen before you sign. There are never any hidden platform charges.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 text-center">
            <Link
              to="/swap"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-lg shadow-primary/25"
            >
              Try Nova Swap Now <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
