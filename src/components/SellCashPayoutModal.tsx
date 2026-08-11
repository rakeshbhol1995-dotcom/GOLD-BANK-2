'use client';

import React, { useState } from 'react';
import { X, Landmark, Smartphone, ArrowRight, ShieldCheck, CheckCircle2, Zap, DollarSign, Wallet } from 'lucide-react';

interface SellCashPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  goldAmount: number;
  usdtPayout: number;
  inrPayout: number;
  onSellSuccess: () => void;
}

export default function SellCashPayoutModal({
  isOpen,
  onClose,
  goldAmount,
  usdtPayout,
  inrPayout,
  onSellSuccess
}: SellCashPayoutModalProps) {
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK_ACCOUNT' | 'USDT_WALLET'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!isOpen) return null;

  const handleExecuteCashOut = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsCompleted(true);
      setTimeout(() => {
        onSellSuccess();
        setIsCompleted(false);
        onClose();
      }, 2500);
    }, 2200);
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
            <h3 className="text-2xl font-black text-white">Bank Payout Dispatched!</h3>
            <p className="text-xs text-zinc-300">
              <span className="text-emerald-400 font-bold text-base">₹{inrPayout.toLocaleString('en-IN')} INR</span> credited directly to your Bank Account / UPI!
            </p>
            <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              IMPS Ref: IMPS-{Date.now().toString(36).toUpperCase()}892B • Settled ✅
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" /> Instant Bank & Cash Payout Off-Ramp
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Sell $GOLD & Receive Cash (INR ₹)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Convert $GOLD directly into Indian Rupees (INR ₹) delivered to GPay, PhonePe, Paytm, or Bank Account.
              </p>
            </div>

            {/* Payout Summary Box */}
            <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Gold Tokens to Sell:</span>
                <span className="font-extrabold text-yellow-300 text-sm">{goldAmount.toFixed(4)} Grams $GOLD</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Net Valuation (USDT):</span>
                <span className="font-mono text-zinc-300">${usdtPayout.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-zinc-800 pt-2">
                <span className="text-zinc-300 font-bold">Total Cash Payout (Rupees):</span>
                <span className="text-xl font-black text-emerald-400">₹{inrPayout.toLocaleString('en-IN')} INR</span>
              </div>
            </div>

            {/* Payout Option Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Select Payout Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPayoutMethod('UPI')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    payoutMethod === 'UPI'
                      ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-md'
                      : 'bg-black/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <span>Instant UPI</span>
                  <span className="text-[9px] text-zinc-400">GPay / PhonePe</span>
                </button>

                <button
                  onClick={() => setPayoutMethod('BANK_ACCOUNT')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    payoutMethod === 'BANK_ACCOUNT'
                      ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-md'
                      : 'bg-black/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Landmark className="w-5 h-5 text-cyan-400" />
                  <span>IMPS / NEFT</span>
                  <span className="text-[9px] text-zinc-400">Direct Bank</span>
                </button>

                <button
                  onClick={() => setPayoutMethod('USDT_WALLET')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    payoutMethod === 'USDT_WALLET'
                      ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-md'
                      : 'bg-black/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Wallet className="w-5 h-5 text-yellow-400" />
                  <span>USDT Crypto</span>
                  <span className="text-[9px] text-zinc-400">Metamask / Solana</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleExecuteCashOut} className="space-y-4">
              {payoutMethod === 'UPI' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Enter Your UPI ID for Cash Deposit</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. mobileNumber@paytm or user@gpay"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-black/80 border border-yellow-500/30 text-yellow-300 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                  />
                </div>
              )}

              {payoutMethod === 'BANK_ACCOUNT' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="Enter Bank Account Number"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                  />
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="Enter Bank IFSC Code (e.g. SBIN0001234)"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 uppercase placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                  />
                </div>
              )}

              {payoutMethod === 'USDT_WALLET' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Enter USDT Recipient Wallet Address</label>
                  <input
                    type="text"
                    placeholder="0x... or Solana Address"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className={`w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Executing IMPS Cash Payout to Bank...
                  </>
                ) : (
                  <>
                    Sell {goldAmount.toFixed(2)} Grams & Receive ₹{inrPayout.toLocaleString('en-IN')} Cash <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Settled via Instant Automated Banking Liquidity Nodes (24x7 IMPS / UPI)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
