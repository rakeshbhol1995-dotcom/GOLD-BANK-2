'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  Smartphone,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Coins,
  MessageSquare,
  Copy,
  ExternalLink,
  Search,
  Filter,
  Check,
  Star,
  UserCheck,
  Send,
  AlertCircle,
  X,
  RefreshCw,
  PlusCircle,
  Landmark,
  Lock,
  Building,
  CreditCard,
  LayoutDashboard
} from 'lucide-react';

export interface P2pMerchantListing {
  id: string;
  merchantName: string;
  verifiedBadge: boolean;
  completionRate: string;
  totalTrades: number;
  avgReleaseTime: string;
  pricePerUsdtInr: number;
  availableUsdt: number;
  minBuyInr: number;
  maxBuyInr: number;
  paymentMethods: string[];
  upiVpa: string;
  type: 'BUY' | 'SELL';
}

interface P2pMerchantMarketplaceProps {
  currentGoldPriceUsdt: number;
  userTokenBalance: number;
  userUsdtBalance: number;
  activeMerchantId?: string;
  onTradeCompleted: (type: 'BUY' | 'SELL', goldGrams: number, inrAmount: number, usdtAmount: number) => void;
  onOpenMerchantAppModal: () => void;
  onOpenMerchantDashboardModal?: () => void;
}

const INITIAL_MERCHANTS: P2pMerchantListing[] = [
  {
    id: 'MCH_001',
    merchantName: 'VirtualGold Official Escrow',
    verifiedBadge: true,
    completionRate: '100%',
    totalTrades: 3840,
    avgReleaseTime: '0.4 mins',
    pricePerUsdtInr: 94.50,
    availableUsdt: 50000,
    minBuyInr: 94.50,
    maxBuyInr: 500000,
    paymentMethods: ['Google Pay', 'PhonePe', 'Paytm', 'UPI QR'],
    upiVpa: 'virtualgold@sbi',
    type: 'BUY'
  },
  {
    id: 'MCH_002',
    merchantName: 'Odisha Gold Traders P2P',
    verifiedBadge: true,
    completionRate: '99.8%',
    totalTrades: 1240,
    avgReleaseTime: '1.2 mins',
    pricePerUsdtInr: 94.80,
    availableUsdt: 12500,
    minBuyInr: 500,
    maxBuyInr: 200000,
    paymentMethods: ['PhonePe', 'Google Pay', 'IMPS Bank'],
    upiVpa: 'odishagold@ybl',
    type: 'BUY'
  },
  {
    id: 'MCH_003',
    merchantName: 'Apex Liquidity Merchant',
    verifiedBadge: true,
    completionRate: '99.5%',
    totalTrades: 890,
    avgReleaseTime: '1.8 mins',
    pricePerUsdtInr: 95.00,
    availableUsdt: 8000,
    minBuyInr: 100,
    maxBuyInr: 100000,
    paymentMethods: ['Paytm', 'Google Pay', 'UPI QR'],
    upiVpa: 'apexliquidity@paytm',
    type: 'BUY'
  }
];

