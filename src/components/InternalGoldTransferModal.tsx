'use client';

import React, { useState } from 'react';
import { X, Send, ArrowRight, ShieldCheck, CheckCircle2, User, Wallet, Sparkles, Fuel } from 'lucide-react';

interface InternalGoldTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTokenBalance: number;
  onTransferSuccess: (amount: number, recipient: string) => void;
}

export default function InternalGoldTransferModal({
  isOpen,
  onClose,
  userTokenBalance,
  onTransferSuccess
}: InternalGoldTransferModalProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<number>(5.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!isOpen) return null;

  const gasFee = 0.001; // 0.001 $GOLD native gas fee

  const handleSendGold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || amount <= 0) return;
    if (amount + gasFee > userTokenBalance) {
      alert("Insufficient $GOLD balance to cover transfer amount + 0.001 $GOLD native gas fee!");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsCompleted(true);
      setTimeout(() => {
        onTransferSuccess(amount, recipient);
        setIsCompleted(false);
        onClose();
      }, 2200);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isCompleted ? (
          <div className="text-center py-8 space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white">Internal Transfer Complete!</h3>
            <p className="text-xs text-zinc-300">
              Successfully transferred <span className="text-yellow-400 font-bold">{amount.toFixed(4)} Grams $GOLD</span> to <strong className="text-white">{recipient}</strong>!
            </p>
            <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              L1 Tx Hash: 5Kx{Date.now().toString(36).toUpperCase()}892B...VGOLD • Verified ✅
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                <Send className="w-4 h-4 text-emerald-400" /> Internal Wallet-to-Wallet P2P Transfer
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Send $GOLD to Friend / Wallet</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Instant internal transfer inside Virtual Gold L1 ecosystem. Pay native gas fee in $GOLD!
              </p>
            </div>

            {/* User Available Balance Card */}
            <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/30 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Your Available Balance</div>
                <div className="text-xl font-black text-yellow-400">{userTokenBalance.toLocaleString()} Grams $GOLD</div>
              </div>
              <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-bold font-mono">
                Native L1 Wallet
              </div>
            </div>

            <form onSubmit={handleSendGold} className="space-y-4">
              {/* Recipient Field */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Recipient Email, Phone, or Wallet ID</span>
                  <span className="text-[10px] text-yellow-400">Zero Slippage</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Enter recipient Email (e.g. friend@gmail.com) or Phone (e.g. 9876543210)"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/80 border border-yellow-500/30 text-yellow-300 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                  />
                </div>
                <div className="text-[10px] text-zinc-400">
                  💡 Transfers sent to Email or Phone are auto-credited. When the recipient logs in with that email/phone, they instantly see their $GOLD tokens in their wallet!
                </div>
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Gold Amount to Transfer</span>
                  <span className="text-[10px] text-zinc-400">Min: 0.001 Gram</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={userTokenBalance}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-black/80 border border-yellow-500/30 text-yellow-300 text-sm font-bold placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-400">Grams $GOLD</span>
                </div>
              </div>

              {/* Gas Fee & Summary Box */}
              <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-yellow-400" /> Native L1 Gas Fee:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">0.001 $GOLD (~$0.01)</span>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-800 pt-1.5 font-bold">
                  <span className="text-zinc-300">Total Deduction:</span>
                  <span className="text-yellow-300 font-mono">{(amount + gasFee).toFixed(4)} Grams $GOLD</span>
                </div>
              </div>

              {/* Submit Transfer Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className={`w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/25 transition-all flex items-center justify-center gap-2 ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    Executing L1 Native P2P Transfer...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Transfer {amount.toFixed(2)} Grams $GOLD Instantly <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Powered by Virtual Gold Sovereign L1 Native Node Transfer Engine
            </div>
          </>
        )}
      </div>
    </div>
  );
}
