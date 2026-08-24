'use client';

import React, { useState, useEffect } from 'react';
import { Network, Activity, CheckCircle, Globe, Shield, RefreshCw } from 'lucide-react';
import { crossChainTelemetry, CrossChainTelemetryData } from '@/services/crossChainTelemetryService';

export const CrossChainTelemetryCard: React.FC = () => {
  const [data, setData] = useState<CrossChainTelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const telemetry = await crossChainTelemetry.getTelemetryData();
    setData(telemetry);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!data) return null;

  const supplyPctOfCap = (data.totalCrossChainSupply / data.globalSupplyCap) * 100;

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 text-white my-6 shadow-xl space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-slate-100">Multi-Chain Cross-Chain Telemetry</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time supply & reserve synchronization across Polygon, BSC, and Solana Anchor L1
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} /> Refresh Telemetry
        </button>
      </div>

      {/* Global Invariant Bar */}
      <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-amber-500/20">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-400" /> Global Supply Cap Invariant Guard:
          </span>
          <span className="font-mono font-bold text-amber-300">
            {data.totalCrossChainSupply.toLocaleString()} / {data.globalSupplyCap.toLocaleString()} GOLD ({supplyPctOfCap.toFixed(2)}%)
          </span>
        </div>

        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(supplyPctOfCap, 100)}%` }}
          />
        </div>
      </div>

      {/* Per Chain Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.chains.map((chain) => (
          <div
            key={chain.chainName}
            className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-amber-400" /> {chain.chainName}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {chain.status}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono text-slate-300 pt-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Circulating Supply:</span>
                <span className="text-amber-300 font-bold">{chain.totalSupply.toLocaleString()} GOLD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vault Reserve:</span>
                <span className="text-emerald-400">${chain.vaultReserveUSDT.toLocaleString()} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ratchet Reserve:</span>
                <span className="text-yellow-400">${chain.ratchetReserveUSDT.toLocaleString()} USDT</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
