'use client';

import React, { useState } from 'react';
import { Calculator, Coins, Calendar, Sparkles } from 'lucide-react';

interface GoldCalculatorProps {
  goldPricePerGram?: number;
}

export default function GoldCalculator({ goldPricePerGram = 7450 }: GoldCalculatorProps) {
  const [monthlyGrams, setMonthlyGrams] = useState(5);
  const [months, setMonths] = useState(12);

  const totalGrams = monthlyGrams * months;
  const totalINR = totalGrams * goldPricePerGram;
  const totalUSD = totalINR / 83.2;

  const formattedINR = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(totalINR);

  const formattedUSD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(totalUSD);

  return (
    <div className="gold-glass-card gold-glass-card-interactive p-6 flex flex-col justify-between h-full border-gold-glow">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium">SIP Accumulator</div>
            <h3 className="text-xl font-bold text-gold-gradient mt-1">Gold Wealth Calculator</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

        {/* Range Slider 1: Monthly Grams */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Coins className="w-3.5 h-3.5 text-yellow-400" /> Monthly Gold Accumulation:
            </span>
            <span className="text-yellow-400 font-bold text-sm bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
              {monthlyGrams} Grams / mo
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={monthlyGrams}
            onChange={(e) => setMonthlyGrams(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>1 Gram</span>
            <span>25 Grams</span>
            <span>50 Grams</span>
          </div>
        </div>

        {/* Range Slider 2: Duration */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-yellow-400" /> Saving Duration:
            </span>
            <span className="text-yellow-400 font-bold text-sm bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
              {months} Months ({ (months / 12).toFixed(1) } Yrs)
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>1 Mo</span>
            <span>36 Months</span>
            <span>60 Months</span>
          </div>
        </div>
      </div>

      {/* Result Display Box */}
      <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30 backdrop-blur-sm shadow-inner">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Total Virtual Gold Wealth:
          </span>
          <span className="text-yellow-400 font-semibold">{totalGrams} Grams</span>
        </div>

        <div className="text-xl sm:text-2xl font-extrabold text-gold-gradient tracking-tight mt-1">
          {formattedINR}
          <span className="text-xs text-zinc-400 font-normal ml-2">({formattedUSD})</span>
        </div>
      </div>
    </div>
  );
}
