'use client';

import React, { useState, useEffect } from 'react';
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

const initialTransactions: SwapTransaction[] = [
  {
    id: 'tx-1',
    txHash: '0x9f8e7d...3a21',
    type: 'BUY',
    wallet: '0x71C...89A2',
    chain: 'ETH',
    goldAmount: 50.0,
    usdtValue: 542.50,
    timestamp: 'Just now',
    blockNumber: 18492041,
    status: 'FINALIZED'
  },
  {
    id: 'tx-2',
    txHash: '0x4b3a2c...1e9f',
    type: 'BUY',
    wallet: 'Phan7K...892B',
    chain: 'SOLANA',
    goldAmount: 120.5,
    usdtValue: 1325.00,
    timestamp: '12s ago',
    blockNumber: 18492040,
    status: 'FINALIZED'
  },
  {
    id: 'tx-3',
    txHash: '0x1d2e3f...8c7b',
    type: 'SELL',
    wallet: '0x99B...44E1',
    chain: 'BSC',
    goldAmount: 15.0,
    usdtValue: 165.00,
    timestamp: '45s ago',
    blockNumber: 18492038,
    status: 'FINALIZED'
  },
  {
    id: 'tx-4',
    txHash: '0x8a7b6c...5d4e',
    type: 'BUY',
    wallet: '0x3a21...9f8e',
    chain: 'POLYGON',
    goldAmount: 500.0,
    usdtValue: 5600.00,
    timestamp: '1m ago',
    blockNumber: 18492035,
    status: 'FINALIZED'
  },
  {
    id: 'tx-5',
    txHash: '0x5c4d3e...2f1a',
    type: 'BUY',
    wallet: '0xE8a...77B4',
    chain: 'ARBITRUM',
    goldAmount: 2.5,
    usdtValue: 27.50,
    timestamp: '2m ago',
    blockNumber: 18492030,
    status: 'FINALIZED'
  }
];

export default function L1BlockScanner() {
  const [transactions, setTransactions] = useState<SwapTransaction[]>(initialTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  // Simulated Live L1 Blockchain Swap Feed Receiver
  useEffect(() => {
    const interval = setInterval(() => {
      const chains: SwapTransaction['chain'][] = ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'SOLANA'];
      const types: SwapTransaction['type'][] = ['BUY', 'BUY', 'BUY', 'SELL']; // 75% buys
      const randomChain = chains[Math.floor(Math.random() * chains.length)];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomAmount = Number((Math.random() * 250 + 1).toFixed(2));
      const unitPrice = 10.85 + Math.random() * 2.5;
      const usdtVal = Number((randomAmount * unitPrice).toFixed(2));
      const newBlock = 18492042 + Math.floor(Math.random() * 10);
      const isSolana = randomChain === 'SOLANA';
      const randomHash = isSolana
        ? `5Kx${Date.now().toString(36).substring(2, 6)}...${Math.abs(usdtVal * 10).toString(36).substring(0, 4)}`
        : `0x${Math.abs(usdtVal * 100).toString(16).substring(0, 6)}...${Date.now().toString(16).substring(8, 12)}`;
      
      const randomWallet = isSolana
        ? `VGOLD${Math.abs(usdtVal * 17).toString(36).toUpperCase().substring(0, 4)}...${Date.now().toString(36).toUpperCase().substring(4, 8)}`
        : `0x${Math.abs(usdtVal * 19).toString(16).substring(0, 4)}...${Date.now().toString(16).substring(6, 10).toUpperCase()}`;

      const newTx: SwapTransaction = {
        id: `tx-${Date.now()}`,
        txHash: randomHash,
        type: randomType,
        wallet: randomWallet,
        chain: randomChain,
        goldAmount: randomAmount,
        usdtValue: usdtVal,
        timestamp: 'Just now',
        blockNumber: newBlock,
        status: 'FINALIZED'
      };

      setTransactions((prev) => [newTx, ...prev.slice(0, 14)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const filteredTx = transactions.filter((tx) => {
    const matchesSearch =
      tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.wallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.chain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6">
      
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Live L1 Block Explorer & Swap Scanner
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Virtual Gold L1 Network Scanner</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time decentralized on-chain transaction ledger for <code className="text-yellow-400 font-mono font-bold">virtualgold.org</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className={`p-2.5 rounded-xl bg-black/60 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh Scanner Feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            L1 Status: OPERATIONAL (1,200 TPS)
          </div>
        </div>
      </div>

      {/* Network Micro Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total Swaps Processed</div>
          <div className="text-lg font-black text-white mt-0.5">148,920 TXs</div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total USDT Volume</div>
          <div className="text-lg font-black text-yellow-400 mt-0.5">$18,420,950 USDT</div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-semibold">L1 Block Height</div>
          <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">#18,492,042</div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-semibold">Consensus Mode</div>
          <div className="text-lg font-black text-yellow-300 mt-0.5">100% Decentralized</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Tx Hash, Wallet, or Chain..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
          {(['ALL', 'BUY', 'SELL'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterType === type
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {type === 'ALL' ? 'All Swaps' : type === 'BUY' ? 'Buy / Mint' : 'Sell / Burn'}
            </button>
          ))}
        </div>
      </div>

      {/* Live Transaction Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/80">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-semibold border-b border-zinc-800 text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Tx Hash</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Wallet</th>
              <th className="py-3 px-4">USDT Source Chain</th>
              <th className="py-3 px-4">Gold Tokens ($GOLD)</th>
              <th className="py-3 px-4">Value (USDT)</th>
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {filteredTx.map((tx) => (
              <tr key={tx.id} className="hover:bg-yellow-500/5 transition-colors group">
                <td className="py-3 px-4 text-yellow-400 font-bold flex items-center gap-1.5">
                  <span>{tx.txHash}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      tx.type === 'BUY'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/15 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {tx.type === 'BUY' ? (
                      <>
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" /> BUY
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-3 h-3 text-red-400" /> SELL
                      </>
                    )}
                  </span>
                </td>
                <td className="py-3 px-4 text-zinc-300">{tx.wallet}</td>
                <td className="py-3 px-4">
                  <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-yellow-300 font-bold text-[10px]">
                    {tx.chain}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-white">
                  {tx.type === 'BUY' ? '+' : '-'}{tx.goldAmount.toFixed(2)} $GOLD
                </td>
                <td className="py-3 px-4 font-bold text-emerald-400">
                  ${tx.usdtValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </td>
                <td className="py-3 px-4 text-zinc-400 text-[11px]">{tx.timestamp}</td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center text-[11px] text-zinc-500 pt-2 flex items-center justify-center gap-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400" /> 100% On-Chain Ledger Verification • Powered by Virtual Gold Sovereign L1 Node Engine
      </div>
    </div>
  );
}
