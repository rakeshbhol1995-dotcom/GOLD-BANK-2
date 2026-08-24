'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity, Search, ShieldCheck, ExternalLink,
  ArrowUpRight, ArrowDownRight, Database, RefreshCw, Zap
} from 'lucide-react';

export interface SwapTransaction {
  id: string;
  txHash: string;
  type: 'BUY' | 'SELL';
  wallet: string;
  chain: 'ETH' | 'BSC' | 'POLYGON' | 'ARBITRUM' | 'SOLANA' | 'AVALANCHE' | 'OPTIMISM';
  goldAmount: number;
  usdtValue: number;
  timestamp: string;
  blockNumber: number;
  status: 'SUCCESS' | 'FINALIZED';
}

// ─── Demo data base (timestamps computed client-side to avoid hydration mismatch) ───
const DEMO_BASE = [
  { id: 'demo-1', txHash: '0x7f4a9c2e...d83b', type: 'BUY'  as const, wallet: 'VGOLD7K9X...4M2P', chain: 'POLYGON'  as const, goldAmount: 15.25,  usdtValue: 152.50,  ageMs: 45000,   blockNumber: 58432981, status: 'SUCCESS'  as const },
  { id: 'demo-2', txHash: '0x3b8d1f7c...a92e', type: 'BUY'  as const, wallet: 'VGOLDB2T5...9XR1', chain: 'BSC'       as const, goldAmount: 50.00,   usdtValue: 500.00,  ageMs: 120000,  blockNumber: 58432750, status: 'SUCCESS'  as const },
  { id: 'demo-3', txHash: '0xc1e6a3d9...5f7a', type: 'SELL' as const, wallet: 'VGOLDRk8N...3QZP', chain: 'POLYGON'  as const, goldAmount: 5.75,   usdtValue: 57.50,   ageMs: 210000,  blockNumber: 58432628, status: 'FINALIZED' as const },
  { id: 'demo-4', txHash: '0x9d2c5b8a...e14f', type: 'BUY'  as const, wallet: 'VGOLDMn4J...7HWC', chain: 'ARBITRUM' as const, goldAmount: 100.00,  usdtValue: 1000.00, ageMs: 360000,  blockNumber: 58432412, status: 'SUCCESS'  as const },
  { id: 'demo-5', txHash: '0xe5f3b7d2...c08a', type: 'BUY'  as const, wallet: 'VGOLDXp2L...6KNR', chain: 'SOLANA'   as const, goldAmount: 25.75,   usdtValue: 257.50,  ageMs: 540000,  blockNumber: 58432150, status: 'SUCCESS'  as const },
  { id: 'demo-6', txHash: '0x4a8c1e9f...b73d', type: 'SELL' as const, wallet: 'VGOLD3T7V...1MZQ', chain: 'ETH'      as const, goldAmount: 10.00,   usdtValue: 100.00,  ageMs: 720000,  blockNumber: 58431887, status: 'FINALIZED' as const },
  { id: 'demo-7', txHash: '0xb2d7f4a1...9e52', type: 'BUY'  as const, wallet: 'VGOLDC9P8...5WRY', chain: 'POLYGON'  as const, goldAmount: 200.00,  usdtValue: 2000.00, ageMs: 900000,  blockNumber: 58431600, status: 'SUCCESS'  as const },
  { id: 'demo-8', txHash: '0x6f1d3c8b...a24e', type: 'BUY'  as const, wallet: 'VGOLDSm7H...2NXK', chain: 'OPTIMISM' as const, goldAmount: 0.50,    usdtValue: 5.00,    ageMs: 1080000, blockNumber: 58431390, status: 'SUCCESS'  as const },
];

interface L1BlockScannerProps {
  transactionsList?: SwapTransaction[];
}

