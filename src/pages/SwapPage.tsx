import React, { useEffect } from 'react';
import { NovaSwapSection } from '../components/swap/NovaSwapSection';

export const SwapPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Nova Swap — Cross-Chain DEX | NovaP2P';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-28 pb-16 bg-gradient-to-b from-blue-50/40 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <NovaSwapSection />
      </div>
    </div>
  );
};