export default function P2pMerchantMarketplace({
  currentGoldPriceUsdt,
  userTokenBalance,
  userUsdtBalance,
  activeMerchantId,
  onTradeCompleted,
  onOpenMerchantAppModal,
  onOpenMerchantDashboardModal
}: P2pMerchantMarketplaceProps) {
  const [activeTab, setActiveTab] = useState<'BUY' | 'SELL'>('BUY');
  const [merchantListings, setMerchantListings] = useState<P2pMerchantListing[]>(INITIAL_MERCHANTS);
  const [selectedMerchant, setSelectedMerchant] = useState<P2pMerchantListing | null>(null);
  const [tradeStep, setTradeStep] = useState<'DETAILS' | 'PAYMENT' | 'ESCROW' | 'SUCCESS'>('DETAILS');

  // Trade Inputs
  const [goldGramsInputStr, setGoldGramsInputStr] = useState<string>('1.0');
  const goldGramsInput = parseFloat(goldGramsInputStr) || 0;
  const [utrInput, setUtrInput] = useState('');
  
  // Payout Method State for SELL tab: 'UPI' vs 'BANK'
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [sellerUpiInput, setSellerUpiInput] = useState('');
  const [sellerBankAcInput, setSellerBankAcInput] = useState('');
  const [sellerIfscInput, setSellerIfscInput] = useState('');
  const [sellerNameInput, setSellerNameInput] = useState('');

  const [timerSeconds, setTimerSeconds] = useState(900);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'USER' | 'MERCHANT'; text: string; time: string }>>([
    { sender: 'MERCHANT', text: 'Hello! I am online. Please pay via UPI or provide bank details for payout.', time: 'Just now' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const [merchantBuyRate, setMerchantBuyRate] = useState(94.20);
  const [merchantSellRate, setMerchantSellRate] = useState(95.80);

  useEffect(() => {
    try {
      const savedRates = localStorage.getItem('virtualgold_merchant_dual_rates');
      if (savedRates) {
        const { buyRate, sellRate } = JSON.parse(savedRates);
        if (buyRate) setMerchantBuyRate(buyRate);
        if (sellRate) setMerchantSellRate(sellRate);
      }
    } catch (e) {}
  }, []);

  // Escrow Timer
  useEffect(() => {
    if (selectedMerchant && tradeStep === 'PAYMENT' && timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedMerchant, tradeStep, timerSeconds]);

  const activeP2pRate = activeTab === 'BUY' ? merchantSellRate : merchantBuyRate;
  const calculatedUsdtCost = goldGramsInput * currentGoldPriceUsdt;
  const calculatedInrCost = Math.round(calculatedUsdtCost * activeP2pRate);

  const handleCopyUpi = (vpa: string) => {
    navigator.clipboard.writeText(vpa);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg = { sender: 'USER' as const, text: chatInput.trim(), time: new Date().toLocaleTimeString() };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'MERCHANT', text: 'Got it! Checking bank/UPI notification for transfer...', time: new Date().toLocaleTimeString() }
      ]);
    }, 2000);
  };

  const handleStartTrade = (merchant: P2pMerchantListing) => {
    if (activeTab === 'SELL' && userTokenBalance < goldGramsInput) {
      alert(`Insufficient $GOLD Balance! You own ${userTokenBalance.toFixed(4)} Grams, but are attempting to sell ${goldGramsInput} Grams.`);
      return;
    }
    setSelectedMerchant(merchant);
    setTradeStep('PAYMENT');
    setTimerSeconds(900);
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'BUY' && !utrInput.trim()) return;
    if (activeTab === 'SELL') {
      if (payoutMethod === 'UPI' && !sellerUpiInput.trim()) return;
      if (payoutMethod === 'BANK' && (!sellerBankAcInput.trim() || !sellerIfscInput.trim())) return;
    }

    setTradeStep('ESCROW');

    setTimeout(() => {
      setTradeStep('SUCCESS');
      onTradeCompleted(activeTab, goldGramsInput, calculatedInrCost, calculatedUsdtCost);
    }, 3000);
  };

  const isUserAuthorizedMerchant = Boolean(activeMerchantId || (typeof window !== 'undefined' && localStorage.getItem('virtualgold_active_merchant_id')));
  const currentMerchantId = activeMerchantId || (typeof window !== 'undefined' ? localStorage.getItem('virtualgold_active_merchant_id') : '');

  return (
    <div className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-yellow-500/20 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
            <ShieldCheck className="w-4 h-4" /> 100% SMART CONTRACT ESCROW PROTECTED
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5">
            P2P Merchant Marketplace ($GOLD)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Buy & Sell $GOLD directly with verified P2P Merchants using GPay, PhonePe, Paytm, or Bank UPI.
          </p>
        </div>
      </div>

      {/* DISTINCT BUY vs SELL TAB SWITCHER */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-black/80 border border-zinc-800 text-xs font-black">
        <button
          onClick={() => setActiveTab('BUY')}
          className={`py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'BUY'
              ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-400 shadow-lg shadow-yellow-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Coins className="w-4 h-4 text-yellow-400" /> 🟢 BUY $GOLD WITH INR (PAY MERCHANTS VIA UPI)
        </button>
        <button
          onClick={() => setActiveTab('SELL')}
          className={`py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'SELL'
              ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" /> 🔴 SELL $GOLD FOR CASH (RECEIVE BANK / UPI)
        </button>
      </div>

      {/* Merchant Order Book Listings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
          <span>Active Verified Merchant Listings ({merchantListings.length})</span>
          <span className="text-yellow-400 font-mono">Sorted by Fastest Release & Best Rate</span>
        </div>

        <div className="space-y-3">
          {merchantListings.map((merchant) => (
            <div
              key={merchant.id}
              className={`p-5 rounded-2xl bg-black/70 border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                activeTab === 'BUY'
                  ? 'border-zinc-800 hover:border-yellow-500/40'
                  : 'border-zinc-800 hover:border-emerald-500/40'
              }`}
            >
              {/* Merchant Details */}
              <div className="space-y-2 max-w-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-base text-white">{merchant.merchantName}</span>
                  <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-mono text-[10px] font-bold">
                    ID: {merchant.id}
                  </span>
                  {merchant.verifiedBadge && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                  <span>{merchant.totalTrades} Trades</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{merchant.completionRate} Completion</span>
                  <span>•</span>
                  <span className="text-yellow-400 font-bold">{merchant.avgReleaseTime} Avg</span>
                </div>

                {/* Supported Payment Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {merchant.paymentMethods.map((pm) => (
                    <span key={pm} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-medium">
                      {pm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price & Limits */}
              <div className="space-y-1 text-left md:text-right">
                <div className={`text-2xl font-black font-mono ${activeTab === 'BUY' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  ₹{activeP2pRate.toFixed(2)} <span className="text-xs text-zinc-500 font-normal">/ USDT</span>
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  Limit: ₹{merchant.minBuyInr.toLocaleString('en-IN')} - ₹{merchant.maxBuyInr.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-emerald-400 font-mono">
                  Available Pool: ${(merchant.availableUsdt).toLocaleString()} USDT
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleStartTrade(merchant)}
                className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all shrink-0 w-full md:w-auto ${
                  activeTab === 'BUY'
                    ? 'bg-gold-gradient text-black shadow-yellow-500/20 hover:scale-105 active:scale-95'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-emerald-500/20 hover:scale-105 active:scale-95'
                }`}
              >
                {activeTab === 'BUY' ? '🟢 Buy $GOLD via UPI' : '🔴 Sell $GOLD for Cash'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* DISTINCT BUY vs SELL TRADE MODAL */}
      {selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 flex flex-col max-h-[92vh]">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedMerchant(null)}
              className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-yellow-500/20 pb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> P2P Smart Contract Trade Escrow
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {activeTab === 'BUY' ? 'Buy $GOLD Order' : 'Sell $GOLD Cash Payout Order'} — {selectedMerchant.merchantName}
                </h3>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span>
                  {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {tradeStep === 'SUCCESS' ? (
              <div className="text-center py-10 space-y-4 animate-fade-in my-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-white">P2P Trade Completed Successfully!</h3>
                <p className="text-xs text-zinc-300 max-w-md mx-auto">
                  {activeTab === 'BUY'
                    ? `UPI Payment Verified! Minted ${goldGramsInput.toFixed(4)} Grams $GOLD directly to your vault wallet.`
                    : `Tokens burned! Merchant transferred cash payout ₹${calculatedInrCost.toLocaleString('en-IN')} INR directly to your ${payoutMethod === 'UPI' ? 'UPI VPA' : 'Bank Account'}.`}
                </p>
                <button
                  onClick={() => setSelectedMerchant(null)}
                  className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-bold text-xs"
                >
                  Done & Back to Dashboard
                </button>
              </div>
            ) : tradeStep === 'ESCROW' ? (
              <div className="text-center py-12 space-y-4 animate-fade-in my-auto">
                <RefreshCw className="w-12 h-12 text-yellow-400 animate-spin mx-auto" />
                <h3 className="text-xl font-black text-white">Merchant Verifying Payment in Escrow...</h3>
                <p className="text-xs text-zinc-400">
                  {activeTab === 'BUY'
                    ? `Checking bank notifications for UTR: ${utrInput}`
                    : `Releasing cash payout to your ${payoutMethod === 'UPI' ? `UPI VPA (${sellerUpiInput})` : `Bank A/C (${sellerBankAcInput})`}`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Left Column: Trade Calculator & Distinct BUY vs SELL Form */}
                <div className="space-y-4 overflow-y-auto pr-1">
                  
                  {/* Amount Calculator */}
                  <div className="p-4 rounded-xl bg-black/70 border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-zinc-300">
                        {activeTab === 'BUY' ? 'Enter Gold Grams to Buy:' : 'Enter Gold Grams to Sell:'}
                      </span>
                      <span className="text-yellow-400 font-mono text-[11px]">
                        Available: {activeTab === 'BUY' ? `$${userUsdtBalance.toFixed(2)} USDT` : `${userTokenBalance.toFixed(4)} $GOLD`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={goldGramsInputStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^\d*\.?\d*$/.test(val)) {
                            setGoldGramsInputStr(val);
                          }
                        }}
                        placeholder="Enter grams (e.g. 1.5)"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-mono font-bold text-base focus:outline-none focus:border-yellow-400"
                      />
                      <span className="text-xs font-bold text-zinc-400">Grams</span>
                    </div>

                    {/* Quick Gram Presets */}
                    <div className="flex items-center gap-1.5 pt-1 text-[10px] font-bold">
                      {[
                        { label: '0.1g', value: '0.1' },
                        { label: '0.5g', value: '0.5' },
                        { label: '1g', value: '1.0' },
                        { label: '5g', value: '5.0' },
                        { label: '10g', value: '10.0' },
                        { label: 'MAX', value: activeTab === 'BUY' ? (userUsdtBalance / currentGoldPriceUsdt).toFixed(4) : userTokenBalance.toFixed(4) }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setGoldGramsInputStr(preset.value)}
                          className="px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 transition-all font-mono"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">USDT Valuation:</span>
                        <span className="text-white font-bold">${calculatedUsdtCost.toFixed(2)} USDT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">{activeTab === 'BUY' ? 'Total INR Payable:' : 'Total Cash Payout:'}</span>
                        <span className="text-emerald-400 font-black text-sm">₹{calculatedInrCost.toLocaleString('en-IN')} INR</span>
                      </div>
                    </div>
                  </div>

                  {/* TAILORED BUY FORM vs TAILORED SELL FORM */}
                  {activeTab === 'BUY' ? (
                    /* BUY FORM: User pays UPI to Merchant VPA */
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/40 space-y-3">
                        <div className="text-xs font-bold text-yellow-400 flex items-center justify-between">
                          <span>Pay to Merchant UPI VPA:</span>
                          <span className="text-[10px] text-zinc-400">GPay / PhonePe / Paytm</span>
                        </div>

                        <div className="p-3 rounded-xl bg-black/90 border border-yellow-500/40 flex items-center justify-between gap-2">
                          <code className="text-sm font-mono font-bold text-yellow-300">{selectedMerchant.upiVpa}</code>
                          <button
                            type="button"
                            onClick={() => handleCopyUpi(selectedMerchant.upiVpa)}
                            className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-bold text-xs flex items-center gap-1 transition-all"
                          >
                            {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedUpi ? 'Copied!' : 'Copy UPI'}
                          </button>
                        </div>

                        <div className="text-[11px] text-zinc-400 leading-relaxed">
                          Pay <strong className="text-yellow-400">₹{calculatedInrCost.toLocaleString('en-IN')} INR</strong> via any UPI app to the VPA above, then enter the 12-digit UTR reference number below.
                        </div>
                      </div>

                      <form onSubmit={handleConfirmPayment} className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-300">Enter 12-Digit Banking UTR Number:</label>
                          <input
                            type="text"
                            value={utrInput}
                            onChange={(e) => setUtrInput(e.target.value)}
                            placeholder="e.g. 423819054123"
                            maxLength={12}
                            required
                            className="w-full px-4 py-2.5 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-mono font-bold text-xs focus:outline-none focus:border-yellow-400"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4" /> 🟢 CONFIRM UPI PAYMENT & RELEASE $GOLD <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* SELL FORM: Merchant pays Cash to Seller's UPI or Bank Account */
                    <div className="space-y-4">
                      {/* Payout Method Switcher: UPI Box vs Bank Account Box */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-300">Select Cash Payout Option:</label>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/80 border border-zinc-800 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setPayoutMethod('UPI')}
                            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              payoutMethod === 'UPI'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> UPI VPA Box
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayoutMethod('BANK')}
                            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                              payoutMethod === 'BANK'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Landmark className="w-3.5 h-3.5 text-emerald-400" /> Bank A/C Box
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handleConfirmPayment} className="space-y-3">
                        {payoutMethod === 'UPI' ? (
                          /* DEDICATED UPI VPA BOX */
                          <div className="space-y-1.5 p-4 rounded-xl bg-black/70 border border-emerald-500/40">
                            <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <Smartphone className="w-4 h-4" /> Enter Your UPI ID (VPA) for Cash Payout:
                            </label>
                            <input
                              type="text"
                              value={sellerUpiInput}
                              onChange={(e) => setSellerUpiInput(e.target.value)}
                              placeholder="e.g. rahulsharma@paytm or 9876543210@ybl"
                              required
                              className="w-full px-4 py-2.5 rounded-xl bg-black/90 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                            />
                            <p className="text-[10px] text-zinc-400 mt-1">
                              Merchant will send ₹{calculatedInrCost.toLocaleString('en-IN')} INR directly to this UPI VPA.
                            </p>
                          </div>
                        ) : (
                          /* DEDICATED BANK ACCOUNT BOX */
                          <div className="space-y-3 p-4 rounded-xl bg-black/70 border border-emerald-500/40">
                            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <Landmark className="w-4 h-4" /> Enter Your Bank Account Details:
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-zinc-300">Bank Account Number:</label>
                              <input
                                type="text"
                                value={sellerBankAcInput}
                                onChange={(e) => setSellerBankAcInput(e.target.value)}
                                placeholder="e.g. 984200112233"
                                required
                                className="w-full px-3.5 py-2 rounded-xl bg-black/90 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs focus:outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-zinc-300">IFSC Code:</label>
                                <input
                                  type="text"
                                  value={sellerIfscInput}
                                  onChange={(e) => setSellerIfscInput(e.target.value.toUpperCase())}
                                  placeholder="SBIN0001234"
                                  required
                                  className="w-full px-3.5 py-2 rounded-xl bg-black/90 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs focus:outline-none"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-zinc-300">Account Holder Name:</label>
                                <input
                                  type="text"
                                  value={sellerNameInput}
                                  onChange={(e) => setSellerNameInput(e.target.value)}
                                  placeholder="Rahul Sharma"
                                  required
                                  className="w-full px-3.5 py-2 rounded-xl bg-black/90 border border-emerald-500/40 text-emerald-300 font-bold text-xs focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                        >
                          <Landmark className="w-4 h-4 text-black" /> 🔴 CONFIRM BURN $GOLD & RELEASE CASH PAYOUT <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Right Column: Live P2P Chat Box */}
                <div className="flex flex-col border border-zinc-800 rounded-xl bg-black/60 overflow-hidden h-full">
                  <div className="p-3 bg-black/90 border-b border-zinc-800 text-xs font-bold text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-yellow-400" /> P2P Live Chat Box
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>

                  {/* Chat Messages Log */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs font-sans max-h-[250px]">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`p-3 rounded-xl max-w-[85%] ${
                            msg.sender === 'USER'
                              ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-200'
                              : 'bg-zinc-800/80 border border-zinc-700 text-zinc-200'
                          }`}
                        >
                          <p className="leading-relaxed">{msg.text}</p>
                          <span className="text-[9px] text-zinc-500 mt-1 block text-right">{msg.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 flex items-center gap-2 bg-black/80">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message to merchant..."
                      className="w-full px-3 py-2 rounded-lg bg-black/90 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-sans"
                    />
                    <button
                      type="submit"
                      className="p-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
