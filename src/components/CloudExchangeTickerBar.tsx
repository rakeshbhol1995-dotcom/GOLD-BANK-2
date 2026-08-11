'use client';

import React from 'react';
import { TrendingUp, ShieldCheck, Zap, Globe, Activity } from 'lucide-react';

interface CloudExchangeTickerBarProps {
  goldPriceUsdt: number;
  p2pInrRate: number;
}

export default function CloudExchangeTickerBar({ goldPriceUsdt, p2pInrRate }: CloudExchangeTickerBarProps) {
  const tickerItems = [
    { pair: '$GOLD / USDT', price: `$${goldPriceUsdt.toFixed(2)}`, change: '+4.85%', isUp: true },
    { pair: 'USDT / INR (P2P)', price: `₹${p2pInrRate.toFixed(2)}`, change: '+0.42%', isUp: true },
    { pair: 'SOL / USDT', price: '$184.50', change: '+3.12%', isUp: true },
    { pair: 'BTC / USDT', price: '$67,850.00', change: '+1.94%', isUp: true },
    { pair: 'ETH / USDT', price: '$3,480.20', change: '+2.10%', isUp: true },
    { pair: '24h Protocol Volume', price: '$1,420,500 USDT', change: 'Live', isUp: true },
    { pair: 'Vault Collateral Status', price: '100% Fully Backed PDA', change: 'Verified ✅', isUp: true }
  ];

  return (
    <div className="w-full bg-black/90 border-b border-yellow-500/20 py-2 overflow-hidden backdrop-blur-md z-40 text-xs font-mono">
      <div className="animate-ticker flex items-center gap-8 whitespace-nowrap">
        {/* Double the list for infinite seamless loop */}
        {[...tickerItems, ...tickerItems].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 shrink-0 px-2 border-r border-zinc-800/80">
            <span className="text-zinc-400 font-semibold">{item.pair}:</span>
            <span className="text-yellow-400 font-extrabold">{item.price}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              item.isUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400'
            }`}>
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
