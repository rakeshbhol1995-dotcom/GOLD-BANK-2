'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Building,
  PlusCircle,
  TrendingUp,
  Coins,
  Clock,
  Check,
  AlertCircle,
  RefreshCw,
  Landmark,
  Smartphone,
  Eye,
  Percent,
  Settings,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  MessageSquare,
  BarChart3,
  Award,
  Zap,
  ArrowUpRight,
  UserCheck,
  TrendingDown
} from 'lucide-react';

export interface MerchantP2pOrder {
  id: string;
  type: 'BUY' | 'SELL';
  customerWallet: string;
  goldAmount: number;
  usdtCost: number;
  inrAmount: number;
  paymentMethod: 'UPI' | 'BANK';
  customerUtrOrAccount: string;
  timestamp: string;
  status: 'PENDING_MERCHANT_RELEASE' | 'COMPLETED';
}

export interface MerchantP2pAd {
  id: string;
  type: 'BUY' | 'SELL';
  pricePerUsdtInr: number;
  minLimitInr: number;
  maxLimitInr: number;
  paymentMethods: string[];
  vpa: string;
  isActive: boolean;
}

interface MerchantDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantId: string;
  stakedCollateral: number;
  merchantVpa: string;
  userUsdtBalance: number;
  userGoldBalance: number;
  onUpdateMerchantRates?: (buyRate: number, sellRate: number) => void;
}

const INITIAL_MERCHANT_ORDERS: MerchantP2pOrder[] = [
  {
    id: 'ORD_9812',
    type: 'BUY',
    customerWallet: '0x71C4...89B2',
    goldAmount: 2.5,
    usdtCost: 25.00,
    inrAmount: 2395,
    paymentMethod: 'UPI',
    customerUtrOrAccount: '423819054123 (UPI UTR)',
    timestamp: '2 mins ago',
    status: 'PENDING_MERCHANT_RELEASE'
  },
  {
    id: 'ORD_9813',
    type: 'SELL',
    customerWallet: '0x89A1...391F',
    goldAmount: 5.0,
    usdtCost: 50.00,
    inrAmount: 4710,
    paymentMethod: 'UPI',
    customerUtrOrAccount: 'rahulsharma@paytm (UPI VPA)',
    timestamp: '5 mins ago',
    status: 'PENDING_MERCHANT_RELEASE'
  },
  {
    id: 'ORD_9811',
    type: 'SELL',
    customerWallet: 'SolanaPDA...911',
    goldAmount: 1.0,
    usdtCost: 10.00,
    inrAmount: 942,
    paymentMethod: 'BANK',
    customerUtrOrAccount: 'A/C: 9842001122 IFSC: SBIN0001234',
    timestamp: '15 mins ago',
    status: 'COMPLETED'
  }
];

