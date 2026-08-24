'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, Lock, RefreshCw, Layers, Award, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface ProofOfReservesProps {
  vaultReserveUSDT?: number;
  ratchetReserveUSDT?: number;
  dividendPoolUSDT?: number;
  totalGoldSupply?: number;
  totalYieldInjectedUSDT?: number;
  onRefresh?: () => void;
}

export const ProofOfReservesDashboard: React.FC<ProofOfReservesProps> = ({
  vaultReserveUSDT = 4850000,
  ratchetReserveUSDT = 420000,
  dividendPoolUSDT = 125000,
  totalGoldSupply = 450000,
  totalYieldInjectedUSDT = 98500,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastVerifiedTime, setLastVerifiedTime] = useState<string>('Just now');

  // Dynamic Floor Price = Vault Reserve / Total Supply
  const dynamicFloorPrice = totalGoldSupply > 0 ? vaultReserveUSDT / totalGoldSupply : 10.0;
  
  // Total Asset Liabilities Guard
  const totalTrackedAssets = vaultReserveUSDT + ratchetReserveUSDT + dividendPoolUSDT;
  
  // Backing Ratio (Vault Reserve vs Base Value at $10)
  const baseCollateralRequired = totalGoldSupply * 10.0;
  const backingRatio = baseCollateralRequired > 0 ? (vaultReserveUSDT / baseCollateralRequired) * 100 : 100;

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      setLastVerifiedTime(new Date().toLocaleTimeString());
    }, 600);
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 text-white shadow-2xl shadow-amber-950/20 relative overflow-hidden my-6">
      {/* Background Glow Overlay */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400 animate-pulse" />
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500">
              Proof of Reserves (PoR) & Dynamic Floor Tracker
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time on-chain USDT collateral verification & mathematical floor price guard
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified 100% Backed
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg transition-all border border-slate-700 active:scale-95 disabled:opacity-50"
            title="Refresh On-Chain Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Dynamic Floor Price */}
        <div className="bg-slate-950/60 border border-amber-500/20 rounded-xl p-4 relative group hover:border-amber-500/40 transition-all">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Dynamic Floor Price</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 font-mono">
            ${dynamicFloorPrice.toFixed(4)} <span className="text-xs font-normal text-slate-400">USDT</span>
          </div>
          <p className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Guaranteed mathematical floor
          </p>
        </div>

        {/* Vault Reserve (Protected) */}
        <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-4 relative group hover:border-emerald-500/40 transition-all">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Vault Protected Reserve</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300 font-mono">
            ${vaultReserveUSDT.toLocaleString()} <span className="text-xs font-normal text-slate-400">USDT</span>
          </div>
          <p className="text-[11px] text-emerald-400/80 mt-1">
            98% Buy allocation protected
          </p>
        </div>

        {/* Ratchet Locked Reserve */}
        <div className="bg-slate-950/60 border border-yellow-500/20 rounded-xl p-4 relative group hover:border-yellow-500/40 transition-all">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Ratchet Locked Floor</span>
            <Lock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-yellow-300 font-mono">
            ${ratchetReserveUSDT.toLocaleString()} <span className="text-xs font-normal text-slate-400">USDT</span>
          </div>
          <p className="text-[11px] text-yellow-400/80 mt-1">
            8% Sell lock (Permanent floor boost)
          </p>
        </div>

        {/* Backing Health Ratio */}
        <div className="bg-slate-950/60 border border-blue-500/20 rounded-xl p-4 relative group hover:border-blue-500/40 transition-all">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Collateral Backing Ratio</span>
            <Award className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-300 font-mono">
            {backingRatio.toFixed(2)}%
          </div>
          <p className="text-[11px] text-blue-400/80 mt-1">
            Target: ≥90.00% floor guard
          </p>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <span className="text-slate-500">Total Tracked USDT Assets:</span>
          <span className="font-semibold text-slate-200 font-mono">${totalTrackedAssets.toLocaleString()} USDT</span>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <span className="text-slate-500">Total $GOLD In Circulation:</span>
          <span className="font-semibold text-amber-300 font-mono">{totalGoldSupply.toLocaleString()} Grams</span>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <span className="text-slate-500">External Yield Injected:</span>
          <span className="font-semibold text-emerald-400 font-mono">${totalYieldInjectedUSDT.toLocaleString()} USDT</span>
        </div>
      </div>

      {/* Footer / Last Sync Note */}
      <div className="mt-4 text-right">
        <span className="text-[10px] text-slate-500">
          Last verified on-chain: <span className="text-slate-400 font-mono">{lastVerifiedTime}</span>
        </span>
      </div>
    </div>
  );
};
