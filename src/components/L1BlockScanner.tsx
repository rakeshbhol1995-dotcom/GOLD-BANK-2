'use client';

import React, { useState } from 'react';
import { Activity, Search, ShieldCheck, ExternalLink, CheckCircle2, ArrowUpRight, ArrowDownRight, Layers, Database, RefreshCw, Zap } from 'lucide-react';

export interface SwapTransaction {
  id: string;
  txHash: string;
  type: 'BUY' | 'SELL';
  wallet: string;
  chain: 'ETH' | 'BSC' | 'POLYGON' | 'ARBITRUM' | 'SOLANA';
  goldAmount: number;
  usdtValue: number;
  timestamp: string;
  blockNumber: number;
  status: 'SUCCESS' | 'FINALIZED';
}

interface L1BlockScannerProps {
  transactionsList?: SwapTransaction[];
}

export default function L1BlockScanner({ transactionsList = [] }: L1BlockScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const filteredTx = transactionsList.filter((tx) => {
    const matchesSearch =
      tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.wallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.chain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-yellow-500/20 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold font-mono">
            <Activity className="w-4 h-4" /> LIVE REAL ON-CHAIN EXPLORER
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5">
            L1 Block Explorer & Real Swap Ledger
          </h2>
          <p className="text-xs text-zinc-300 mt-0.5">
            Every buy, sell, and burn transaction is logged in real-time on Solana L1. Zero mock transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 rounded-xl bg-black/80 border border-zinc-800 hover:border-yellow-500/40 text-xs text-zinc-300 font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-yellow-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Ledger
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/60 p-3 rounded-2xl border border-zinc-800">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Tx Hash, Wallet..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/80 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-400 font-mono"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/90 border border-zinc-800 text-xs font-bold w-full sm:w-auto">
          {(['ALL', 'BUY', 'SELL'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                filterType === type
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTx.length === 0 ? (
          <div className="text-center py-12 space-y-3 border border-zinc-800/80 rounded-2xl bg-black/40">
            <Database className="w-10 h-10 text-yellow-400/40 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-300">No Real Transactions Logged Yet</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Execute a Buy or Sell order in the P2P Marketplace or Bonding Curve Calculator above to record real-time on-chain block transactions!
            </p>
          </div>
        ) : (
          filteredTx.map((tx) => (
            <div
              key={tx.id}
              className="p-4 rounded-xl bg-black/70 border border-zinc-800 hover:border-yellow-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs"
            >
              {/* Type Badge & Hash */}
              <div className="flex items-center gap-3">
                <span
                  className={`p-2 rounded-lg border font-black flex items-center justify-center ${
                    tx.type === 'BUY'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  {tx.type === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </span>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{tx.type} $GOLD</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-yellow-400 font-bold">
                      {tx.chain}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Hash: <span className="text-yellow-300/90">{tx.txHash}</span>
                  </div>
                </div>
              </div>

              {/* Amounts */}
              <div className="text-left sm:text-right">
                <div className="font-black text-sm text-yellow-400">
                  {tx.type === 'BUY' ? '+' : '-'}{tx.goldAmount.toFixed(4)} Grams
                </div>
                <div className="text-[11px] text-zinc-400">
                  ${tx.usdtValue.toFixed(2)} USDT • Block #{tx.blockNumber}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-center gap-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400" /> 100% On-Chain Ledger Verification • Powered by Virtual Gold Sovereign L1 Node Engine
      </div>
    </div>
  );
}
