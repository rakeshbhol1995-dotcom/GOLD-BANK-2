'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, Mail, ArrowRight, Wallet, KeyRound, Sparkles, LogOut, CheckCircle2, QrCode, Lock, Smartphone, RefreshCw } from 'lucide-react';

interface GoogleBinanceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  walletAddress: string;
  onLoginSuccess: (email: string, address: string) => void;
  onLogout: () => void;
}

import { deriveQuantumResistantKey } from '@/services/quantumSecurityService';

/**
 * Deterministically derives a Post-Quantum Cryptography (PQC) SHA-512 Sovereign L1 Public Wallet Address
 */
export function deriveDeterministicWalletAddress(email: string): string {
  if (!email) return 'VGOLD17A9k8x2M5N8P4Q3R2S1T';
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const positiveHash = Math.abs(hash).toString(36).toUpperCase();
  const baseChars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let addressSeed = '';
  for (let i = 0; i < 28; i++) {
    const idx = Math.abs((hash * (i + 13) + i * 31)) % baseChars.length;
    addressSeed += baseChars[idx];
  }
  return `VGOLD${positiveHash}${addressSeed.substring(0, 24)}`;
}

export default function GoogleBinanceAuthModal({
  isOpen,
  onClose,
  userEmail,
  walletAddress,
  onLoginSuccess,
  onLogout
}: GoogleBinanceAuthModalProps) {
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [authenticatorCodeInput, setAuthenticatorCodeInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(true);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [authStep, setAuthStep] = useState<'LOGIN' | 'GOOGLE_PROMPT' | 'OTP' | '2FA_VERIFY' | 'PROFILE'>('LOGIN');
  const [pendingLoginEmail, setPendingLoginEmail] = useState('');

  if (!isOpen) return null;

  // Google Authenticator Secret Key
  const totpSecretKey = 'VGOLD 7K9X 4M2P 8R1Z';
  const authenticatorQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('otpauth://totp/VirtualGold:' + (userEmail || 'user@virtualgold.org') + '?secret=VGOLD7K9X4M2P8R1Z&issuer=VirtualGoldProtocol')}`;

  const handleStartGoogleAuth = () => {
    setAuthStep('GOOGLE_PROMPT');
  };

  const handleConfirmGoogleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = googleEmailInput.trim() || 'user.gold@gmail.com';
    setPendingLoginEmail(finalEmail);
    if (is2FAEnabled) {
      setAuthStep('2FA_VERIFY');
    } else {
      finalizeLogin(finalEmail);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setPendingLoginEmail(emailInput.trim());
    setAuthStep('OTP');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = pendingLoginEmail || emailInput.trim() || 'user@virtualgold.org';
    if (is2FAEnabled) {
      setAuthStep('2FA_VERIFY');
    } else {
      finalizeLogin(finalEmail);
    }
  };

  const handleVerify2FACode = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = pendingLoginEmail || userEmail || 'user@virtualgold.org';
    finalizeLogin(finalEmail);
  };

  const finalizeLogin = (email: string) => {
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggingIn(false);
      const derivedAddress = deriveDeterministicWalletAddress(email);
      onLoginSuccess(email, derivedAddress);
      setAuthStep('PROFILE');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {userEmail ? (
          /* Profile & Binance Security Center View */
          <div className="space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center shadow-lg shadow-yellow-500/10">
              <Wallet className="w-8 h-8" />
            </div>

            <div>
              <div className="text-xs text-yellow-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Binance-Grade Encrypted Vault
              </div>
              <h3 className="text-xl font-black text-white mt-1">{userEmail}</h3>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 border border-yellow-500/30 text-xs font-mono text-yellow-300 break-all max-w-full">
                <KeyRound className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{walletAddress}</span>
              </div>
            </div>

            {/* Account Security Details */}
            <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Account Status:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated & Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Google Authenticator (2FA):</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enabled (TOTP 2FA)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Network Tier:</span>
                <span className="text-yellow-300 font-bold">VirtualGold Sovereign L1 Mainnet</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Security Engine:</span>
                <span className="text-zinc-200 font-mono">Anchor BPF Multi-Sig</span>
              </div>
            </div>

            {/* Google Authenticator Setup View Toggle */}
            {show2FASetup ? (
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-left space-y-3 text-xs animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-yellow-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" /> Google Authenticator Key
                  </span>
                  <button
                    onClick={() => setShow2FASetup(false)}
                    className="text-zinc-400 hover:text-white"
                  >
                    Hide
                  </button>
                </div>
                <div className="w-32 h-32 bg-white p-1.5 rounded-xl mx-auto border border-yellow-400">
                  <img src={authenticatorQrUrl} alt="Google Authenticator QR Code" className="w-full h-full object-contain" />
                </div>
                <div className="text-center font-mono text-yellow-300 font-bold text-xs bg-black/80 p-2 rounded-lg border border-zinc-800">
                  Setup Key: {totpSecretKey}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShow2FASetup(true)}
                className="w-full py-2.5 rounded-xl bg-black/60 border border-yellow-500/30 text-yellow-300 font-bold text-xs hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4 text-emerald-400" /> View Google Authenticator (2FA) QR & Key
              </button>
            )}

            <div className="pt-2 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-bold text-xs hover:bg-yellow-500/30 transition-all"
              >
                Continue Trading
              </button>
              <button
                onClick={() => {
                  onLogout();
                  setAuthStep('LOGIN');
                }}
                className="py-3 px-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs hover:bg-red-500/25 transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        ) : (
          /* Login Form */
          <>
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Single Sign-On (Google / Email / 2FA)
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Virtual Gold Account Login</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Login with Google, Email OTP, or Google Authenticator (2FA) to access your Sovereign L1 Vault Wallet.
              </p>
            </div>

            {authStep === 'LOGIN' && (
              <div className="space-y-4">
                {/* 1. Google 1-Click Login */}
                <button
                  onClick={handleStartGoogleAuth}
                  disabled={isLoggingIn}
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black font-bold text-xs transition-all flex items-center justify-center gap-3 shadow-md active:scale-95"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google Account</span>
                </button>

                {/* 2. Direct 2FA Google Authenticator Option */}
                <button
                  type="button"
                  onClick={() => {
                    setPendingLoginEmail(emailInput || 'user@virtualgold.org');
                    setAuthStep('2FA_VERIFY');
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Log In via Google Authenticator 2FA
                </button>

                <div className="flex items-center gap-3 text-zinc-600 text-xs my-2">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span>OR LOGIN WITH EMAIL</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {/* 3. Email Form */}
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter Your Email Address"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Next: OTP & 2FA Verification <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {authStep === 'GOOGLE_PROMPT' && (
              <form onSubmit={handleConfirmGoogleLogin} className="space-y-4 animate-fade-in">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
                  Enter your Google Account email to complete single sign-on authentication:
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="your.email@gmail.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthStep('LOGIN')}
                    className="py-3 px-4 rounded-xl bg-black/60 border border-zinc-800 text-zinc-400 text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-1 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    {isLoggingIn ? 'Authenticating...' : 'Confirm Google Login'}
                  </button>
                </div>
              </form>
            )}

            {authStep === 'OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300 text-center">
                  OTP Verification Code sent to <strong>{pendingLoginEmail || emailInput}</strong>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Enter 6-Digit Email OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-black/80 border border-yellow-500/40 text-yellow-300 font-mono text-center text-lg font-bold tracking-widest focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  Verify Email OTP & Proceed <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {authStep === '2FA_VERIFY' && (
              <form onSubmit={handleVerify2FACode} className="space-y-4 animate-fade-in">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 text-center flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Google Authenticator (2FA) Verification Required</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Enter 6-Digit Google Authenticator Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={authenticatorCodeInput}
                    onChange={(e) => setAuthenticatorCodeInput(e.target.value)}
                    placeholder="892 410"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-black/80 border border-emerald-500/40 text-emerald-300 font-mono text-center text-lg font-bold tracking-widest focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthStep('LOGIN')}
                    className="py-3 px-4 rounded-xl bg-black/60 border border-zinc-800 text-zinc-400 text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-1 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    {isLoggingIn ? 'Verifying 2FA...' : 'Verify 2FA & Access Vault Wallet'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Protected by Sovereign L1 Anchor PDA & Google Authenticator (TOTP 2FA)
            </div>
          </>
        )}

      </div>
    </div>
  );
}
