'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShieldCheck, Lock } from 'lucide-react';
import { calculatePriceAtSupply, MAX_SUPPLY_CAP } from './BondingCurveCalculator';

interface GoldPriceChartProps {
  currentSupply?: number;
  vaultReserve?: number;
}

export default function GoldPriceChart({
  currentSupply = 5_000_000,
  vaultReserve = 700_000
}: GoldPriceChartProps) {
  // Generate curve points for 0 to 21M supply
  const chartData = [
    { supply: '0M', price: calculatePriceAtSupply(0), floor: 0.001 },
    { supply: '2M', price: calculatePriceAtSupply(2_000_000), floor: 0.056 },
    { supply: '5M', price: calculatePriceAtSupply(5_000_000), floor: 0.140 },
    { supply: '8M', price: calculatePriceAtSupply(8_000_000), floor: 0.285 },
    { supply: '12M', price: calculatePriceAtSupply(12_000_000), floor: 0.540 },
    { supply: '16M', price: calculatePriceAtSupply(16_000_000), floor: 0.810 },
    { supply: '21M', price: calculatePriceAtSupply(MAX_SUPPLY_CAP), floor: 1200.0 }
  ];

  const currentPrice = calculatePriceAtSupply(currentSupply);
  const currentFloor = currentSupply > 0 ? vaultReserve / currentSupply : 0.001;

  return (
    <div className="gold-glass-card gold-glass-card-interactive p-6 flex flex-col justify-between h-full border-gold-glow">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium">Bonding Curve & Floor Ratchet</div>
          <div className="text-2xl font-extrabold text-gold-gradient mt-1 flex items-baseline gap-2">
            ${currentPrice.toFixed(4)} <span className="text-xs text-zinc-400 font-normal">/ $GOLD</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold mt-1">
            <span className="text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Linear Price Curve
            </span>
            <span className="text-yellow-400 flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> P_floor: ${currentFloor.toFixed(6)}
            </span>
          </div>
        </div>

        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
          <Lock className="w-5 h-5" />
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="w-full h-44 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFD700" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#FFD700" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="supply" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} domain={[0, 1200]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                borderColor: 'rgba(255, 215, 0, 0.4)',
                borderRadius: '8px',
                color: '#FFD700',
                fontSize: '12px'
              }}
              formatter={(value: any) => [
                `$${Number(value || 0).toFixed(4)} USD`,
                'Bonding Curve Price'
              ]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#FFD700"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#curveGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
        <span>Formula: P(S) = $0.001 + ($1200 * S / 21M)</span>
        <span className="text-emerald-400 font-medium flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Non-Decreasing Floor
        </span>
      </div>
    </div>
  );
}
