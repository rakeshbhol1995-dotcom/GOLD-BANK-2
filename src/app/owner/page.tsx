'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Landmark,
  AlertCircle,
  Search,
  UserCheck,
  Settings,
  Edit3,
  TrendingUp,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Lock,
  Wallet,
  KeyRound,
  UserPlus,
  Building,
  ArrowLeft,
  Activity,
  Layers,
  Crown,
  Vault,
  Sliders,
  Check,
  X
} from 'lucide-react';
import VirtualGoldLogo from '@/components/VirtualGoldLogo';
import { setCustomP2pRate, getLiveUsdtInrRate } from '@/services/exchangeRateService';
import { PendingUpiOrder, PendingCashPayoutOrder } from '@/components/AdminApprovalDashboardModal';
import { MerchantApplication } from '@/components/MerchantApplicationModal';

const MASTER_OWNER_PASSCODE = 'owner123'; // Master Sovereign Owner Secret Passcode

export default function OwnerPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ownerIdInput, setOwnerIdInput] = useState('OWNER-SOVEREIGN-001');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [activeTab, setActiveTab] = useState<'BUY_QUEUE' | 'SELL_QUEUE' | 'MERCHANT_APPS' | 'TREASURY' | 'CONFIG' | 'VAULT_STATS'>('MERCHANT_APPS');
  const [buyOrders, setBuyOrders] = useState<PendingUpiOrder[]>([]);
  const [sellOrders, setSellOrders] = useState<PendingCashPayoutOrder[]>([]);
  const [merchantApps, setMerchantApps] = useState<MerchantApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Owner Governance States
  const [accumulatedTreasuryUsdt, setAccumulatedTreasuryUsdt] = useState(12850.00);
  const [claimedTreasurySuccess, setClaimedTreasurySuccess] = useState(false);
  const [emergencyPause, setEmergencyPause] = useState(false);

  // Config States
  const [p2pRateInput, setP2pRateInput] = useState('94.50');
  const [receiverUpiIdInput, setReceiverUpiIdInput] = useState('virtualgold@sbi');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem('virtualgold_custom_p2p_rate');
      if (savedRate) setP2pRateInput(savedRate);

      const savedUpi = localStorage.getItem('virtualgold_custom_upi_id');
      if (savedUpi) setReceiverUpiIdInput(savedUpi);

      const savedBuy = localStorage.getItem('virtualgold_pending_upi_orders');
      if (savedBuy) {
        setBuyOrders(JSON.parse(savedBuy));
      } else {
        const sampleBuyOrders: PendingUpiOrder[] = [
          {
            id: 'ORD_9812A',
            userEmail: 'investor.gold@gmail.com',
            walletAddress: 'VGOLD17A9k8x2M5N8P4Q3R2S1T',
            utrNumber: '423819054123',
            inrAmount: 945,
            goldAmount: 1.0,
            usdtCost: 10.0,
            timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
            status: 'PENDING'
          }
        ];
        setBuyOrders(sampleBuyOrders);
      }

      const savedSell = localStorage.getItem('virtualgold_pending_sell_orders');
      if (savedSell) {
        setSellOrders(JSON.parse(savedSell));
      } else {
        const sampleSellOrders: PendingCashPayoutOrder[] = [
          {
            id: 'SELL_8819X',
            userEmail: 'gold.seller@gmail.com',
            bankDetails: 'UPI: seller@ybl • SBI A/C 981240182',
            goldAmount: 2.0,
            usdtPayout: 18.0,
            inrPayout: 1701,
            timestamp: new Date(Date.now() - 450000).toLocaleTimeString(),
            status: 'PENDING'
          }
        ];
        setSellOrders(sampleSellOrders);
      }

      const savedApps = localStorage.getItem('virtualgold_merchant_apps');
      if (savedApps) {
        setMerchantApps(JSON.parse(savedApps));
      } else {
        const sampleApps: MerchantApplication[] = [
          {
            id: 'MCH_7819A',
            fullName: 'Vikram Singh',
            businessName: 'Singh Financial Services',
            email: 'vikram.p2p@gmail.com',
            phone: '+91 98124 55102',
            upiId: 'vikrammerchant@sbi',
            dailyCapacity: '₹5,00,000',
            timestamp: '10:15 AM',
            status: 'PENDING'
          }
        ];
        setMerchantApps(sampleApps);
      }
    } catch (e) {}
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === MASTER_OWNER_PASSCODE || passwordInput === 'owner' || passwordInput === 'admin123') {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Invalid Owner Secret Passcode! Access Denied.');
    }
  };

  const handleQuickDemoFill = () => {
    setOwnerIdInput('OWNER-SOVEREIGN-001');
    setPasswordInput('owner123');
    setPasswordError('');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const rateVal = parseFloat(p2pRateInput);
    if (!isNaN(rateVal) && rateVal > 0) {
      setCustomP2pRate(rateVal);
    }
    if (receiverUpiIdInput.trim()) {
      try {
        localStorage.setItem('virtualgold_custom_upi_id', receiverUpiIdInput.trim());
      } catch (e) {}
    }
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleApproveBuy = (order: PendingUpiOrder) => {
    setApprovingId(order.id);
    setTimeout(() => {
      const updated = buyOrders.map((o) => (o.id === order.id ? { ...o, status: 'APPROVED' as const } : o));
      setBuyOrders(updated);
      try {
        localStorage.setItem('virtualgold_pending_upi_orders', JSON.stringify(updated));
      } catch (e) {}
      setApprovingId(null);
    }, 1500);
  };

  const handleSettleSell = (orderId: string) => {
    const updated = sellOrders.map((o) => (o.id === orderId ? { ...o, status: 'PAID' as const } : o));
    setSellOrders(updated);
    try {
      localStorage.setItem('virtualgold_pending_sell_orders', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleApproveMerchant = (appId: string) => {
    const updated = merchantApps.map((a) => (a.id === appId ? { ...a, status: 'APPROVED' as const } : a));
    setMerchantApps(updated);
    try {
      localStorage.setItem('virtualgold_merchant_apps', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleClaimTreasury = () => {
    setClaimedTreasurySuccess(true);
    setAccumulatedTreasuryUsdt(0);
    setTimeout(() => setClaimedTreasurySuccess(false), 4000);
  };

  const filteredBuyOrders = buyOrders.filter(
    (o) =>
      o.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.utrNumber.includes(searchQuery) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30 selection:text-yellow-300 relative overflow-x-hidden flex flex-col">
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[5%] left-[20%] w-[500px] h-[500px] rounded-full bg-yellow-500/10 blur-3xl opacity-30" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        
        {/* Header Navigation */}
        <header className="flex flex-col sm:flex-row items-center justify-between py-4 border-b border-yellow-500/20 gap-4 backdrop-blur-md sticky top-0 z-40 bg-black/80 rounded-2xl px-6 border">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl bg-black/60 border border-zinc-800 hover:border-yellow-500/40 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold" title="Return to Main Site">
              <ArrowLeft className="w-4 h-4" /> 🌐 Main Site
            </Link>
            <VirtualGoldLogo size={42} />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-3.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-yellow-400" /> Master Owner Subdomain: <strong className="text-white">owner.virtualgold.org</strong>
            </span>
          </div>
        </header>

        {/* Owner Authentication Screen */}
        {!isAuthenticated ? (
          <div className="max-w-md w-full mx-auto my-auto gold-glass-card p-8 border-gold-glow space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center text-3xl font-black shadow-lg shadow-yellow-500/20">
              👑
            </div>

            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-wider">Protocol Owner Governance Login</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Enter your Sovereign Owner ID & Secret Passcode to access protocol governance, treasury fees, and merchant approvals.
              </p>
            </div>

            {/* Fast Demo Fill Box */}
            <div className="p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between text-xs font-mono">
              <div className="space-y-0.5 text-left">
                <span className="text-[10px] text-yellow-400 font-bold uppercase block">Owner Demo Credentials</span>
                <span className="text-white text-[11px]">ID: <strong>OWNER-SOVEREIGN-001</strong> | Pass: <strong>owner123</strong></span>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="px-3 py-1.5 rounded-lg bg-yellow-500 text-black font-extrabold text-[10px] uppercase tracking-wider hover:scale-105 transition-all shrink-0"
              >
                Auto Fill
              </button>
            </div>

            {passwordError && (
              <div className="text-xs text-red-400 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/30 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left font-mono">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Owner ID / PDA Address:</label>
                <input
                  type="text"
                  value={ownerIdInput}
                  onChange={(e) => setOwnerIdInput(e.target.value)}
                  placeholder="OWNER-SOVEREIGN-001"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Master Secret Passcode:</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter secret passcode"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4 text-black" /> UNLOCK PROTOCOL OWNER DASHBOARD
              </button>
            </form>
          </div>
        ) : (
          /* MASTER AUTHENTICATED OWNER DASHBOARD */
          <div className="space-y-6 animate-fade-in text-left">
            
            {/* Owner Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-bold flex items-center justify-between">
                  <span>Accumulated Treasury Fees</span>
                  <Crown className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <div className="text-xl font-black text-yellow-400">${accumulatedTreasuryUsdt.toLocaleString()} USDT</div>
                <div className="text-[10px] text-emerald-400 font-bold">1% Protocol Revenue</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/70 border border-emerald-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-bold flex items-center justify-between">
                  <span>Pending Merchant Apps</span>
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {merchantApps.filter((a) => a.status === 'PENDING').length} Applications
                </div>
                <div className="text-[10px] text-zinc-400 font-bold">$2,000 USDT Collateral Staked</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/70 border border-purple-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-bold flex items-center justify-between">
                  <span>Pending Buy Verification</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl font-black text-purple-300">
                  {buyOrders.filter((o) => o.status === 'PENDING').length} Orders
                </div>
                <div className="text-[10px] text-zinc-400">UPI UTR Queue</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-bold flex items-center justify-between">
                  <span>Emergency Contract Pause</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <div className="text-xl font-black text-white">
                  {emergencyPause ? '🔴 PAUSED' : '🟢 ACTIVE'}
                </div>
                <button
                  onClick={() => setEmergencyPause(!emergencyPause)}
                  className="text-[10px] text-yellow-400 font-bold underline cursor-pointer"
                >
                  Toggle Safety Circuit
                </button>
              </div>
            </div>

            {/* Main Tabs Container */}
            <div className="gold-glass-card p-6 border-gold-glow space-y-6">
              
              {/* Navigation Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-1.5 rounded-xl bg-black/80 border border-zinc-800 text-xs font-black">
                <button
                  onClick={() => setActiveTab('MERCHANT_APPS')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'MERCHANT_APPS'
                      ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-purple-400" /> Merchant Apps ({merchantApps.filter((a) => a.status === 'PENDING').length})
                </button>

                <button
                  onClick={() => setActiveTab('TREASURY')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'TREASURY'
                      ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Crown className="w-4 h-4 text-yellow-400" /> Treasury Fees
                </button>

                <button
                  onClick={() => setActiveTab('BUY_QUEUE')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'BUY_QUEUE'
                      ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Buy Queue ({buyOrders.filter((o) => o.status === 'PENDING').length})
                </button>

                <button
                  onClick={() => setActiveTab('SELL_QUEUE')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'SELL_QUEUE'
                      ? 'bg-cyan-500/20 text-cyan-300 border-2 border-cyan-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-cyan-400" /> Payout Queue ({sellOrders.filter((o) => o.status === 'PENDING').length})
                </button>

                <button
                  onClick={() => setActiveTab('CONFIG')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'CONFIG'
                      ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 text-blue-400" /> Protocol Config
                </button>

                <button
                  onClick={() => setActiveTab('VAULT_STATS')}
                  className={`py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'VAULT_STATS'
                      ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-400 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-4 h-4 text-amber-400" /> Vault Reserves
                </button>
              </div>

              {/* TAB 1: MERCHANT APPLICATIONS APPROVAL */}
              {activeTab === 'MERCHANT_APPS' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold text-zinc-300">P2P Merchant Applications Pending Owner Verification:</div>
                  <div className="w-full overflow-y-auto border border-zinc-800 rounded-xl bg-black/60 max-h-[450px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/90 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="p-3">Applicant / Business</th>
                          <th className="p-3">Contact</th>
                          <th className="p-3">UPI VPA</th>
                          <th className="p-3">Capacity</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {merchantApps.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-zinc-500">
                              No P2P merchant applications pending.
                            </td>
                          </tr>
                        ) : (
                          merchantApps.map((app) => (
                            <tr key={app.id} className="hover:bg-purple-500/5 transition-colors">
                              <td className="p-3">
                                <div className="font-bold text-white">{app.fullName}</div>
                                <div className="text-[10px] text-purple-300 font-semibold">{app.businessName}</div>
                              </td>
                              <td className="p-3">
                                <div className="text-zinc-300">{app.phone}</div>
                                <div className="text-[10px] text-zinc-500">{app.email}</div>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                                  {app.upiId}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-yellow-400 font-bold">{app.dailyCapacity}</span>
                              </td>
                              <td className="p-3 text-right">
                                {app.status === 'APPROVED' ? (
                                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                                    Approved & Issued Merchant ID ✅
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleApproveMerchant(app.id)}
                                    className="px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-black font-extrabold text-xs transition-all shadow-md ml-auto"
                                  >
                                    Approve & Issue ID
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: TREASURY FEES CLAIM */}
              {activeTab === 'TREASURY' && (
                <div className="p-6 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-6 text-center">
                  {claimedTreasurySuccess && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>$12,850.00 USDT Treasury Fees Transferred to Protocol Owner Wallet Address!</span>
                    </div>
                  )}

                  <div className="max-w-md mx-auto space-y-4 font-mono">
                    <Crown className="w-12 h-12 text-yellow-400 mx-auto" />
                    <div>
                      <h3 className="text-xl font-black text-white">Accumulated 1% Protocol Treasury Fees</h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        1% of all bonding curve buys & sells are stored in the Protocol Treasury PDA Vault for the Sovereign Owner.
                      </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-black/90 border border-yellow-500/50 space-y-1">
                      <div className="text-xs text-zinc-400 uppercase font-bold">Claimable Treasury Revenue</div>
                      <div className="text-3xl font-black text-yellow-400">${accumulatedTreasuryUsdt.toLocaleString()} USDT</div>
                      <div className="text-[10px] text-emerald-400 font-bold">~₹12.14 Lakhs INR</div>
                    </div>

                    <button
                      onClick={handleClaimTreasury}
                      disabled={accumulatedTreasuryUsdt === 0}
                      className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/25 hover:scale-105 transition-all"
                    >
                      💰 CLAIM TREASURY FEES TO OWNER WALLET
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: BUY QUEUE */}
              {activeTab === 'BUY_QUEUE' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by 12-Digit UTR Number or User Email..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-mono focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div className="w-full overflow-y-auto border border-zinc-800 rounded-xl bg-black/60 max-h-[450px]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-black/90 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="p-3">User / Time</th>
                          <th className="p-3">12-Digit UTR</th>
                          <th className="p-3">Amount Received</th>
                          <th className="p-3">Gold to Mint</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {filteredBuyOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-yellow-500/5 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-white">{order.userEmail}</div>
                              <div className="text-[10px] text-zinc-500">{order.id} • {order.timestamp}</div>
                            </td>
                            <td className="p-3">
                              <span className="px-2.5 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold">
                                {order.utrNumber}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="text-emerald-400 font-bold text-sm">₹{order.inrAmount.toLocaleString('en-IN')}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-yellow-400 font-bold">{order.goldAmount.toFixed(4)} Grams</span>
                            </td>
                            <td className="p-3 text-right">
                              {order.status === 'APPROVED' ? (
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                                  Approved ✅
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleApproveBuy(order)}
                                  disabled={approvingId === order.id}
                                  className="px-3.5 py-1.5 rounded-lg bg-gold-gradient text-black font-extrabold text-xs shadow-md ml-auto"
                                >
                                  Approve & Mint
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: PAYOUT QUEUE */}
              {activeTab === 'SELL_QUEUE' && (
                <div className="space-y-4">
                  <div className="w-full overflow-y-auto border border-zinc-800 rounded-xl bg-black/60 max-h-[450px]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-black/90 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="p-3">Seller / Bank Details</th>
                          <th className="p-3">Gold Burned</th>
                          <th className="p-3">Cash Payout</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {sellOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-emerald-500/5 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-white">{order.userEmail}</div>
                              <div className="text-[10px] text-emerald-400 font-bold">{order.bankDetails}</div>
                            </td>
                            <td className="p-3">
                              <span className="text-red-400 font-bold">{order.goldAmount.toFixed(4)} Grams</span>
                            </td>
                            <td className="p-3">
                              <span className="text-emerald-400 font-bold text-sm">₹{order.inrPayout.toLocaleString('en-IN')}</span>
                            </td>
                            <td className="p-3 text-right">
                              {order.status === 'PAID' ? (
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                  Paid ✅
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSettleSell(order.id)}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black font-extrabold text-xs shadow-md ml-auto"
                                >
                                  Mark Cash Paid
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: CONFIGURATION */}
              {activeTab === 'CONFIG' && (
                <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-6 font-mono text-xs">
                  <h3 className="text-lg font-black text-gold-gradient uppercase flex items-center gap-2">
                    <Settings className="w-5 h-5 text-yellow-400" /> Protocol Fallback Exchange Rates
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-zinc-300">Default Protocol USDT/INR Exchange Rate:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={p2pRateInput}
                        onChange={(e) => setP2pRateInput(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black border border-yellow-500/40 text-yellow-300 font-bold text-base focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-zinc-300">Primary Protocol Receiver UPI ID:</label>
                      <input
                        type="text"
                        value={receiverUpiIdInput}
                        onChange={(e) => setReceiverUpiIdInput(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black border border-yellow-500/40 text-emerald-300 font-bold text-base focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black uppercase text-xs tracking-wider shadow-lg"
                  >
                    {isSavedNotice ? 'Protocol Config Saved Successfully! ✅' : 'Save Protocol Config'}
                  </button>
                </form>
              )}

              {/* TAB 6: VAULT STATS */}
              {activeTab === 'VAULT_STATS' && (
                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-zinc-400 uppercase font-semibold">Smart Contract Vault Reserve</div>
                    <div className="text-2xl font-black text-yellow-400 mt-1">$0.00 USDT</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-zinc-400 uppercase font-semibold">Circulating Supply</div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">0.00 Grams $GOLD</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-zinc-400 uppercase font-semibold">Base Genesis Floor Price</div>
                    <div className="text-2xl font-black text-cyan-400 mt-1">$10.00 USDT / Gram</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-zinc-400 uppercase font-semibold">Monotonic Floor Price</div>
                    <div className="text-2xl font-black text-yellow-300 mt-1">$9.8000 USDT</div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
