'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, X, CheckCircle2, Coins, Shield, ArrowRight, Flame } from 'lucide-react';

interface MintModalProps {
  isOpen: boolean;
  onClose: () => void;
  txType: 'buy' | 'sell';
  amount: number;
  costOrPayout: number;
  onViewCertificate?: () => void;
}

export default function MintModal({
  isOpen,
  onClose,
  txType,
  amount,
  costOrPayout,
  onViewCertificate
}: MintModalProps) {
  useEffect(() => {
    if (isOpen && txType === 'buy') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFE87C', '#DAA520', '#FFFFFF']
      });
    }
  }, [isOpen, txType]);

  if (!isOpen) return null;

  const txSignature = `5Kx${Date.now().toString(36).toUpperCase()}892B...SolanaTx`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
      <div className="relative w-full max-w-md p-6 sm:p-8 gold-glass-card border-2 border-yellow-500/50 shadow-2xl shadow-yellow-500/30 text-center">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto mb-4 animate-bounce ${
          txType === 'buy'
            ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
            : 'bg-red-500/20 border-red-500/40 text-red-400'
        }`}>
          {txType === 'buy' ? <Sparkles className="w-8 h-8" /> : <Flame className="w-8 h-8" />}
        </div>

        <h2 className="text-2xl font-black text-gold-gradient mb-1">
          {txType === 'buy' ? '$GOLD Tokens Minted!' : '$GOLD Tokens Sold & Burned!'}
        </h2>
        <p className="text-xs text-zinc-400 mb-6">
          {txType === 'buy'
            ? 'Your purchase deposit was transferred to the vault reserve.'
            : 'Tokens were 100% burned via SPL Token Burn CPI & payout released.'}
        </p>

        {/* Transaction Summary Card */}
        <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30 text-left space-y-3 mb-6 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-yellow-400" /> Transaction Signature:
            </span>
            <span className="font-mono font-bold text-yellow-400">{txSignature}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Action Type:</span>
            <span className={`font-bold uppercase ${txType === 'buy' ? 'text-yellow-400' : 'text-red-400'}`}>
              {txType === 'buy' ? 'Mint $GOLD Tokens' : 'L1 Token Burn & Payout'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Token Volume:</span>
            <span className="font-bold text-white">{amount.toLocaleString()} $GOLD</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
            <span className="text-zinc-400">{txType === 'buy' ? 'Total Paid Cost:' : 'Net Seller Payout:'}</span>
            <span className="font-bold text-emerald-400 text-sm">${costOrPayout.toFixed(4)} USDC</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => {
              onClose();
              onViewCertificate();
            }}
            className="w-full py-3 rounded-xl bg-gold-gradient text-black font-semibold text-sm shadow-lg shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" /> View Audit & Verification Proofs <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800/80 text-zinc-300 font-medium text-xs hover:bg-zinc-700 transition-colors"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
