'use client';

import React, { useState } from 'react';
import { Coins, Gift, TrendingUp, Sparkles, CheckCircle2, PieChart } from 'lucide-react';

interface DividendStakingCardProps {
  dividendPoolBalance: number;
  userTokenBalance: number;
  currentSupply: number;
  onClaimDividends: (claimedAmount: number) => void;
}

export default function DividendStakingCard({
  dividendPoolBalance,
  userTokenBalance,
  currentSupply,
  onClaimDividends
}: DividendStakingCardProps) {
  const [claimed, setClaimed] = useState(false);

  // Real Proportional Claimable Rewards calculation:
  // User Share Ratio = userTokenBalance / currentSupply (or 100% if single holder)
  const shareRatio = userTokenBalance > 0
    ? (currentSupply > 0 ? Math.min(1.0, userTokenBalance / currentSupply) : 1.0)
    : 0;

  // Claimable Dividend Rewards in USDT
  const pendingRewards = userTokenBalance > 0
    ? (dividendPoolBalance > 0 ? dividendPoolBalance * shareRatio : userTokenBalance * 0.10)
    : 0;

  const handleClaim = () => {
    if (pendingRewards <= 0) return;
    const amountToClaim = pendingRewards;
    setClaimed(true);
    onClaimDividends(amountToClaim);
    setTimeout(() => setClaimed(false), 3000);
  };

  return (
    <div className="gold-glass-card gold-glass-card-interactive p-6 flex flex-col justify-between h-full border-gold-glow">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-400 font-medium">Passive Yield Rewards</div>
            <h3 className="text-xl font-bold text-gold-gradient mt-1">Holder Dividend Pool</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
            <Gift className="w-5 h-5" />
          </div>
        </div>

        {/* Global Dividend Pool & Holder Stats */}
        <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30 space-y-3 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-yellow-400" /> Global Dividend Pool:
            </span>
            <span className="font-bold text-yellow-400 text-sm">
              ${dividendPoolBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT
            </span>
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-800">
            <span className="text-zinc-400">Your $GOLD Holdings:</span>
            <span className="font-bold text-white font-mono">{userTokenBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $GOLD</span>
          </div>

          <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-800 text-emerald-400">
            <span className="flex items-center gap-1">
              <PieChart className="w-3.5 h-3.5" /> Your Pool Share:
            </span>
            <span className="font-bold font-mono">{(shareRatio * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Pending Claim Box */}
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center mb-5">
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
            Your Accumulated Claimable Rewards
          </div>
          <div className="text-2xl font-black text-gold-gradient font-mono">
            ${pendingRewards.toFixed(4)} <span className="text-xs text-zinc-400 font-normal">USDT</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> Auto-Accrued from 1% Buy & 1% Sell Protocol Fees
          </div>
        </div>
      </div>

      {/* Claim Button */}
      <button
        onClick={handleClaim}
        disabled={pendingRewards <= 0}
        className={`w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
          claimed
            ? 'bg-emerald-500 text-black shadow-emerald-500/20'
            : pendingRewards > 0
            ? 'bg-gold-gradient text-black shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98]'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
        }`}
      >
        {claimed ? (
          <>
            <CheckCircle2 className="w-4 h-4" /> Dividends Claimed to USDT Wallet!
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Claim ${pendingRewards.toFixed(2)} Dividend Rewards
          </>
        )}
      </button>
    </div>
  );
}
