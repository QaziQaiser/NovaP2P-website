import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NovaSwapSection } from '../components/swap/NovaSwapSection';

export const SwapPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Nova Swap – Swap Crypto Across 70+ Chains | NovaP2P';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-28 pb-16 bg-gradient-to-b from-blue-50/40 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Nova Swap: Cross-Chain Crypto Swap
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-3 leading-relaxed">
            Swap USDT, USDC, ETH and more across 70+ blockchains from your own wallet. Nova Swap finds the
            best route, shows the full cost before you sign and never takes custody of your funds.
          </p>
        </div>

        <NovaSwapSection showHeader={false} />

        <section className="max-w-3xl mx-auto mt-16 px-4 text-gray-600 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">How a swap works</h2>
            <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
              <li>
                Connect MetaMask, Trust Wallet, Coinbase Wallet, Phantom, TronLink, Sui Wallet or any mobile
                wallet through WalletConnect.
              </li>
              <li>
                Choose the token and chain you hold, then the token and chain you want to receive, on the same
                chain or on another one.
              </li>
              <li>
                Nova Swap compares DEXs and bridges through LI.FI and picks the route with the best net return.
              </li>
              <li>
                Review the quote and fee breakdown, sign once in your own wallet and track the swap until your
                tokens arrive.
              </li>
            </ol>
            <p className="mt-3">
              <Link to="/how-swap-works" className="text-primary font-medium hover:underline">
                Read the full step-by-step guide
              </Link>
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Fees and cashback</h2>
            <p className="leading-relaxed">
              Nova Swap charges a 0.5% platform fee plus a 0.25% LI.FI routing fee, both shown in every quote. Network gas and bridge costs are
              listed in the preview before you sign, so there are no hidden charges. Every user gets 5% cashback
              on eligible swap fees.{' '}
              <Link to="/swap-fees" className="text-primary font-medium hover:underline">
                See the full fee breakdown
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Supported blockchains</h2>
            <p className="leading-relaxed">
              Swap between Ethereum, Arbitrum, Optimism, Base, Polygon, BNB Smart Chain, Avalanche, Solana,
              Bitcoin, Sui, TRON, Stellar and more, with 70+ networks connected through LI.FI routing.{' '}
              <Link to="/supported-chains" className="text-primary font-medium hover:underline">
                View all supported chains
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
