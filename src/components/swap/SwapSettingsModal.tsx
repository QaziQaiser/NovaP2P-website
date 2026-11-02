import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface SwapSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number; // in percentage, e.g. 0.5
  setSlippage: (val: number) => void;
  degenMode: boolean;
  setDegenMode: (val: boolean) => void;
  deadlineMinutes: number;
  setDeadlineMinutes: (val: number) => void;
}

export const SwapSettingsModal: React.FC<SwapSettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  setSlippage,
  degenMode,
  setDegenMode,
  deadlineMinutes,
  setDeadlineMinutes,
}) => {
  if (!isOpen) return null;

  const presets = [0.1, 0.5, 1.0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg text-gray-900">Swap Settings</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Slippage tolerance */}
        <div className="mt-5">
          <label className="text-xs font-semibold text-gray-700 block mb-2">
            Slippage Tolerance
          </label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setSlippage(p)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  slippage === p
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {p}%
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.01"
                max="50"
                placeholder="Custom"
                value={presets.includes(slippage) ? '' : slippage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setSlippage(val);
                }}
                className={`w-full py-2 px-2 text-center text-xs font-semibold rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                  !presets.includes(slippage) ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Transaction Deadline */}
        <div className="mt-5">
          <label className="text-xs font-semibold text-gray-700 block mb-2">
            Transaction Deadline
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="120"
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(parseInt(e.target.value) || 20)}
              className="w-24 py-2 px-3 text-sm font-semibold rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <span className="text-xs text-gray-500">minutes</span>
          </div>
        </div>

        {/* Degen Mode Toggle */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                Degen Mode
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Allows high slippage and bypasses impact limits
              </p>
            </div>
            <button
              onClick={() => setDegenMode(!degenMode)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                degenMode ? 'bg-[#ff5500]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  degenMode ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Close CTA */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
};

