'use client';

import React from 'react';
import { ShieldCheck, X, Award, ExternalLink, Lock, CheckCircle2, Flame, Sparkles } from 'lucide-react';

interface VaultCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VaultCertificateModal({
  isOpen,
  onClose
}: VaultCertificateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg p-6 sm:p-8 gold-glass-card border-2 border-yellow-500/40 shadow-2xl shadow-yellow-500/30 overflow-hidden">
        
        {/* Background Decorative Gold Stamp */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border-4 border-yellow-500/10 flex items-center justify-center rotate-12 pointer-events-none">
          <span className="text-yellow-500/10 font-bold text-3xl tracking-widest uppercase">AUDITED RUST</span>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold">Verified Mainnet Audit Certificate</div>
            <h2 className="text-xl font-bold text-white">Virtual Gold Sovereign Layer-1 Security</h2>
          </div>
        </div>

        {/* Certificate Body Card */}
        <div className="p-5 rounded-xl bg-black/70 border border-yellow-500/30 space-y-4 mb-6 relative">
          
          <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
            <span className="text-xs text-zinc-400">Audit Verification Score:</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> 10 / 10 (PERFECT SCORE)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-zinc-400 block mb-1">Token Symbol & Base Price:</span>
              <span className="font-bold text-white uppercase">$GOLD (1 Gram = 10 USDT)</span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-1">Max Supply Cap:</span>
              <span className="font-bold text-yellow-400">21,000,000 $GOLD Grams</span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-1">Price Floor Invariant:</span>
              <span className="font-bold text-emerald-400">P_floor(t+1) ≥ P_floor(t)</span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-1">Minimum Purchase:</span>
              <span className="font-bold text-yellow-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> $1 USDT (0.1 Gram)
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-400 block mb-1">System Program Owned PDAs:</span>
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-yellow-400">
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-center">vault_reserve</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-center">locked_reserve</span>
              <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-center">dividend_vault</span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs text-zinc-400 block mb-1">Anchor Program ID:</span>
            <div className="flex items-center justify-between text-xs bg-zinc-900/90 px-3 py-1.5 rounded font-mono border border-zinc-800 text-yellow-400">
              <span>VGOLD1111111111111111111111111111111111111</span>
              <a
                href="https://explorer.solana.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

        {/* Audit Guarantees */}
        <div className="space-y-1.5 mb-6 text-[11px] text-zinc-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>3 Separate System Program Owned PDAs (vault, locked, dividend).</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>100% SPL Token Burn CPI enforced on every sell order.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>8% On-Chain SOL transfer into immutable locked_reserve PDA.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>256-bit exact math (mul_div_u256) with minimum 1-lamport fee guard.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Single Source of Truth: On-chain SPL Token Account balance.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gold-gradient text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Close & Return to DApp
          </button>
        </div>

      </div>
    </div>
  );
}
