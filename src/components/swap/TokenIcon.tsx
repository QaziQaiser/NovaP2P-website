import React from 'react';

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export const TokenIcon: React.FC<TokenIconProps> = ({ symbol, size = 24, className = '' }) => {
  const s = symbol.toUpperCase();

  // USDC icon
  if (s === 'USDC') {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`rounded-full bg-[#2775CA] flex items-center justify-center text-white shrink-0 font-bold shadow-xs ${className}`}
      >
        <svg viewBox="0 0 32 32" className="w-full h-full p-1 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm-1.077-8.923v1.385h2.154v-1.385c3.089-.31 5.385-2.26 5.385-5.23 0-2.825-1.994-4.225-5.385-4.82v-3.79c1.554.27 2.806 1.056 3.403 2.195l1.877-1.139c-.892-1.637-2.738-2.775-5.28-3.09V3.808h-2.154v1.385c-3.089.31-5.385 2.26-5.385 5.23 0 2.825 1.994 4.225 5.385 4.82v3.79c-1.554-.27-2.806-1.056-3.403-2.195l-1.877 1.139c.892 1.637 2.738 2.775 5.28 3.09zm0-7.39c-1.748-.443-2.923-1.04-2.923-2.455 0-1.554 1.144-2.43 2.923-2.615v5.07zm2.154 2.31c1.748.443 2.923 1.04 2.923 2.455 0 1.554-1.144 2.43-2.923 2.615v-5.07z" />
        </svg>
      </div>
    );
  }

  // USDT icon
  if (s === 'USDT') {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`rounded-full bg-[#26A17B] flex items-center justify-center text-white shrink-0 font-bold shadow-xs ${className}`}
      >
        <svg viewBox="0 0 32 32" className="w-full h-full p-1 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-1.07-6.79-2.146 0-1.076 2.902-1.975 6.79-2.146v3.424c.254.017.97.053 1.99.053 1.246 0 1.813-.037 1.923-.053v-3.424c3.88.171 6.777 1.07 6.777 2.146 0 1.076-2.897 1.975-6.777 2.146zm0-4.63v-3.15h6.398v-3.43H7.68v3.43h6.398v3.15c-4.464.216-7.828 1.34-7.828 2.69 0 1.35 3.364 2.474 7.828 2.69v8.697h3.844v-8.697c4.455-.216 7.814-1.34 7.814-2.69 0-1.35-3.359-2.474-7.814-2.69z" />
        </svg>
      </div>
    );
  }

  // ETH icon
  if (s === 'ETH') {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`rounded-full bg-[#627EEA] flex items-center justify-center text-white shrink-0 shadow-xs ${className}`}
      >
        <svg viewBox="0 0 32 32" className="w-full h-full p-1 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm.134-24.167L9.5 18.736l6.634 3.924 6.634-3.924-6.634-10.903zm0 16.273l-6.634-3.924 6.634 9.352 6.634-9.352-6.634 3.924z" />
        </svg>
      </div>
    );
  }

  // Fallback generic token icon
  return (
    <div 
      style={{ width: size, height: size }} 
      className={`rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center font-bold text-gray-700 text-xs shrink-0 ${className}`}
    >
      {symbol.slice(0, 2)}
    </div>
  );
};

