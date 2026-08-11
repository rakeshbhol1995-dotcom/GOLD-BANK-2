'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
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
  Building
} from 'lucide-react';
import { setCustomP2pRate } from '@/services/exchangeRateService';
import { MerchantApplication } from './MerchantApplicationModal';

export interface PendingUpiOrder {
  id: string;
  userEmail: string;
  walletAddress: string;
  utrNumber: string;
  inrAmount: number;
  goldAmount: number;
  usdtCost: number;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface PendingCashPayoutOrder {
  id: string;
  userEmail: string;
  bankDetails: string;
  goldAmount: number;
  usdtPayout: number;
  inrPayout: number;
  timestamp: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
}

interface AdminApprovalDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproveOrder: (order: PendingUpiOrder) => void;
}

const DEFAULT_ADMIN_PIN = 'admin123'; // Default secret admin passcode

export default function AdminApprovalDashboardModal({
  isOpen,
  onClose,
  onApproveOrder
}: AdminApprovalDashboardModalProps) {
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
          }
        ];
        setBuyOrders(sampleBuyOrders);
      }

      const savedSell = localStorage.getItem('virtualgold_pending_sell_orders');
      if (savedSell) {
        setSellOrders(JSON.parse(savedSell));
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
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === DEFAULT_ADMIN_PIN || passwordInput === 'admin') {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Invalid Secret Passcode! Access Denied.');
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
      onApproveOrder(order);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 flex flex-col max-h-[92vh]">
        
        {/* Close Button */}
        <button
          onClick={() => {
            setIsAuthenticated(false);
            setPasswordInput('');
            onClose();
          }}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Secret Admin Authentication Guard Screen */}
        {!isAuthenticated ? (
          <div className="py-10 space-y-6 text-center max-w-md mx-auto my-auto animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center shadow-lg shadow-yellow-500/10">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">Restricted Sovereign Admin Portal</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Enter your Secret Admin Passcode to unlock P2P Merchant Approvals and Rates.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter Admin Secret Passcode (Default: admin123)"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/90 border border-yellow-500/40 text-center text-yellow-300 font-mono font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              {passwordError && (
                <div className="text-xs text-red-400 font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/30">
                  {passwordError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Authenticate & Unlock Admin Panel
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Authenticated Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-yellow-500/20 pb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> SOVEREIGN PROTOCOL ADMIN CONTROL DASHBOARD
                </div>
                <h2 className="text-2xl font-black text-white mt-1">Merchant P2P & Reserve Management</h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-mono font-bold">
                  1 USDT = ₹{p2pRateInput} INR
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                  UPI: {receiverUpiIdInput}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-black/70 border border-zinc-800 text-[11px] font-bold">
              <button
                onClick={() => setActiveTab('BUY_QUEUE')}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'BUY_QUEUE'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-yellow-400" /> Buy Queue ({buyOrders.filter((o) => o.status === 'PENDING').length})
              </button>

              <button
                onClick={() => setActiveTab('SELL_QUEUE')}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'SELL_QUEUE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Payouts ({sellOrders.filter((o) => o.status === 'PENDING').length})
              </button>

              <button
                onClick={() => setActiveTab('MERCHANT_APPS')}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'MERCHANT_APPS'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-purple-400" /> Merchants ({merchantApps.filter((a) => a.status === 'PENDING').length})
              </button>

              <button
                onClick={() => setActiveTab('CONFIG')}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'CONFIG'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-cyan-400" /> Config
              </button>

              <button
                onClick={() => setActiveTab('VAULT_STATS')}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'VAULT_STATS'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Vault Stats
              </button>
            </div>

            {/* TAB 1: BUY VERIFICATION QUEUE */}
            {activeTab === 'BUY_QUEUE' && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
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

                <div className="w-full flex-1 overflow-y-auto border border-zinc-800 rounded-xl bg-black/60">
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
                            No pending UPI buy orders found.
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
                              <span className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold">
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
                                  className="px-3 py-1.5 rounded-lg bg-gold-gradient text-black font-extrabold text-xs hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1 ml-auto"
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

            {/* TAB 2: CASH PAYOUT QUEUE */}
            {activeTab === 'SELL_QUEUE' && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="w-full flex-1 overflow-y-auto border border-zinc-800 rounded-xl bg-black/60">
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
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-md ml-auto"
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
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="w-full flex-1 overflow-y-auto border border-zinc-800 rounded-xl bg-black/60">
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
                                  className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-black font-extrabold text-xs transition-all shadow-md ml-auto"
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

            {/* TAB 4: P2P CONFIGURATION */}
            {activeTab === 'CONFIG' && (
              <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-6">
                <h3 className="text-lg font-black text-gold-gradient uppercase flex items-center gap-2">
                  <Settings className="w-5 h-5 text-yellow-400" /> Merchant P2P Configuration Settings
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

            {/* TAB 5: VAULT STATS */}
            {activeTab === 'VAULT_STATS' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Smart Contract Reserve</div>
                  <div className="text-xl font-black text-yellow-400 font-mono mt-1">$0.00 USDT</div>
                </div>
                <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Circulating Supply</div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">0.00 Grams $GOLD</div>
                </div>
                <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Base Genesis Price</div>
                  <div className="text-xl font-black text-cyan-400 font-mono mt-1">$10.00 USDT / Gram</div>
                </div>
                <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Monotonic Floor Price</div>
                  <div className="text-xl font-black text-yellow-300 font-mono mt-1">$9.8000 USDT</div>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
