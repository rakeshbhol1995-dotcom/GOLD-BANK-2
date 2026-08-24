'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
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
  Percent,
  Settings,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  BarChart3,
  Award,
  Zap,
  ArrowUpRight,
  UserCheck,
  TrendingDown,
  ArrowLeft,
  KeyRound,
  User,
  UserPlus
} from 'lucide-react';
import VirtualGoldLogo from '@/components/VirtualGoldLogo';

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

const INITIAL_MERCHANT_ADS: MerchantP2pAd[] = [
  {
    id: 'AD_001',
    type: 'BUY',
    pricePerUsdtInr: 94.50,
    minLimitInr: 500,
    maxLimitInr: 200000,
    paymentMethods: ['Google Pay', 'PhonePe', 'Paytm', 'UPI QR'],
    vpa: 'virtualgold@sbi',
    isActive: true
  },
  {
    id: 'AD_002',
    type: 'SELL',
    pricePerUsdtInr: 95.80,
    minLimitInr: 1000,
    maxLimitInr: 500000,
    paymentMethods: ['Bank IMPS', 'PhonePe', 'UPI VPA'],
    vpa: 'virtualgold@sbi',
    isActive: true
  }
];

export default function MerchantPortalPage() {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'APPLY'>('LOGIN');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Login Form States
  const [merchantIdInput, setMerchantIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeMerchantId, setActiveMerchantId] = useState('MCH-GOLD-9842');

  // Apply Form States
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [dailyCapacity, setDailyCapacity] = useState('₹5,00,000');
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PRICING' | 'ADS' | 'ANALYTICS' | 'SETTINGS'>('ORDERS');
  const [ordersFilter, setOrdersFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [orders, setOrders] = useState<MerchantP2pOrder[]>(INITIAL_MERCHANT_ORDERS);
  const [ads, setAds] = useState<MerchantP2pAd[]>(INITIAL_MERCHANT_ADS);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);

  // DUAL PRICING STATE: Buy Rate vs Sell Rate
  const [merchantBuyRate, setMerchantBuyRate] = useState<number>(94.20);
  const [merchantSellRate, setMerchantSellRate] = useState<number>(95.80);
  const [rateSaveSuccess, setRateSaveSuccess] = useState(false);

  // New Ad Form State
  const [newAdType, setNewAdType] = useState<'BUY' | 'SELL'>('BUY');
  const [adRate, setAdRate] = useState<number>(95.00);
  const [adMinInr, setAdMinInr] = useState<number>(500);
  const [adMaxInr, setAdMaxInr] = useState<number>(100000);
  const [adPaymentMethod, setAdPaymentMethod] = useState<string>('Google Pay / PhonePe / Paytm');

  // Settings State
  const [savedVpa, setSavedVpa] = useState('merchant@sbi');
  const [savedBankAc, setSavedBankAc] = useState('984200112233');
  const [savedIfsc, setSavedIfsc] = useState('SBIN0001234');
  const [savedSuccessAlert, setSavedSuccessAlert] = useState(false);

  // Load persistent rates & sessions
  useEffect(() => {
    try {
      const savedId = localStorage.getItem('virtualgold_active_merchant_id');
      if (savedId) setActiveMerchantId(savedId);

      const savedVpaStr = localStorage.getItem('virtualgold_merchant_vpa');
      if (savedVpaStr) setSavedVpa(savedVpaStr);

      const savedRates = localStorage.getItem('virtualgold_merchant_dual_rates');
      if (savedRates) {
        const { buyRate, sellRate } = JSON.parse(savedRates);
        if (buyRate) setMerchantBuyRate(buyRate);
        if (sellRate) setMerchantSellRate(sellRate);
      }
    } catch (e) {}
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantIdInput.trim()) {
      setAuthError('Please enter your Merchant ID.');
      return;
    }
    if (!passwordInput.trim()) {
      setAuthError('Please enter your Merchant Password.');
      return;
    }

    setActiveMerchantId(merchantIdInput.trim());
    setIsAuthenticated(true);
    setAuthError('');
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingApp(true);

    setTimeout(() => {
      const newMerchantId = `MCH-GOLD-${Math.floor(1000 + Math.random() * 9000)}`;
      setActiveMerchantId(newMerchantId);
      setSavedVpa(upiId || 'merchant@sbi');
      
      try {
        localStorage.setItem('virtualgold_active_merchant_id', newMerchantId);
        localStorage.setItem('virtualgold_merchant_vpa', upiId || 'merchant@sbi');
      } catch (e) {}

      setIsSubmittingApp(false);
      setIsAuthenticated(true);
      alert(`🎉 Congratulations! Your P2P Merchant License Application for ${businessName || fullName} is Approved! Your Merchant ID is: ${newMerchantId}`);
    }, 2000);
  };

  const handleQuickDemoFill = () => {
    setMerchantIdInput('MCH-GOLD-9842');
    setPasswordInput('merchant123');
    setAuthError('');
  };

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

  const handleToggleAdStatus = (adId: string) => {
    setAds((prev) =>
      prev.map((ad) => (ad.id === adId ? { ...ad, isActive: !ad.isActive } : ad))
    );
  };

  const handleCreateAd = (e: React.FormEvent) => {
    e.preventDefault();
    const newAd: MerchantP2pAd = {
      id: `AD_${Date.now()}`,
      type: newAdType,
      pricePerUsdtInr: adRate,
      minLimitInr: adMinInr,
      maxLimitInr: adMaxInr,
      paymentMethods: [adPaymentMethod],
      vpa: savedVpa,
      isActive: true
    };
    setAds((prev) => [newAd, ...prev]);
    alert(`✅ New P2P Merchant Listing Published (${newAdType} @ ₹${adRate.toFixed(2)} INR/USDT)!`);
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
    <main className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30 selection:text-yellow-300 relative overflow-x-hidden flex flex-col">
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[5%] left-[20%] w-[500px] h-[500px] rounded-full bg-yellow-500/10 blur-3xl opacity-30" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        
        {/* Header Navigation with Subdomain SEO Bar */}
        <header className="flex flex-col sm:flex-row items-center justify-between py-4 border-b border-yellow-500/20 gap-4 backdrop-blur-md sticky top-0 z-40 bg-black/80 rounded-2xl px-6 border">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl bg-black/60 border border-zinc-800 hover:border-yellow-500/40 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold" title="Return to Main Domain (virtualgold.org)">
              <ArrowLeft className="w-4 h-4" /> 🌐 Main Site (virtualgold.org)
            </Link>
            <VirtualGoldLogo size={42} />
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <div className="px-3.5 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold flex items-center gap-1.5">
              <Building className="w-4 h-4 text-yellow-400" /> Subdomain Portal: <strong className="text-white">merchant.virtualgold.org</strong>
            </div>

            {!isAuthenticated && (
              <div className="flex items-center gap-1 bg-black/90 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setAuthMode('LOGIN')}
                  className={`px-3 py-1 rounded-lg transition-all font-bold ${
                    authMode === 'LOGIN' ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🔒 Merchant Login
                </button>
                <button
                  onClick={() => setAuthMode('APPLY')}
                  className={`px-3 py-1 rounded-lg transition-all font-bold ${
                    authMode === 'APPLY' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  📝 Apply Merchant
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Merchant Login & Apply Portal if not authenticated */}
        {!isAuthenticated ? (
          <div className="max-w-xl w-full mx-auto my-auto gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center text-3xl font-black shadow-lg shadow-yellow-500/20">
              👑
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">Merchant Portal Access</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Log in with your existing Merchant ID or Apply for a new $2,000 USDT Collateral Merchant License.
              </p>
            </div>

            {/* Mode Selector Tabs: LOGIN vs APPLY */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-black/90 border border-zinc-800 text-xs font-black">
              <button
                type="button"
                onClick={() => setAuthMode('LOGIN')}
                className={`py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  authMode === 'LOGIN'
                    ? 'bg-yellow-500 text-black font-black shadow-lg'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4" /> MERCHANT LOGIN
              </button>

              <button
                type="button"
                onClick={() => setAuthMode('APPLY')}
                className={`py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  authMode === 'APPLY'
                    ? 'bg-purple-600 text-white font-black shadow-lg'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" /> APPLY MERCHANT LICENSE
              </button>
            </div>

            {/* LOGIN FORM */}
            {authMode === 'LOGIN' ? (
              <div className="space-y-4">
                {/* Demo Fast Login Box */}
                <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between text-xs">
                  <div className="space-y-0.5 text-left">
                    <span className="text-[10px] text-yellow-400 font-bold uppercase block">Demo Merchant Credentials</span>
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

                {authError && (
                  <div className="text-xs text-red-400 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/30 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4 text-left font-mono">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-yellow-400" /> Merchant ID / VPA:
                    </label>
                    <input
                      type="text"
                      value={merchantIdInput}
                      onChange={(e) => setMerchantIdInput(e.target.value)}
                      placeholder="e.g. MCH-GOLD-9842 or merchant@sbi"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-bold text-sm focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-yellow-400" /> Merchant Security Password:
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter security password"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-bold text-sm focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4 text-black" /> LOGIN TO MERCHANT DASHBOARD
                  </button>
                </form>
              </div>
            ) : (
              /* APPLY FORM */
              <form onSubmit={handleApplySubmit} className="space-y-4 text-left font-mono text-xs">
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-yellow-400">
                    <ShieldCheck className="w-4 h-4" /> $2,000.00 USDT Collateral Deposit Required
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Applying for a Tier-1 Merchant License locks $2,000 USDT in smart contract escrow to guarantee instant order fulfillment.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold">Full Name:</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Vikram Singh"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-purple-500/40 text-white font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold">Business Name:</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Singh Gold Traders"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-purple-500/40 text-white font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold">Email Address:</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="merchant@gmail.com"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-purple-500/40 text-white font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold">Primary Merchant UPI VPA:</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="singhgold@sbi"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-purple-500/40 text-yellow-300 font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingApp}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-yellow-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-500/25 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                >
                  {isSubmittingApp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" /> Processing License & Staking $2,000 USDT...
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-yellow-300" /> STAKE $2,000 USDT & GENERATE MERCHANT ID
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* FULL STANDALONE MERCHANT SUITE DASHBOARD */
          <div className="space-y-6 animate-fade-in">
            
            {/* Merchant VIP Header Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Active Merchant ID</span>
                <div className="text-lg font-black text-yellow-400">{activeMerchantId}</div>
                <div className="text-[10px] text-emerald-400 font-bold">Verified Tier-1 Node</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/70 border border-emerald-500/30 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Staked Collateral</span>
                <div className="text-lg font-black text-emerald-400">$2,000.00 USDT</div>
                <div className="text-[10px] text-zinc-400 font-bold">🔒 Locked in PDA Vault</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/70 border border-purple-500/30 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Sell Rate (Cust. Buys)</span>
                <div className="text-lg font-black text-purple-300">₹{merchantSellRate.toFixed(2)} INR</div>
                <div className="text-[10px] text-zinc-400">Rate per USDT</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Buy Rate (Cust. Sells)</span>
                <div className="text-lg font-black text-yellow-300">₹{merchantBuyRate.toFixed(2)} INR</div>
                <div className="text-[10px] text-emerald-400 font-bold">Spread: +₹{spreadMargin} INR</div>
              </div>
            </div>

            {/* Navigation Bar */}
            <div className="gold-glass-card p-6 border-gold-glow space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 rounded-xl bg-black/80 border border-zinc-800 text-xs font-black">
                <button
                  onClick={() => setActiveTab('ORDERS')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'ORDERS'
                      ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4 text-yellow-400" /> Orders ({orders.filter(o => o.status === 'PENDING_MERCHANT_RELEASE').length})
                </button>

                <button
                  onClick={() => setActiveTab('PRICING')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'PRICING'
                      ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Buy/Sell Rates
                </button>

                <button
                  onClick={() => setActiveTab('ADS')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'ADS'
                      ? 'bg-cyan-500/20 text-cyan-300 border-2 border-cyan-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-cyan-400" /> P2P Ads ({ads.length})
                </button>

                <button
                  onClick={() => setActiveTab('ANALYTICS')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'ANALYTICS'
                      ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-purple-400" /> Analytics
                </button>

                <button
                  onClick={() => setActiveTab('SETTINGS')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'SETTINGS'
                      ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 text-blue-400" /> VPA & Settings
                </button>
              </div>

              {/* TAB CONTENT DESK */}
              {activeTab === 'ORDERS' ? (
                <div className="space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-zinc-300">Live Escrow Release Orders Queue:</div>
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-black/80 border border-zinc-800 text-[11px] font-bold font-mono">
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
                            Gold: <strong className="text-yellow-400">{ord.goldAmount} Grams</strong> (${ord.usdtCost} USDT) = <strong className="text-emerald-400">₹{ord.inrAmount.toLocaleString('en-IN')} INR</strong>
                          </div>

                          <div className="p-3 rounded-xl bg-black/90 border border-zinc-800 text-xs font-mono space-y-1">
                            <div className="text-zinc-400 text-[10px] font-bold uppercase">Customer Payment Info:</div>
                            <div className="text-white font-bold">{ord.customerUtrOrAccount}</div>
                          </div>
                        </div>

                        <div>
                          {ord.status === 'COMPLETED' ? (
                            <span className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold font-mono flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Released & Finalized
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMerchantReleaseEscrow(ord.id)}
                              disabled={releasingOrderId === ord.id}
                              className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                            >
                              {releasingOrderId === ord.id ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin text-black" /> Verifying...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4 text-black" /> Verify & Release Escrow
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
                /* DUAL PRICING DESK */
                <form onSubmit={handleSaveDualRates} className="p-6 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-6 text-left">
                  {rateSaveSuccess && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Custom Buy Rate (₹{merchantBuyRate.toFixed(2)}) & Sell Rate (₹{merchantSellRate.toFixed(2)}) Saved & Applied Live to P2P Marketplace!</span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-black text-white">Set Your Custom P2P Buy & Sell Exchange Rates</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Configure the exact rates customers will pay when buying $GOLD or receive when selling $GOLD to you.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono text-xs">
                    <div className="p-4 rounded-xl bg-black/90 border border-yellow-500/40 space-y-3">
                      <div className="font-bold text-yellow-400 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Merchant Sell Rate (Customer Buys):
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-yellow-400">₹</span>
                        <input
                          type="number"
                          step="0.1"
                          value={merchantSellRate}
                          onChange={(e) => setMerchantSellRate(parseFloat(e.target.value) || 95.80)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black border border-yellow-500/50 text-yellow-300 font-bold text-lg focus:outline-none"
                        />
                        <span className="text-xs text-zinc-400">INR/USDT</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-black/90 border border-emerald-500/40 space-y-3">
                      <div className="font-bold text-emerald-400 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" /> Merchant Buy Rate (Customer Sells):
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-emerald-400">₹</span>
                        <input
                          type="number"
                          step="0.1"
                          value={merchantBuyRate}
                          onChange={(e) => setMerchantBuyRate(parseFloat(e.target.value) || 94.20)}
                          className="w-full px-4 py-2.5 rounded-xl bg-black border border-emerald-500/50 text-emerald-300 font-bold text-lg focus:outline-none"
                        />
                        <span className="text-xs text-zinc-400">INR/USDT</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 font-bold">Your Net Spread Margin:</span>
                    <span className="text-yellow-400 font-black text-base">+₹{spreadMargin} INR / USDT Profit</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.01] transition-all"
                  >
                    💾 SAVE & APPLY BUY/SELL RATES TO P2P MARKETPLACE
                  </button>
                </form>
              ) : activeTab === 'ADS' ? (
                /* ADS MANAGEMENT */
                <div className="space-y-4 text-left">
                  <div className="text-xs font-bold text-zinc-300">Your Active Published P2P Merchant Ads ({ads.length}):</div>
                  {ads.map((ad) => (
                    <div
                      key={ad.id}
                      className="p-4 rounded-xl bg-black/70 border border-zinc-800 flex items-center justify-between gap-4 font-mono text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            ad.type === 'BUY' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {ad.type} AD
                          </span>
                          <span className="font-bold text-white text-base">₹{ad.pricePerUsdtInr.toFixed(2)} INR / USDT</span>
                        </div>
                        <div className="text-zinc-400 text-[11px]">
                          Limits: ₹{ad.minLimitInr.toLocaleString('en-IN')} - ₹{ad.maxLimitInr.toLocaleString('en-IN')} | Methods: {ad.paymentMethods.join(', ')}
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleAdStatus(ad.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                          ad.isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}
                      >
                        {ad.isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-500" />}
                        {ad.isActive ? 'ACTIVE' : 'PAUSED'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : activeTab === 'ANALYTICS' ? (
                /* ANALYTICS */
                <div className="space-y-6 text-center">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                    <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-2">
                      <Coins className="w-8 h-8 text-yellow-400 mx-auto" />
                      <div className="text-xs text-zinc-400 uppercase font-bold">Total USDT Volume</div>
                      <div className="text-2xl font-black text-white">$50,000.00 USDT</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-black/70 border border-emerald-500/30 space-y-2">
                      <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto" />
                      <div className="text-xs text-zinc-400 uppercase font-bold">Net Spread Profit</div>
                      <div className="text-2xl font-black text-emerald-400">+$1,250.00 USDT</div>
                    </div>

                    <div className="p-5 rounded-2xl bg-black/70 border border-purple-500/30 space-y-2">
                      <Award className="w-8 h-8 text-purple-400 mx-auto" />
                      <div className="text-xs text-zinc-400 uppercase font-bold">Completion Rating</div>
                      <div className="text-2xl font-black text-purple-300">100% Score</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SETTINGS */
                <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl mx-auto font-mono text-xs text-left">
                  {savedSuccessAlert && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Merchant Settings Saved Successfully!</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-300">Primary Merchant UPI VPA:</label>
                    <input
                      type="text"
                      value={savedVpa}
                      onChange={(e) => setSavedVpa(e.target.value)}
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

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-black uppercase text-xs tracking-wider shadow-lg hover:scale-[1.01] transition-all"
                  >
                    💾 Save Merchant VPA & Settings
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