export default function MerchantDashboardModal({
  isOpen,
  onClose,
  merchantId,
  stakedCollateral,
  merchantVpa,
  userUsdtBalance,
  userGoldBalance,
  onUpdateMerchantRates
}: MerchantDashboardModalProps) {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PRICING' | 'ANALYTICS' | 'SETTINGS'>('ORDERS');
  const [ordersFilter, setOrdersFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [orders, setOrders] = useState<MerchantP2pOrder[]>(INITIAL_MERCHANT_ORDERS);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);

  // DUAL PRICING STATE: Buy Rate (Customer Selling) vs Sell Rate (Customer Buying)
  const [merchantBuyRate, setMerchantBuyRate] = useState<number>(94.20);
  const [merchantSellRate, setMerchantSellRate] = useState<number>(95.80);
  const [rateSaveSuccess, setRateSaveSuccess] = useState(false);

  // Restore saved rates from localStorage
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

  // Settings State
  const [savedVpa, setSavedVpa] = useState(merchantVpa || 'merchant@sbi');
  const [savedBankAc, setSavedBankAc] = useState('984200112233');
  const [savedIfsc, setSavedIfsc] = useState('SBIN0001234');
  const [autoReplyMsg, setAutoReplyMsg] = useState('Hello! I am online. Please send payment via UPI/Bank and submit details for instant release.');
  const [savedSuccessAlert, setSavedSuccessAlert] = useState(false);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    if (ordersFilter === 'BUY') return o.type === 'BUY';
    if (ordersFilter === 'SELL') return o.type === 'SELL';
    return true;
  });

  const handleMerchantReleaseEscrow = (orderId: string) => {
    setReleasingOrderId(orderId);
    setTimeout(() => {
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'COMPLETED' } : ord))
      );
      setReleasingOrderId(null);
      alert(`✅ Escrow Released! Order #${orderId} has been successfully verified and finalized in Smart Contract.`);
    }, 1500);
  };

  const handleSaveDualRates = (e: React.FormEvent) => {
    e.preventDefault();
    if (merchantSellRate <= merchantBuyRate) {
      alert('Merchant Sell Rate must be higher than Merchant Buy Rate to maintain a positive spread profit!');
      return;
    }

    try {
      localStorage.setItem('virtualgold_merchant_dual_rates', JSON.stringify({
        buyRate: merchantBuyRate,
        sellRate: merchantSellRate
      }));
    } catch (e) {}

    if (onUpdateMerchantRates) {
      onUpdateMerchantRates(merchantBuyRate, merchantSellRate);
    }

    setRateSaveSuccess(true);
    setTimeout(() => setRateSaveSuccess(false), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('virtualgold_merchant_vpa', savedVpa);
    } catch (e) {}
    setSavedSuccessAlert(true);
    setTimeout(() => setSavedSuccessAlert(false), 3000);
  };

  const spreadMargin = (merchantSellRate - merchantBuyRate).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 flex flex-col max-h-[94vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Suite */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-yellow-500/20 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold font-mono">
              <Sparkles className="w-4 h-4" /> VIRTUAL GOLD VIP MERCHANT PRO SUITE
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              Merchant Panel <span className="text-yellow-400 font-mono text-xl">({merchantId || 'MCH-GOLD-9842'})</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1">
              <UserCheck className="w-4 h-4" /> TIER-1 VERIFIED
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold flex items-center gap-1">
              <Lock className="w-4 h-4 text-yellow-400" /> Staked: ${(stakedCollateral || 2000).toLocaleString()} USDT
            </div>
          </div>
        </div>

        {/* 4 Metric Quick Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/30 space-y-0.5">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Active Merchant VPA</span>
            <div className="font-bold text-yellow-300 text-xs truncate">{savedVpa}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/70 border border-emerald-500/30 space-y-0.5">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Your Sell Rate (Cust. Buys)</span>
            <div className="font-bold text-yellow-400 text-sm">₹{merchantSellRate.toFixed(2)} INR</div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/70 border border-purple-500/30 space-y-0.5">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Your Buy Rate (Cust. Sells)</span>
            <div className="font-bold text-emerald-400 text-sm">₹{merchantBuyRate.toFixed(2)} INR</div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/70 border border-yellow-500/30 space-y-0.5">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">Spread Profit Margin</span>
            <div className="font-bold text-yellow-400 text-sm">+₹{spreadMargin} INR / USDT</div>
          </div>
        </div>

        {/* 4 Main Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-xl bg-black/80 border border-zinc-800 text-xs font-black">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ORDERS'
                ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-400 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-yellow-400" /> Incoming Escrow Orders ({orders.filter(o => o.status === 'PENDING_MERCHANT_RELEASE').length})
          </button>

          <button
            onClick={() => setActiveTab('PRICING')}
            className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'PRICING'
                ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Set Buy & Sell Rates
          </button>

          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ANALYTICS'
                ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-400 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" /> Yield & Volume Analytics
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'SETTINGS'
                ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-400 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 text-blue-400" /> VPA & Bank Settings
          </button>
        </div>

        {/* Tab Content Desk */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 text-left">
          
          {/* TAB 1: LIVE INCOMING ORDERS & ESCROW RELEASE DESK */}
          {activeTab === 'ORDERS' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-300">Live Customer P2P Escrow Orders:</div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-black/80 border border-zinc-800 text-[11px] font-bold">
                  {(['ALL', 'BUY', 'SELL'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setOrdersFilter(filter)}
                      className={`px-3 py-1 rounded-md transition-all ${
                        ordersFilter === filter
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-5 rounded-2xl bg-black/70 border border-zinc-800 hover:border-yellow-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 max-w-lg">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          ord.type === 'BUY'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}>
                          {ord.type === 'BUY' ? '🟢 BUY ORDER (CUSTOMER PAID UPI)' : '🔴 SELL CASH ORDER (SEND PAYOUT)'}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">#{ord.id}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">• {ord.timestamp}</span>
                      </div>

                      <div className="text-sm font-mono text-white">
                        Order Grams: <strong className="text-yellow-400">{ord.goldAmount} Grams $GOLD</strong> (${ord.usdtCost} USDT)
                        <span className="text-emerald-400 font-bold ml-2">= ₹{ord.inrAmount.toLocaleString('en-IN')} INR</span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/90 border border-zinc-800 text-xs font-mono space-y-1">
                        <div className="text-zinc-400 text-[10px] font-bold uppercase">Customer Payment & Release Details:</div>
                        <div className="text-white font-bold">{ord.customerUtrOrAccount}</div>
                        <div className="text-zinc-500 text-[10px]">Customer Wallet: {ord.customerWallet}</div>
                      </div>
                    </div>

                    <div className="shrink-0 w-full md:w-auto">
                      {ord.status === 'COMPLETED' ? (
                        <span className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold font-mono flex items-center gap-1.5 justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Released & Finalized
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMerchantReleaseEscrow(ord.id)}
                          disabled={releasingOrderId === ord.id}
                          className="w-full md:w-auto px-6 py-3 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {releasingOrderId === ord.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-black" /> Verifying Escrow...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 text-black" /> Verify & Release Escrow <ArrowUpRight className="w-4 h-4 text-black" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'PRICING' ? (
            /* TAB 2: DUAL PRICE PRICING DESK (SET BUY & SELL RATES) */
            <div className="space-y-6">
              {rateSaveSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Custom Merchant Buy Rate (₹{merchantBuyRate.toFixed(2)}) & Sell Rate (₹{merchantSellRate.toFixed(2)}) Saved & Applied Live to P2P Marketplace!</span>
                </div>
              )}

              <form onSubmit={handleSaveDualRates} className="p-6 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-6">
                <div>
                  <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Merchant Dual Pricing Control Panel
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">Set Your Custom P2P Buy & Sell Exchange Rates</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    These rates will dictate the price at which customers BUY from you or SELL to you in the P2P Marketplace.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono">
                  {/* Merchant SELL Rate (When Customers BUY from Merchant) */}
                  <div className="p-4 rounded-xl bg-black/90 border border-yellow-500/40 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-yellow-400 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Merchant Sell Rate:
                      </span>
                      <span className="text-[10px] text-zinc-400">Rate when users Buy</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-yellow-400">₹</span>
                      <input
                        type="number"
                        step="0.1"
                        value={merchantSellRate}
                        onChange={(e) => setMerchantSellRate(parseFloat(e.target.value) || 95.80)}
                        className="w-full px-4 py-2.5 rounded-xl bg-black border border-yellow-500/50 text-yellow-300 font-bold text-lg focus:outline-none focus:border-yellow-400"
                      />
                      <span className="text-xs text-zinc-400">INR/USDT</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Customers will pay <strong className="text-yellow-400">₹{merchantSellRate.toFixed(2)} INR</strong> per 1 USDT worth of $GOLD.
                    </div>
                  </div>

                  {/* Merchant BUY Rate (When Customers SELL to Merchant) */}
                  <div className="p-4 rounded-xl bg-black/90 border border-emerald-500/40 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" /> Merchant Buy Rate:
                      </span>
                      <span className="text-[10px] text-zinc-400">Rate when users Sell</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-emerald-400">₹</span>
                      <input
                        type="number"
                        step="0.1"
                        value={merchantBuyRate}
                        onChange={(e) => setMerchantBuyRate(parseFloat(e.target.value) || 94.20)}
                        className="w-full px-4 py-2.5 rounded-xl bg-black border border-emerald-500/50 text-emerald-300 font-bold text-lg focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-xs text-zinc-400">INR/USDT</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Customers will receive <strong className="text-emerald-400">₹{merchantBuyRate.toFixed(2)} INR Cash</strong> per 1 USDT worth of $GOLD.
                    </div>
                  </div>
                </div>

                {/* Calculated Spread Profit Margin Box */}
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-300 font-bold flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-yellow-400" /> Your Net Spread Margin per Trade:
                  </span>
                  <span className="text-yellow-400 font-black text-base">
                    +₹{spreadMargin} INR / USDT Profit
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/25 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                >
                  💾 SAVE & APPLY BUY/SELL RATES TO P2P MARKETPLACE
                </button>
              </form>
            </div>
          ) : activeTab === 'ANALYTICS' ? (
            /* TAB 3: MERCHANT SPREAD YIELD & VOLUME ANALYTICS */
            <div className="space-y-6 text-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-2">
                  <Coins className="w-8 h-8 text-yellow-400 mx-auto" />
                  <div className="text-xs text-zinc-400 uppercase font-bold">Total USDT Volume</div>
                  <div className="text-2xl font-black text-white">$50,000.00 USDT</div>
                  <div className="text-[10px] text-emerald-400 font-bold">3,840 Trades Handled</div>
                </div>

                <div className="p-5 rounded-2xl bg-black/70 border border-emerald-500/30 space-y-2">
                  <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="text-xs text-zinc-400 uppercase font-bold">Net Spread Profit Earned</div>
                  <div className="text-2xl font-black text-emerald-400">+$1,250.00 USDT</div>
                  <div className="text-[10px] text-yellow-400 font-bold">~₹1,18,125.00 INR Cash Profit</div>
                </div>

                <div className="p-5 rounded-2xl bg-black/70 border border-purple-500/30 space-y-2">
                  <Award className="w-8 h-8 text-purple-400 mx-auto" />
                  <div className="text-xs text-zinc-400 uppercase font-bold">Merchant Rating & Speed</div>
                  <div className="text-2xl font-black text-purple-300">100% Score</div>
                  <div className="text-[10px] text-zinc-400 font-bold">0.4 Mins Avg Release Speed</div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-black/80 border border-yellow-500/30 text-left space-y-2">
                <div className="text-xs uppercase font-bold text-yellow-400 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" /> Daily P2P Liquidity Performance Metrics
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  As an Authorized Tier-1 Merchant, your 2,000 USDT collateral deposit earns a daily base yield of <strong className="text-yellow-400">+12.5% APY</strong> plus <strong className="text-emerald-400">₹{spreadMargin} INR spread per USDT traded</strong>.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 4: MERCHANT VPA & BANK SETTINGS */
            <div className="space-y-6">
              {savedSuccessAlert && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Merchant VPA & Banking Settings Saved Successfully!</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl mx-auto font-mono text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300">Primary Merchant UPI VPA (Receiver VPA):</label>
                  <input
                    type="text"
                    value={savedVpa}
                    onChange={(e) => setSavedVpa(e.target.value)}
                    placeholder="merchant@sbi"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black border border-yellow-500/40 text-yellow-300 font-bold focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-300">Bank Account Number:</label>
                    <input
                      type="text"
                      value={savedBankAc}
                      onChange={(e) => setSavedBankAc(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-yellow-500/40 text-yellow-300 font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-300">IFSC Code:</label>
                    <input
                      type="text"
                      value={savedIfsc}
                      onChange={(e) => setSavedIfsc(e.target.value.toUpperCase())}
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-yellow-500/40 text-yellow-300 font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300">Auto-Reply Chat Greeting Template:</label>
                  <textarea
                    rows={3}
                    value={autoReplyMsg}
                    onChange={(e) => setAutoReplyMsg(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black border border-yellow-500/40 text-yellow-300 font-sans focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-black uppercase text-xs tracking-wider shadow-lg hover:scale-[1.01] transition-all"
                >
                  💾 Save Merchant VPA & Settings
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
