'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  UserPlus,
  ArrowRight,
  Lock,
  AlertCircle,
  Coins,
  Wallet,
  Building,
  TrendingUp,
  Award,
  Sparkles,
  Zap,
  Gift,
  Check,
  Percent
} from 'lucide-react';

export interface MerchantApplication {
  id: string;
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  upiId: string;
  dailyCapacity: string;
  stakedUsdtCollateral?: number;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface MerchantApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUsdtBalance: number;
  onSubmitted: (app: MerchantApplication) => void;
  onDeductCollateral: (amountUsdt: number) => void;
  onClaimFaucet?: () => void;
}

export default function MerchantApplicationModal({
  isOpen,
  onClose,
  userUsdtBalance,
  onSubmitted,
  onDeductCollateral,
  onClaimFaucet
}: MerchantApplicationModalProps) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [dailyCapacity, setDailyCapacity] = useState('₹1,00,000');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdMerchantId, setCreatedMerchantId] = useState('');

  if (!isOpen) return null;

  const REQUIRED_COLLATERAL_USDT = 2000;
  const hasEnoughCollateral = userUsdtBalance >= REQUIRED_COLLATERAL_USDT;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnoughCollateral) {
      alert('Insufficient USDT Balance! You require at least $2,000.00 USDT Security Collateral deposit to become an Authorized Merchant.');
      return;
    }
    if (!agreeTerms) {
      alert('Please accept the Merchant Security Terms to proceed.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const generatedId = `MCH-GOLD-${Math.floor(1000 + Math.random() * 9000)}`;
      setCreatedMerchantId(generatedId);

      const newApp: MerchantApplication = {
        id: generatedId,
        fullName,
        businessName: businessName || 'Authorized P2P Merchant',
        email,
        phone,
        upiId,
        dailyCapacity,
        stakedUsdtCollateral: REQUIRED_COLLATERAL_USDT,
        timestamp: new Date().toLocaleTimeString(),
        status: 'APPROVED'
      };

      try {
        localStorage.setItem('virtualgold_active_merchant_id', generatedId);
        localStorage.setItem('virtualgold_merchant_vpa', upiId);
        const existing = JSON.parse(localStorage.getItem('virtualgold_merchant_apps') || '[]');
        localStorage.setItem('virtualgold_merchant_apps', JSON.stringify([newApp, ...existing]));
      } catch (err) {}

      onDeductCollateral(REQUIRED_COLLATERAL_USDT);
      onSubmitted(newApp);

      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 flex flex-col max-h-[92vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          /* SUCCESS TIER CERTIFICATE DISPLAY */
          <div className="text-center py-8 space-y-6 animate-fade-in my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest font-bold text-emerald-400 font-mono">
                🎉 APPLICATION APPROVED & STAKED
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Authorized P2P Merchant License Unlocked!
              </h3>
            </div>
            
            {/* VIP Merchant Pass Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 via-black to-zinc-900 border-2 border-yellow-400/60 text-left max-w-md mx-auto space-y-4 shadow-2xl shadow-yellow-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-yellow-500/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-yellow-500 text-black flex items-center justify-center font-black text-lg">
                    👑
                  </div>
                  <div>
                    <div className="text-[10px] text-yellow-400 uppercase font-bold">VIP Merchant Pass</div>
                    <div className="text-sm font-black text-white">{fullName || 'Authorized Merchant'}</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold">
                  VERIFIED TIER-1
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 space-y-0.5">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold">Merchant ID</span>
                  <div className="font-bold text-yellow-400 text-sm">{createdMerchantId}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 space-y-0.5">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold">Staked Deposit</span>
                  <div className="font-bold text-emerald-400 text-sm">$2,000.00 USDT</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 text-xs font-mono flex items-center justify-between">
                <span className="text-zinc-400">Authorized UPI VPA:</span>
                <span className="font-bold text-white">{upiId || 'merchant@sbi'}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
              Your Merchant ID is now active in the P2P Marketplace. You can now publish custom Buy & Sell P2P ads, set custom spread rates, and earn trading fees!
            </p>

            <button
              onClick={onClose}
              className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/30 hover:scale-105 transition-all"
            >
              Open P2P Merchant Dashboard Panel
            </button>
          </div>
        ) : (
          <>
            {/* Header Banner */}
            <div className="border-b border-yellow-500/20 pb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold font-mono">
                <Sparkles className="w-4 h-4" /> VIP AUTHORIZED P2P MERCHANT PORTAL
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                Apply for P2P Merchant License
              </h2>
              <p className="text-xs text-zinc-300 mt-0.5">
                Provide P2P UPI liquidity for $GOLD token buyers and earn <strong className="text-yellow-400">₹1.50 to ₹3.00 INR spread per USDT</strong> on every trade!
              </p>
            </div>

            {/* 3 Key Merchant Advantage Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3 rounded-xl bg-black/60 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-yellow-400 font-bold uppercase flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-yellow-400" /> Spread Income
                </div>
                <div className="text-xs font-bold text-white">Earn ₹1.5 - ₹3.0 / USDT</div>
                <div className="text-[10px] text-zinc-400">Custom rate setting</div>
              </div>

              <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/30 space-y-1">
                <div className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Smart Escrow
                </div>
                <div className="text-xs font-bold text-white">100% Vault Protected</div>
                <div className="text-[10px] text-zinc-400">Zero chargeback risk</div>
              </div>

              <div className="p-3 rounded-xl bg-black/60 border border-purple-500/30 space-y-1">
                <div className="text-[10px] text-purple-400 font-bold uppercase flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-purple-400" /> Priority Placement
                </div>
                <div className="text-xs font-bold text-white">Top Order Book Visibility</div>
                <div className="text-[10px] text-zinc-400">Verified badge status</div>
              </div>
            </div>

            {/* 2,000 USDT Security Collateral Stake Card */}
            <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
              hasEnoughCollateral
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}>
              <div className="font-bold uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono">
                  <Lock className="w-4 h-4" /> Security Collateral Stake Deposit:
                </span>
                <span className="font-black text-yellow-400 font-mono text-base">$2,000.00 USDT</span>
              </div>

              <div className="flex justify-between items-center text-xs border-t border-white/10 pt-2 font-mono">
                <span className="text-zinc-300">Your Current USDT Balance:</span>
                <span className="font-bold text-white text-sm">${userUsdtBalance.toFixed(2)} USDT</span>
              </div>

              {!hasEnoughCollateral ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-red-500/20">
                  <div className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Insufficient Collateral (${userUsdtBalance.toFixed(2)} / $2,000.00 USDT)</span>
                  </div>
                  {onClaimFaucet && (
                    <button
                      type="button"
                      onClick={onClaimFaucet}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500 text-black font-extrabold text-xs uppercase tracking-wider hover:scale-105 transition-all shrink-0 flex items-center gap-1"
                    >
                      <Gift className="w-3.5 h-3.5" /> Refill +1,000 Test USDT
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Security Collateral Balance Approved! 2,000 USDT will be staked in the Protocol Vault upon submission.</span>
                </div>
              )}
            </div>

            {/* Application Form */}
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                  <span>Full Name / Merchant Business Name:</span>
                  <span className="text-[10px] text-yellow-400 font-mono">* Required</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma / Apex Gold Traders"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Email Address:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@gmail.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Phone / WhatsApp Number:</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Primary Merchant UPI VPA:</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="rahulmerchant@sbi / 9876543210@paytm"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Daily P2P Liquidity Capacity:</label>
                  <select
                    value={dailyCapacity}
                    onChange={(e) => setDailyCapacity(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                  >
                    <option value="₹50,000">₹50,000 INR / Day</option>
                    <option value="₹1,00,000">₹1,00,000 INR / Day</option>
                    <option value="₹5,00,000">₹5,00,000 INR / Day</option>
                    <option value="₹10,00,000+">₹10,00,000+ INR / Day (VIP Enterprise)</option>
                  </select>
                </div>
              </div>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-2 text-xs text-zinc-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 accent-yellow-400 rounded"
                />
                <span>
                  I agree to stake <strong className="text-yellow-400">$2,000.00 USDT</strong> security collateral deposit and uphold 100% P2P order release within 15 minutes.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !hasEnoughCollateral || !agreeTerms}
                className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                  hasEnoughCollateral && agreeTerms
                    ? 'bg-gold-gradient text-black shadow-yellow-500/25 hover:scale-[1.01] active:scale-[0.99]'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                }`}
              >
                {isSubmitting ? (
                  'Staking 2,000 USDT Collateral & Generating Merchant ID...'
                ) : hasEnoughCollateral ? (
                  <>
                    <Lock className="w-4 h-4 text-black" /> STAKE $2,000 USDT & UNLOCK MERCHANT LICENSE <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  'INSUFFICIENT COLLATERAL (STAKE $2,000 USDT REQUIRED)'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
