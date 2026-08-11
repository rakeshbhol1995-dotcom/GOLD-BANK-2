'use client';

import React from 'react';
import { ShieldCheck, TrendingUp, Lock, Award, Sparkles, CheckCircle2, Zap, Landmark, ArrowUpRight, Users, Clock, Flame, DollarSign } from 'lucide-react';

export default function VirtualGoldTrustSection() {
  return (
    <section className="w-full space-y-8 py-8">
      {/* Anti-Scam & Mathematical Integrity Banner */}
      <div className="gold-glass-card p-6 sm:p-8 border-gold-glow relative overflow-hidden text-left space-y-6">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-yellow-500/20 pb-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
              <ShieldCheck className="w-4 h-4" /> MATHEMATICALLY VERIFIED • 0% RUG-PULL RISK
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Why Virtual Gold Protocol is 100% Genuine & Rug-Proof
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Unlike speculative meme tokens with pre-mined insider allocations, Virtual Gold ($GOLD) is governed strictly by an immutable, automated Solana L1 Anchor Smart Contract. Every single token is backed by real collateral locked directly in the non-custodial Vault Reserve PDA.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/80 border border-yellow-500/40 text-center shrink-0 w-full md:w-auto">
            <div className="text-2xl font-black text-yellow-400 font-mono">100% ON-CHAIN</div>
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Non-Custodial Reserve PDA</div>
          </div>
        </div>

        {/* 3 Core Trust Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="p-5 rounded-xl bg-black/60 border border-zinc-800 space-y-3 hover:border-yellow-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Monotonic Floor Price Ratchet</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The guaranteed minimum floor price <code className="text-yellow-400 font-mono">P_floor = V(t) / S(t)</code> is programmed to only increase and <strong>NEVER decrease</strong>. Every buy, sell, and transfer irreversibly locks collateral into the vault floor.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-5 rounded-xl bg-black/60 border border-zinc-800 space-y-3 hover:border-yellow-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Holding Wealth Multiplier</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Holding $GOLD tokens generates massive passive income over time. 1% of all global protocol buy and sell transactions is automatically distributed directly to token holders in USDT dividends.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-5 rounded-xl bg-black/60 border border-zinc-800 space-y-3 hover:border-yellow-500/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Zero Admin Wallet Keys</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Vault funds cannot be withdrawn, moved, or altered by any individual or founder. Only on-chain user burn instructions can release collateral back to users deterministically.
            </p>
          </div>
        </div>
      </div>

      {/* NEW: Comprehensive Investor Breakdown - Early Buyers vs Holders vs Late Buyers */}
      <div className="gold-glass-card p-6 sm:p-8 border-gold-glow text-left space-y-6">
        <div className="border-b border-yellow-500/20 pb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono">
            <Users className="w-4 h-4" /> COMPLETE ECONOMIC PROOF FOR ALL PARTICIPANTS
          </div>
          <h2 className="text-2xl font-black text-white mt-1.5">
            How Every Single Buyer & Holder Wins (Early, Long-Term & Late Entrants)
          </h2>
          <p className="text-xs text-zinc-300 mt-1">
            Why Virtual Gold Protocol provides 100% mathematical protection and profit for Early Buyers, Token Holders, AND Late Buyers alike.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Early Buyers */}
          <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-black font-mono">
                1. EARLY BUYERS
              </span>
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-base font-black text-white">Genesis Base Price Advantage</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Early buyers purchase $GOLD at base price ($10.00 USDT / Gram). As new demand enters, the bonding curve multiplier exponentially boosts token price while expanding the locked vault reserve.
            </p>
            <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-300 font-mono">
              ★ Benefit: Maximum bonding curve capital growth & low cost entry.
            </div>
          </div>

          {/* 2. Long-Term Holders */}
          <div className="p-5 rounded-2xl bg-black/70 border border-emerald-500/30 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black font-mono">
                2. LONG-TERM HOLDERS
              </span>
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-base font-black text-white">Passive Dividend Compounding</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Holders earn perpetual 1% USDT staking dividends on every transaction across the protocol. Furthermore, every sell order permanently burns tokens while ratcheting UP the floor price <code className="text-emerald-400 font-mono">P_floor</code>!
            </p>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-mono">
              ★ Benefit: Lifetime passive USDT payouts & rising floor guarantee.
            </div>
          </div>

          {/* 3. LATE BUYERS (FULLY EXPLAINED & PROTECTED) */}
          <div className="p-5 rounded-2xl bg-black/70 border border-cyan-500/40 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-black font-mono">
                3. LATE BUYERS (LATE ENTRANTS)
              </span>
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base font-black text-white">Peak Floor Security & Zero-Loss Protection</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              <strong>Late buyers buy into a token with the HIGHEST guaranteed floor price in history!</strong> Because <code className="text-cyan-400 font-mono">P_floor = V(t) / S(t)</code> never drops, late buyers are protected by peak vault liquidity. Even during sell-offs, their token can <strong>NEVER crash to zero</strong>, as the smart contract guarantees instant cash redemption at the floor price!
            </p>
            <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 font-mono">
              ★ Benefit: Guaranteed high floor protection, zero rug risk, & high trading volume dividends.
            </div>
          </div>
        </div>
      </div>

      {/* Long-Term Holding Miracle Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-yellow-950/40 via-black to-amber-950/40 border border-yellow-500/30 text-left space-y-4">
        <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs uppercase tracking-widest">
          <Zap className="w-4 h-4 text-yellow-400" /> Long-Term Holding compounding Miracle
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-gold-gradient uppercase">
          Why Holding $GOLD Creates Exponential Generational Wealth
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl">
          Physical fine gold has preserved human purchasing power for 5,000 years. Virtual Gold ($GOLD) combines gold's physical scarcity with an algorithmic bonding curve that accelerates token price as adoption grows. By holding $GOLD, you benefit from dual appreciation: rising physical gold value + rising bonding curve floor price!
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total Supply Cap</div>
            <div className="text-sm font-black text-yellow-400 font-mono">21,000,000 Grams</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Genesis Price</div>
            <div className="text-sm font-black text-emerald-400 font-mono">$10.00 USDT / Gram</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Dividend Payouts</div>
            <div className="text-sm font-black text-cyan-400 font-mono">Real-Time USDT</div>
          </div>
          <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/20">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Redemption</div>
            <div className="text-sm font-black text-yellow-300 font-mono">24K Fine Gold Bars</div>
          </div>
        </div>
      </div>
    </section>
  );
}
