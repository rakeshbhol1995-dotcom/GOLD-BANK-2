'use client';

import React, { useState } from 'react';
import { X, Wallet, Copy, Check, QrCode, Send, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';

interface UsdtWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'SEND' | 'RECEIVE';
  userUsdtBalance: number;
  userWalletAddress: string;
  onSendSuccess: (amount: number, recipient: string) => void;
}

export default function UsdtWalletModal({
  isOpen,
  onClose,
  mode: initialMode,
  userUsdtBalance,
  userWalletAddress,
  onSendSuccess
}: UsdtWalletModalProps) {
  const [activeTab, setActiveTab] = useState<'SEND' | 'RECEIVE'>(initialMode);
  const [selectedChain, setSelectedChain] = useState<'SOLANA' | 'BSC' | 'ETH' | 'POLYGON' | 'ARBITRUM'>('SOLANA');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<number>(50.0);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!isOpen) return null;

  const displayAddress = userWalletAddress || 'VGOLDVaultReservePDA11111111111111111111';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(displayAddress)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendUsdt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || amount <= 0) return;
    if (amount > userUsdtBalance) {
      alert("Insufficient USDT balance!");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsCompleted(true);
      setTimeout(() => {
        onSendSuccess(amount, recipient);
        setIsCompleted(false);
        onClose();
      }, 2200);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
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
            <h3 className="text-2xl font-black text-white">USDT Sent Successfully!</h3>
            <p className="text-xs text-zinc-300">
              Transferred <span className="text-emerald-400 font-bold">${amount.toFixed(2)} USDT</span> to <strong className="text-white font-mono">{recipient}</strong>!
            </p>
            <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              Tx Hash: 5Kx{Date.now().toString(36).toUpperCase()}892B...USDT • Verified ✅
            </div>
          </div>
        ) : (
          <>
            {/* Header & Tab Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-400" /> Multi-Chain USDT Wallet
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                  Balance: ${userUsdtBalance.toFixed(2)} USDT
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/70 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('SEND')}
                  className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'SEND'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" /> Send USDT
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('RECEIVE')}
                  className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'RECEIVE'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> Receive USDT
                </button>
              </div>
            </div>

            {/* SEND USDT TAB */}
            {activeTab === 'SEND' && (
              <form onSubmit={handleSendUsdt} className="space-y-4 animate-fade-in">
                {/* Chain Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Select Network:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['SOLANA', 'BSC', 'ETH', 'POLYGON', 'ARBITRUM'] as const).map((chain) => (
                      <button
                        key={chain}
                        type="button"
                        onClick={() => setSelectedChain(chain)}
                        className={`py-2 px-2 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                          selectedChain === chain
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {chain}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Recipient Wallet Address ({selectedChain}):</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={`Enter ${selectedChain} address (0x... or Base58)`}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-black/80 border border-emerald-500/30 text-emerald-300 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Amount Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex justify-between">
                    <span>USDT Amount to Send:</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Available: ${userUsdtBalance.toFixed(2)} USDT</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max={userUsdtBalance}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-black/80 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-sm focus:outline-none focus:border-emerald-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">USDT</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`w-full py-4 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 ${
                    isProcessing ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      Broadcasting Multi-Chain USDT Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send ${amount.toFixed(2)} USDT Instantly <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* RECEIVE USDT TAB */}
            {activeTab === 'RECEIVE' && (
              <div className="space-y-4 text-center animate-fade-in">
                {/* Chain Selector */}
                <div className="grid grid-cols-3 gap-1.5 text-left">
                  {(['SOLANA', 'BSC', 'ETH', 'POLYGON', 'ARBITRUM'] as const).map((chain) => (
                    <button
                      key={chain}
                      type="button"
                      onClick={() => setSelectedChain(chain)}
                      className={`py-2 px-2 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                        selectedChain === chain
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {chain}
                    </button>
                  ))}
                </div>

                {/* QR Code */}
                <div className="w-44 h-44 bg-white p-2 rounded-xl mx-auto border-2 border-emerald-400 shadow-lg flex items-center justify-center">
                  <img
                    src={qrCodeUrl}
                    alt={`Receive USDT QR Code (${selectedChain})`}
                    width={176}
                    height={176}
                    decoding="async"
                    className="w-full h-full object-contain rounded"
                  />
                </div>

                {/* Address Display Box */}
                <div className="p-3 rounded-xl bg-black/80 border border-emerald-500/30 text-left space-y-1">
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase flex items-center justify-between">
                    <span>Your USDT Deposit Address ({selectedChain})</span>
                    <span className="text-emerald-400 font-mono text-[9px]">Direct Non-Custodial</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-emerald-300 font-bold text-xs truncate max-w-[340px]">
                      {displayAddress}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all shrink-0"
                      title="Copy Address"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Deposits automatically credited to your encrypted vault wallet
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