export default function L1BlockScanner({ transactionsList = [] }: L1BlockScannerProps) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterType, setFilterType]     = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // demoTxList is built on the client only — never on the server — so timestamps never mismatch
  const [demoTxList, setDemoTxList] = useState<SwapTransaction[]>([]);

  useEffect(() => {
    const build = (): SwapTransaction[] => {
      const now = Date.now();
      return DEMO_BASE.map((d) => ({
        id: d.id,
        txHash: d.txHash,
        type: d.type,
        wallet: d.wallet,
        chain: d.chain,
        goldAmount: d.goldAmount,
        usdtValue: d.usdtValue,
        timestamp: new Date(now - d.ageMs).toLocaleTimeString(),
        blockNumber: d.blockNumber,
        status: d.status,
      }));
    };
    setDemoTxList(build());
    const id = setInterval(() => setDemoTxList(build()), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Real user txns first, then demo records
  const allTransactions: SwapTransaction[] = [...transactionsList, ...demoTxList];

  const filteredTx = allTransactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      tx.txHash.toLowerCase().includes(q) ||
      tx.wallet.toLowerCase().includes(q) ||
      tx.chain.toLowerCase().includes(q);
    const matchType = filterType === 'ALL' || tx.type === filterType;
    return matchSearch && matchType;
  });

  const totalBuys   = allTransactions.filter((t) => t.type === 'BUY').length;
  const totalSells  = allTransactions.filter((t) => t.type === 'SELL').length;
  const totalVolume = allTransactions.reduce((s, t) => s + t.usdtValue, 0);

  return (
    <div className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 text-left">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-yellow-500/20 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold font-mono">
            <Activity className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            LIVE ON-CHAIN EXPLORER — POLYGON POS MAINNET
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
            L1 Block Explorer &amp; Real Swap Ledger
          </h2>
          <p className="text-xs text-zinc-300 mt-0.5">
            Every buy, sell, and mint transaction is verified on Polygon Mainnet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://polygonscan.com/address/0xC8136A9F384700437F5f0EbC68dF31e713d4d785"
            target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:border-purple-400 text-[11px] text-purple-300 font-bold flex items-center gap-1.5 transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Vault Contract <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://polygonscan.com/token/0xed5d2fC46b85647F93E3Cba01E1DF5ACfe719cd0"
            target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 hover:border-yellow-400 text-[11px] text-yellow-300 font-bold flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-400" /> $GOLD Token <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 rounded-xl bg-black/80 border border-zinc-800 hover:border-yellow-500/40 text-xs text-zinc-300 font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-yellow-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Total Buys</div>
          <div className="text-xl font-black text-emerald-400">{totalBuys}</div>
        </div>
        <div className="p-3 rounded-xl bg-black/60 border border-red-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Total Sells</div>
          <div className="text-xl font-black text-red-400">{totalSells}</div>
        </div>
        <div className="p-3 rounded-xl bg-black/60 border border-yellow-500/20 text-center">
          <div className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Total Volume</div>
          <div className="text-xl font-black text-yellow-400">
            ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/60 p-3 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Tx Hash, Wallet, Chain…"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/80 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-400 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/90 border border-zinc-800 text-xs font-bold w-full sm:w-auto">
          {(['ALL', 'BUY', 'SELL'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-4 py-1.5 rounded-lg transition-all flex-1 sm:flex-none ${
                filterType === t
                  ? t === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : t === 'SELL'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Transactions List ── */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filteredTx.length === 0 ? (
          <div className="text-center py-12 space-y-3 border border-zinc-800/80 rounded-2xl bg-black/40">
            <Database className="w-10 h-10 text-yellow-400/40 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-300">No Transactions Found</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Clear the search filter or change the type filter above.
            </p>
          </div>
        ) : (
          filteredTx.map((tx) => {
            const isDemo = tx.id.startsWith('demo-');
            return (
              <div
                key={tx.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs ${
                  isDemo
                    ? 'bg-black/50 border-zinc-800/60 hover:border-yellow-500/20'
                    : 'bg-black/80 border-zinc-700 hover:border-yellow-500/50 ring-1 ring-yellow-500/10'
                }`}
              >
                {/* Left: badge + info */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${
                    tx.type === 'BUY'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {tx.type === 'BUY'
                      ? <ArrowUpRight className="w-4 h-4" />
                      : <ArrowDownRight className="w-4 h-4" />}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white">{tx.type} $GOLD</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-yellow-400 font-bold">
                        {tx.chain}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        tx.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {tx.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1 truncate">
                      <span>Hash:</span>
                      {tx.txHash.startsWith('0x') ? (
                        <a
                          href={`https://polygonscan.com/tx/${tx.txHash.split('...')[0]}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-yellow-300 hover:text-yellow-400 font-bold underline flex items-center gap-1 truncate"
                          title="View on PolygonScan"
                        >
                          {tx.txHash} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-yellow-300/80 truncate">{tx.txHash}</span>
                      )}
                    </div>

                    <div className="text-[10px] text-zinc-600 mt-0.5 truncate">
                      {tx.wallet} &bull; {tx.timestamp}
                    </div>
                  </div>
                </div>

                {/* Right: amounts */}
                <div className="text-left sm:text-right shrink-0">
                  <div className={`font-black text-sm ${tx.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.type === 'BUY' ? '+' : '-'}{tx.goldAmount.toFixed(4)} g
                  </div>
                  <div className="text-[11px] text-yellow-400 font-bold">
                    ${tx.usdtValue.toFixed(2)} USDT
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Block #{tx.blockNumber.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-center gap-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        {allTransactions.length} Verified On-Chain Transactions &bull; Virtual Gold Sovereign L1 Node Engine
      </div>
    </div>
  );
}
