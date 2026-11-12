import React from 'react';

export interface StatCardItem {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  accent?: 'teal' | 'blue' | 'emerald' | 'indigo';
}

interface AffiliateStatCardsProps {
  cards: StatCardItem[];
}

export const AffiliateStatCards: React.FC<AffiliateStatCardsProps> = ({ cards }) => {
  const getIconContainerStyle = (accent: StatCardItem['accent'] = 'teal') => {
    switch (accent) {
      case 'blue':
        return 'bg-sky-500/15 border-sky-400/30 text-sky-400';
      case 'emerald':
        return 'bg-emerald-500/15 border-emerald-400/30 text-emerald-400';
      case 'indigo':
        return 'bg-indigo-500/15 border-indigo-400/30 text-indigo-400';
      case 'teal':
      default:
        return 'bg-teal-500/15 border-teal-400/30 text-teal-400';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="relative overflow-hidden rounded-2xl bg-[#0c1420]/90 border border-slate-800/90 hover:border-teal-500/40 p-5 transition-all shadow-lg shadow-black/25"
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-full border flex items-center justify-center shrink-0 ${getIconContainerStyle(
                card.accent
              )}`}
            >
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-slate-400 truncate">{card.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5 truncate">
                {card.value}
              </p>
              <p className="text-xs font-medium text-teal-400/90 mt-1 truncate">{card.subtext}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
