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
  Layers
} from 'lucide-react';
import VirtualGoldLogo from '@/components/VirtualGoldLogo';
import { setCustomP2pRate, getLiveUsdtInrRate } from '@/services/exchangeRateService';
import { PendingUpiOrder, PendingCashPayoutOrder } from '@/components/AdminApprovalDashboardModal';
import { MerchantApplication } from '@/components/MerchantApplicationModal';

const MASTER_ADMIN_PASSCODE = 'admin123'; // Secret Admin Master Passcode

export default function AdminPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [activeTab, setActiveTab] = useState<'BUY_QUEUE' | 'SELL_QUEUE' | 'MERCHANT_APPS' | 'CONFIG' | 'VAULT_STATS'>('BUY_QUEUE');
  const [buyOrders, setBuyOrders] = useState<PendingUpiOrder[]>([]);
  const [sellOrders, setSellOrders] = useState<PendingCashPayoutOrder[]>([]);
  const [merchantApps, setMerchantApps] = useState<MerchantApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Admin Config States
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
          },
          {
            id: 'ORD_9813B',
            userEmail: 'crypto.holder@gmail.com',
            walletAddress: 'Phan7K892B30d832F51892BCA',
            utrNumber: '423819088219',
            inrAmount: 4725,
            goldAmount: 5.0,
            usdtCost: 50.0,
            timestamp: new Date(Date.now() - 600000).toLocaleTimeString(),
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
    if (passwordInput === MASTER_ADMIN_PASSCODE || passwordInput === 'admin') {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Invalid Master Passcode! Access Denied.');
    }
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
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-emerald-500/10 blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        
        {/* Header Navigation */}
        <header className="flex flex-col sm:flex-row items-center justify-between py-4 border-b border-yellow-500/20 gap-4 backdrop-blur-md sticky top-0 z-40 bg-black/80 rounded-2xl px-6 border">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl bg-black/60 border border-zinc-800 hover:border-yellow-500/40 text-zinc-300 hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <VirtualGoldLogo size={42} />
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Standalone Master Admin Portal
            </span>
          </div>
        </header>

        {/* Passcode Security Screen */}
        {!isAuthenticated ? (
          <div className="max-w-md w-full mx-auto my-auto gold-glass-card p-8 border-gold-glow space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center shadow-lg shadow-yellow-500/10">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-wider">Master Sovereign Admin Authentication</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Enter your Master Passcode to access P2P rates, UPI settings, and order verification.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Master Passcode (Default: admin123)"
                  required
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-black/90 border border-yellow-500/40 text-center text-yellow-300 font-mono font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              {passwordError && (
                <div className="text-xs text-red-400 font-bold bg-red-500/10 p-2.5 rounded-xl border border-red-500/30">
                  {passwordError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Unlock Master Admin Dashboard
              </button>
            </form>
          </div>
        ) : (
          /* Master Authenticated Dashboard */
          <div className="space-y-6 animate-fade-in">
            
            {/* Dashboard Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Live P2P Rate</span>
                  <Activity className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <div className="text-2xl font-black text-yellow-400 font-mono">₹{p2pRateInput} INR</div>
              </div>

              <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Merchant UPI ID</span>
                  <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-base font-black text-emerald-400 font-mono truncate">{receiverUpiIdInput}</div>
              </div>

              <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Pending Buy Orders</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-cyan-400 font-mono">
                  {buyOrders.filter((o) => o.status === 'PENDING').length} Orders
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Pending Merchant Apps</span>
                  <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-400 font-mono">
                  {merchantApps.filter((a) => a.status === 'PENDING').length} Apps
                </div>
              </div>
            </div>

            {/* Main Tabs Container */}
            <div className="gold-glass-card p-6 border-gold-glow space-y-6">
              
              {/* Navigation Bar */}
              <div className="grid grid-cols-5 gap-2 p-1.5 rounded-xl bg-black/70 border border-zinc-800 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('BUY_QUEUE')}
                  className={`py-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'BUY_QUEUE'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-yellow-400" /> Buy Queue ({buyOrders.filter((o) => o.status === 'PENDING').length})
                </button>

                <button
                  onClick={() => setActiveTab('SELL_QUEUE')}
                  className={`py-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'SELL_QUEUE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Payout Queue ({sellOrders.filter((o) => o.status === 'PENDING').length})
                </button>

                <button
                  onClick={() => setActiveTab('MERCHANT_APPS')}
                  className={`py-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'MERCHANT_APPS'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-purple-400" /> Merchants ({merchantApps.filter((a) => a.status === 'PENDING').length})
                </button>

                <button
                  onClick={() => setActiveTab('CONFIG')}
                  className={`py-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'CONFIG'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 text-cyan-400" /> P2P Settings
                </button>

                <button
                  onClick={() => setActiveTab('VAULT_STATS')}
                  className={`py-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'VAULT_STATS'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-4 h-4 text-amber-400" /> Vault Analytics
                </button>
              </div>

              {/* TAB 1: BUY QUEUE */}
              {activeTab === 'BUY_QUEUE' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by 12-Digit UTR Number or User Email..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 font-mono"
                    />
                  </div>

                  <div className="w-full overflow-y-auto border border-zinc-800 rounded-xl bg-black/60 max-h-[450px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/90 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="p-3">User / Time</th>
                          <th className="p-3">12-Digit UTR</th>
                          <th className="p-3">Amount Received</th>
                          <th className="p-3">Gold to Mint</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {filteredBuyOrders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-zinc-500">
                              No pending UPI buy orders found for verification.
                            </td>
                          </tr>
                        ) : (
                          filteredBuyOrders.map((order) => (
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
                                <div className="text-[10px] text-zinc-500">${order.usdtCost.toFixed(2)} USDT</div>
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
                                    className="px-3.5 py-1.5 rounded-lg bg-gold-gradient text-black font-extrabold text-xs hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1 ml-auto"
                                  >
                                    {approvingId === order.id ? (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5" /> Approve & Mint
                                      </>
                                    )}
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

              {/* TAB 2: PAYOUT QUEUE */}
              {activeTab === 'SELL_QUEUE' && (
                <div className="space-y-4">
                  <div className="w-full overflow-y-auto border border-zinc-800 rounded-xl bg-black/60 max-h-[450px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/90 text-zinc-400 uppercase text-[10px] font-bold border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="p-3">Seller / Bank Details</th>
                          <th className="p-3">Gold Burned</th>
                          <th className="p-3">Cash Payout</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {sellOrders.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-zinc-500">
                              No pending cash payout requests found.
                            </td>
                          </tr>
                        ) : (
                          sellOrders.map((order) => (
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
                                <div className="text-[10px] text-zinc-500">${order.usdtPayout.toFixed(2)} USDT</div>
                              </td>
                              <td className="p-3 text-right">
                                {order.status === 'PAID' ? (
                                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                                    Paid & Settled ✅
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSettleSell(order.id)}
                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-md ml-auto"
                                  >
                                    Mark Cash Paid
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

              {/* TAB 3: MERCHANT APPLICATIONS QUEUE */}
              {activeTab === 'MERCHANT_APPS' && (
                <div className="space-y-4">
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
                              No P2P merchant applications submitted yet.
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
                                    Authorized Merchant ✅
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleApproveMerchant(app.id)}
                                    className="px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-black font-extrabold text-xs transition-all shadow-md ml-auto"
                                  >
                                    Approve Merchant
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

              {/* TAB 4: CONFIGURATION */}
              {activeTab === 'CONFIG' && (
                <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-6">
                  <h3 className="text-lg font-black text-gold-gradient uppercase flex items-center gap-2">
                    <Settings className="w-5 h-5 text-yellow-400" /> P2P Rates & Merchant UPI Settings
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-300">Live P2P USDT/INR Exchange Rate (1 USDT = ₹ INR):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={p2pRateInput}
                        onChange={(e) => setP2pRateInput(e.target.value)}
                        placeholder="e.g. 94.50"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-yellow-300 font-mono font-bold text-base focus:outline-none focus:border-yellow-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-300">Merchant Receiver UPI VPA ID (For GPay / PhonePe / QR):</label>
                      <input
                        type="text"
                        value={receiverUpiIdInput}
                        onChange={(e) => setReceiverUpiIdInput(e.target.value)}
                        placeholder="e.g. bunty@sbi or virtualgold@ybl"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-emerald-300 font-mono font-bold text-base focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    {isSavedNotice ? 'P2P Config Saved Successfully! ✅' : 'Save P2P Settings'}
                  </button>
                </form>
              )}

              {/* TAB 5: VAULT ANALYTICS */}
              {activeTab === 'VAULT_STATS' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-xs text-zinc-400 uppercase font-semibold">Smart Contract Reserve</div>
                    <div className="text-2xl font-black text-yellow-400 font-mono mt-1">$0.00 USDT</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-xs text-zinc-400 uppercase font-semibold">Circulating Supply</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono mt-1">0.00 Grams $GOLD</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-xs text-zinc-400 uppercase font-semibold">Base Genesis Price</div>
                    <div className="text-2xl font-black text-cyan-400 font-mono mt-1">$10.00 USDT / Gram</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-black/60 border border-yellow-500/30">
                    <div className="text-xs text-zinc-400 uppercase font-semibold">Monotonic Floor Price</div>
                    <div className="text-2xl font-black text-yellow-300 font-mono mt-1">$9.8000 USDT</div>
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
