'use client';

import React, { useState } from 'react';
import { TrendingUp, RefreshCw, Zap, Award, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface AutoCompoundProps {
  userGoldBalance?: number;
  pendingDividendsUSDT?: number;
  currentPriceUSDT?: number;
  onAutoCompoundToggle?: (enabled: boolean) => void;
}

export const AutoCompoundYieldVault: React.FC<AutoCompoundProps> = ({
  userGoldBalance = 150.50,
  pendingDividendsUSDT = 48.75,
  currentPriceUSDT = 10.77,
  onAutoCompoundToggle,
}) => {
  const [isAutoCompoundActive, setIsAutoCompoundActive] = useState<boolean>(true);
  const [isReinvesting, setIsReinvesting] = useState<boolean>(false);
  const [reinvestSuccessMessage, setReinvestSuccessMessage] = useState<string>('');

  const baseApy = 18.5; // 18.5% Standard Annual Yield
  const autoCompoundedApy = 24.2; // 24.2% Auto-Compounded APY

  const handleToggle = () => {
    const newState = !isAutoCompoundActive;
    setIsAutoCompoundActive(newState);
    if (onAutoCompoundToggle) onAutoCompoundToggle(newState);
  };

  const handleManualCompound = () => {
    setIsReinvesting(true);
    setTimeout(() => {
      const tokensBought = pendingDividendsUSDT / currentPriceUSDT;
      setReinvestSuccessMessage(`Successfully reinvested $${pendingDividendsUSDT.toFixed(2)} USDT dividends ➔ Minted +${tokensBought.toFixed(4)} $GOLD tokens at floor price!`);
      setIsReinvesting(false);
    }, 600);
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden my-6">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400 animate-bounce" />
            <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500">
              Auto-Compounding Dividend Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            World-First 1-Click Vault: Reinvests USDT dividends into $GOLD tokens at floor price
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300">Auto-Reinvest:</span>
          <button
            onClick={handleToggle}
            className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${
              isAutoCompoundActive ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 bg-slate-950 rounded-full shadow-md transform transition-transform duration-300 ${
                isAutoCompoundActive ? 'translate-x-7 bg-white' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* APY Comparison Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-xs text-slate-400 block">Standard Dividend APY</span>
          <span className="text-2xl font-black text-slate-300 font-mono">{baseApy}%</span>
          <p className="text-[11px] text-slate-500">Simple USDT dividend claims</p>
        </div>

        <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
            +30% APY BOOST
          </div>
          <span className="text-xs text-amber-300 font-semibold block">Auto-Compounded APY</span>
          <span className="text-2xl font-black text-amber-400 font-mono">{autoCompoundedApy}%</span>
          <p className="text-[11px] text-amber-400/80">Exponential gold balance compounding</p>
        </div>
      </div>

      {/* Immediate Compound Trigger */}
      <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs">
          <span className="text-slate-400 block">Pending Dividend Reward:</span>
          <span className="text-base font-extrabold text-emerald-400 font-mono">
            ${pendingDividendsUSDT.toFixed(2)} USDT
          </span>
        </div>

        <button
          onClick={handleManualCompound}
          disabled={isReinvesting || pendingDividendsUSDT <= 0}
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReinvesting ? 'animate-spin' : ''}`} />
          {isReinvesting ? 'Compounding Dividends...' : 'Compound Now ➔ Mint $GOLD'}
        </button>
      </div>

      {reinvestSuccessMessage && (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{reinvestSuccessMessage}</span>
        </div>
      )}
    </div>
  );
};
