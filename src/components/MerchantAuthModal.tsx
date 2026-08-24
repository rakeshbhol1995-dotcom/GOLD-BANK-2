'use client';

import React, { useState } from 'react';
import {
  X,
  Lock,
  Building,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Award
} from 'lucide-react';

interface MerchantAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (merchantId: string, merchantVpa: string) => void;
  onOpenApplyModal: () => void;
}

export default function MerchantAuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenApplyModal
}: MerchantAuthModalProps) {
  const [merchantIdInput, setMerchantIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Demo Credentials quick fill
  const handleQuickDemoFill = () => {
    setMerchantIdInput('MCH-GOLD-9842');
    setPasswordInput('merchant123');
    setErrorMsg('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!merchantIdInput.trim()) {
      setErrorMsg('Please enter your Merchant ID or VPA.');
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMsg('Please enter your Merchant Security Password.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      const merchantId = merchantIdInput.trim();
      const merchantVpa = merchantId.includes('@') ? merchantId : `${merchantId.toLowerCase()}@sbi`;

      // Save merchant login session
      try {
        localStorage.setItem('virtualgold_active_merchant_id', merchantId);
        localStorage.setItem('virtualgold_merchant_vpa', merchantVpa);
      } catch (err) {}

      onLoginSuccess(merchantId, merchantVpa);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center text-2xl font-black shadow-lg shadow-yellow-500/20">
            👑
          </div>
          <h2 className="text-2xl font-black text-white">
            Merchant Authentication Portal
          </h2>
          <p className="text-xs text-zinc-400">
            Enter your Authorized Merchant ID and Password to access your P2P Control Panel.
          </p>
        </div>

        {/* Demo Fast Login Preset Box */}
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between text-xs">
          <div className="space-y-0.5 text-left">
            <span className="text-[10px] text-yellow-400 font-bold uppercase block">Verified Testnet Merchant</span>
            <span className="text-white font-mono text-[11px]">ID: <strong>MCH-GOLD-9842</strong> | Pass: <strong>merchant123</strong></span>
          </div>
          <button
            type="button"
            onClick={handleQuickDemoFill}
            className="px-3 py-1.5 rounded-lg bg-yellow-500 text-black font-extrabold text-[10px] uppercase tracking-wider hover:scale-105 transition-all shrink-0"
          >
            Auto Fill
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-yellow-400" /> Merchant ID / VPA:
            </label>
            <input
              type="text"
              value={merchantIdInput}
              onChange={(e) => setMerchantIdInput(e.target.value)}
              placeholder="e.g. MCH-GOLD-9842 or merchant@sbi"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-mono font-bold text-xs focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-yellow-400" /> Merchant Security Password:
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter your merchant password"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-mono font-bold text-xs focus:outline-none focus:border-yellow-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              'Authenticating Credentials...'
            ) : (
              <>
                <Lock className="w-4 h-4 text-black" /> LOGIN TO MERCHANT DASHBOARD <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Link to Apply */}
        <div className="border-t border-zinc-800 pt-4 text-center text-xs text-zinc-400 space-y-1">
          <p>Don't have a Merchant ID yet?</p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenApplyModal();
            }}
            className="text-yellow-400 font-bold hover:underline inline-flex items-center gap-1"
          >
            <Award className="w-3.5 h-3.5" /> Apply for P2P Merchant License ($2,000 USDT Deposit)
          </button>
        </div>
      </div>
    </div>
  );
}
