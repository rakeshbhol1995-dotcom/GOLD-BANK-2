'use client';

import React, { useState } from 'react';
import { X, QrCode, Copy, Check, ShieldCheck, Sparkles, Wallet, Mail, Smartphone } from 'lucide-react';

interface ReceiveGoldModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  walletAddress: string;
}

export default function ReceiveGoldModal({
  isOpen,
  onClose,
  userEmail,
  walletAddress
}: ReceiveGoldModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const displayAddress = walletAddress || 'VGOLD17A9k8x2M5N8P4Q3R2S1T';
  const displayEmail = userEmail || 'user@virtualgold.org';
  const displayTag = `@${displayEmail.split('@')[0]}.gold`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 text-center">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center justify-center gap-1.5">
            <QrCode className="w-4 h-4 text-emerald-400" /> Receive Virtual Gold ($GOLD)
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Your $GOLD Receive Address</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Scan QR Code or share your Virtual Gold L1 Wallet Address / Email to receive tokens instantly.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="w-44 h-44 bg-white p-3 rounded-2xl mx-auto border-4 border-yellow-400 shadow-2xl shadow-yellow-500/20 flex items-center justify-center relative">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(displayAddress)}`}
            alt="Receive $GOLD QR Code"
            className="w-full h-full object-contain rounded-lg"
          />
        </div>

        {/* Wallet Details & Copy Section */}
        <div className="space-y-3">
          {/* 1. L1 Wallet Address */}
          <div className="p-3 rounded-xl bg-black/80 border border-yellow-500/30 text-left space-y-1">
            <div className="text-[10px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
              <span>Sovereign L1 Wallet Address</span>
              <span className="text-yellow-400 font-mono text-[9px]">256-bit Encrypted</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-yellow-300 font-bold text-xs truncate">{displayAddress}</span>
              <button
                onClick={() => handleCopy(displayAddress)}
                className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30 transition-all shrink-0"
                title="Copy Address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 2. User Email & Tag Handles */}
          <div className="grid grid-cols-2 gap-2 text-left text-xs">
            <div className="p-3 rounded-xl bg-black/70 border border-zinc-800 space-y-0.5">
              <div className="text-[9px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                <Mail className="w-3 h-3 text-yellow-400" /> Email Identifier
              </div>
              <div className="font-bold text-zinc-200 truncate">{displayEmail}</div>
            </div>

            <div className="p-3 rounded-xl bg-black/70 border border-zinc-800 space-y-0.5">
              <div className="text-[9px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Virtual Handle Tag
              </div>
              <div className="font-bold text-yellow-300 truncate">{displayTag}</div>
            </div>
          </div>
        </div>

        {/* Copy Toast Indicator */}
        {copied && (
          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-fade-in">
            ✓ Address Copied to Clipboard!
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Virtual Gold Sovereign L1 Network • Zero Gas Fee for Receiver
        </div>

      </div>
    </div>
  );
}
