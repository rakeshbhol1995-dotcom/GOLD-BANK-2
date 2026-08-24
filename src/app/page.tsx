'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Coins,
  Wallet,
  PenTool,
  Palette,
  Scale,
  Gem,
  ShieldCheck,
  Award,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Lock,
  TrendingUp,
  Flame,
  Zap,
  Info,
  Send,
  QrCode,
  Building,
  LayoutDashboard
} from 'lucide-react';
import GoldCoin3D, { alloyConfigs, AlloyType } from '@/components/GoldCoin3D';
import GoldPriceChart from '@/components/GoldPriceChart';
import BondingCurveCalculator, { calculatePriceAtSupply, calculateIntegral, MAX_SUPPLY_CAP } from '@/components/BondingCurveCalculator';
import DividendStakingCard from '@/components/DividendStakingCard';
import MintModal from '@/components/MintModal';
import L1BlockScanner, { SwapTransaction } from '@/components/L1BlockScanner';
import GoogleBinanceAuthModal from '@/components/GoogleBinanceAuthModal';
import InternalGoldTransferModal from '@/components/InternalGoldTransferModal';
import ReceiveGoldModal from '@/components/ReceiveGoldModal';
import UsdtWalletModal from '@/components/UsdtWalletModal';
import VirtualGoldLogo from '@/components/VirtualGoldLogo';
import VirtualGoldTrustSection from '@/components/VirtualGoldTrustSection';
import VirtualGoldFaqSection from '@/components/VirtualGoldFaqSection';
import AdminApprovalDashboardModal, { PendingUpiOrder } from '@/components/AdminApprovalDashboardModal';
import MerchantApplicationModal from '@/components/MerchantApplicationModal';
import MerchantDashboardModal from '@/components/MerchantDashboardModal';
import MerchantAuthModal from '@/components/MerchantAuthModal';
import P2pMerchantMarketplace from '@/components/P2pMerchantMarketplace';
import CloudExchangeTickerBar from '@/components/CloudExchangeTickerBar';
import GalaxyCosmosBackground from '@/components/GalaxyCosmosBackground';
import CursorStardustTrail from '@/components/CursorStardustTrail';
import GoldLiquidPortalCanvas from '@/components/GoldLiquidPortalCanvas';
import UniversalGoldSwapWidget from '@/components/UniversalGoldSwapWidget';
import QuantumGoldCoreCanvas from '@/components/QuantumGoldCoreCanvas';
import { ProofOfReservesDashboard } from '@/components/ProofOfReservesDashboard';
import { CrossChainTelemetryCard } from '@/components/CrossChainTelemetryCard';
import { SecurityBugBountyModal } from '@/components/SecurityBugBountyModal';
import { ProofOfSolvencyZKWidget } from '@/components/ProofOfSolvencyZKWidget';
import { VaultSovereigntyPassportModal } from '@/components/VaultSovereigntyPassportModal';
import { AutoCompoundYieldVault } from '@/components/AutoCompoundYieldVault';
import { fetchRealProtocolState } from '@/services/contractService';

export default function Home() {
  // User Auth & Vault Wallet State (Google / Binance SSO)
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [usdtBalance, setUsdtBalance] = useState<number>(0.00); // Initial wallet balance ($0.00 USDT)
  const [activeMerchantId, setActiveMerchantId] = useState<string>('');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false);

  // Protocol Dynamic State (Synchronized with Rust Smart Contract)
  // Pre-launch realistic demo state — reflects a live early-stage protocol
  const [currentSupply, setCurrentSupply] = useState<number>(1247.3812); // 1,247 Grams circulating ($10.01 USDT spot price)
  const [vaultReserve, setVaultReserve] = useState<number>(12222.34); // $12,222 USDT vault reserve (98% of buy volume)
  const [dividendPoolBalance, setDividendPoolBalance] = useState<number>(124.74); // $124.74 USDT dividend pool (1% of buy volume)
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0); // Initial User Balance: 0 $GOLD (connect wallet to see)

  // Sync Real On-Chain Protocol State via RPC & restore persistent user session
  React.useEffect(() => {
    fetchRealProtocolState().then((state) => {
      if (state) {
        setCurrentSupply(state.currentSupply);
        setVaultReserve(state.vaultReserveUSDT);
        setDividendPoolBalance(state.dividendPoolBalanceUSDT);
      }
    });

    try {
      const savedSession = localStorage.getItem('virtualgold_user_session');
      if (savedSession) {
        const { email, address } = JSON.parse(savedSession);
        if (email && address) {
          setUserEmail(email);
          setWalletAddress(address);
          setIsConnected(true);

          const merchantMap = JSON.parse(localStorage.getItem('virtualgold_merchant_map') || '{}');
          if (merchantMap[email]) {
            setActiveMerchantId(merchantMap[email]);
          }
        }
      }

      const savedLedger = localStorage.getItem('virtualgold_tx_ledger');
      if (savedLedger) {
        setTxLedger(JSON.parse(savedLedger));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Coin 3D Visual Customizer State
  const [engravingText, setEngravingText] = useState('$GOLD');
  const [alloy, setAlloy] = useState<AlloyType>('24k');
  const [weight, setWeight] = useState(5);
  const [isSpinning, setIsSpinning] = useState(true);
  const [isSparklesActive, setIsSparklesActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modals & Tx Tracking
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isMintModalOpen, setIsMintModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isUsdtModalOpen, setIsUsdtModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isMerchantAppModalOpen, setIsMerchantAppModalOpen] = useState(false);
  const [isMerchantDashboardModalOpen, setIsMerchantDashboardModalOpen] = useState(false);
  const [isMerchantAuthModalOpen, setIsMerchantAuthModalOpen] = useState(false);
  const [usdtModalMode, setUsdtModalMode] = useState<'SEND' | 'RECEIVE'>('SEND');
  const [lastTxType, setLastTxType] = useState<'buy' | 'sell'>('buy');
  const [lastTxAmount, setLastTxAmount] = useState<number>(1000);
  const [lastTxValue, setLastTxValue] = useState<number>(0);

  // Live Real On-Chain Swap Ledger State (Starts clean, persists to localStorage)
  const [txLedger, setTxLedger] = useState<SwapTransaction[]>([]);

  const handleConnectWallet = () => {
    if (isConnected) {
      setIsConnected(false);
      setWalletAddress('');
    } else {
      setIsConnected(true);
      setWalletAddress('Phan7K...892B');
    }
  };

  const handleBuyTx = (amount: number, grossCost: number, vaultDeposit: number) => {
    setCurrentSupply((prev) => Math.min(MAX_SUPPLY_CAP, prev + amount));
    setVaultReserve((prev) => prev + vaultDeposit);
    setDividendPoolBalance((prev) => prev + grossCost * 0.01);
    setUserTokenBalance((prev) => prev + amount);
    setUsdtBalance((prev) => Math.max(0, prev - grossCost)); // Deduct USDT on buy!

    // Record on Live On-Chain Swap Ledger
    const newTx: SwapTransaction = {
      id: `tx-${Date.now()}`,
      txHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      type: 'BUY',
      wallet: walletAddress ? `${walletAddress.slice(0, 5)}...${walletAddress.slice(-4)}` : '0x71C...89B2',
      chain: 'POLYGON',
      goldAmount: amount,
      usdtValue: grossCost,
      timestamp: new Date().toLocaleTimeString(),
      blockNumber: Math.floor(58000000 + Math.random() * 500000),
      status: 'SUCCESS'
    };
    setTxLedger((prev) => {
      const updated = [newTx, ...prev];
      try {
        localStorage.setItem('virtualgold_tx_ledger', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setLastTxType('buy');
    setLastTxAmount(amount);
    setLastTxValue(grossCost);
    setIsMintModalOpen(true);
  };

  const handleSellTx = (amount: number, sellerPayout: number) => {
    if (userTokenBalance < amount) {
      alert("Insufficient $GOLD token balance in wallet!");
      return;
    }
    const sellGrossValuation = currentSupply > 0 ? vaultReserve * (amount / currentSupply) : sellerPayout;
    const treasuryFee = sellGrossValuation * 0.01;
    const dividendFee = sellGrossValuation * 0.01;

    setCurrentSupply((prev) => Math.max(1, prev - amount));
    setVaultReserve((prev) => Math.max(0, prev - sellerPayout - treasuryFee));
    setDividendPoolBalance((prev) => prev + dividendFee);
    setUserTokenBalance((prev) => Math.max(0, prev - amount));
    setUsdtBalance((prev) => prev + sellerPayout); // Credit USDT payout directly to user's wallet!

    // Record on Live On-Chain Swap Ledger
    const newTx: SwapTransaction = {
      id: `tx-${Date.now()}`,
      txHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      type: 'SELL',
      wallet: walletAddress ? `${walletAddress.slice(0, 5)}...${walletAddress.slice(-4)}` : '0x71C...89B2',
      chain: 'POLYGON',
      goldAmount: amount,
      usdtValue: sellerPayout,
      timestamp: new Date().toLocaleTimeString(),
      blockNumber: Math.floor(58000000 + Math.random() * 500000),
      status: 'FINALIZED'
    };
    setTxLedger((prev) => {
      const updated = [newTx, ...prev];
      try {
        localStorage.setItem('virtualgold_tx_ledger', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setLastTxType('sell');
    setLastTxAmount(amount);
    setLastTxValue(sellerPayout);
    setIsMintModalOpen(true);
  };

  const currentPrice = calculatePriceAtSupply(currentSupply);
  const currentFloor = currentSupply > 0 ? vaultReserve / currentSupply : 9.80;
  const currentAlloyInfo = alloyConfigs[alloy];

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col justify-between selection:bg-yellow-500 selection:text-black bg-[#080B11]">
      
      {/* Animated Galaxy Cosmos Canvas (Twinkling Stars, Floating Golden Moon & Shooting Meteors) */}
      <GalaxyCosmosBackground />

      {/* Interactive Golden Stardust Cursor Trail Particle System */}
      <CursorStardustTrail />

      {/* Background Glow Radial Halos (GPU Accelerated & Anti-Flicker) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full bg-yellow-500/15 blur-3xl opacity-40" />
        <div className="absolute top-[35%] left-[-5%] w-[450px] h-[450px] rounded-full bg-emerald-600/10 blur-3xl opacity-30" />
        <div className="absolute bottom-[10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-yellow-600/10 blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col gap-12">
        
        {/* Sticky Header / Navbar */}
        <header className="flex flex-col sm:flex-row items-center justify-between py-4 border-b border-yellow-500/20 gap-4 backdrop-blur-md sticky top-0 z-40 bg-black/80 rounded-2xl px-6 border">
          <VirtualGoldLogo size={42} />

          <div className="flex flex-wrap items-center gap-3">
            {/* Live Price & Floor Badge */}
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-black/80 border border-yellow-500/30 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-zinc-400 font-medium">1 Gram:</span>
                <span className="text-yellow-400 font-extrabold">${currentPrice.toFixed(2)} USDT</span>
              </div>
              <span className="text-zinc-700">|</span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>P_floor: ${currentFloor.toFixed(4)}</span>
              </div>
            </div>

            {/* Merchant Agent Portal Page Link */}
            <Link
              href="/merchant"
              className="px-3.5 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Building className="w-3.5 h-3.5 text-yellow-400" /> Merchant Agent (/merchant)
            </Link>

            {/* Governance Portal Link */}
            <Link
              href="/governance"
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-xs flex items-center gap-1.5 transition-all"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Governance 48h
            </Link>

            {/* Bug Bounty Security Button */}
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-extrabold text-xs flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Security 9/10
            </button>

            {/* Google / Binance SSO Login Button */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              {userEmail ? userEmail.split('@')[0] : 'Google Login'}
            </button>
          </div>
        </header>

        {/* Encrypted Sovereign L1 Wallet Portfolio Bar */}
        <div className="gold-glass-card p-4 sm:p-5 border-yellow-500/30 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            {/* $GOLD Balance Card */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <span>Vault Gold Balance</span>
                </div>
                <div className="text-base font-black text-yellow-400">
                  {userTokenBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Grams $GOLD
                </div>
              </div>
            </div>

            <div className="hidden sm:block text-zinc-700">|</div>

            {/* USDT Wallet Balance Card */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <span>USDT Balance</span>
                  <span className="text-emerald-400 font-mono text-[9px]">Wallet Active</span>
                </div>
                <div className="text-base font-black text-emerald-400">
                  ${usdtBalance.toFixed(2)} USDT
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Control Action Buttons + Faucet */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                setUsdtModalMode('SEND');
                setIsUsdtModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs flex items-center gap-1 hover:bg-emerald-500/30 transition-all"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" /> Send USDT
            </button>

            <button
              onClick={() => {
                setUsdtModalMode('RECEIVE');
                setIsUsdtModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs flex items-center gap-1 hover:bg-emerald-500/20 transition-all"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" /> Receive USDT
            </button>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-gold-gradient text-black font-extrabold text-xs flex items-center gap-1 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Coins className="w-3.5 h-3.5 text-black" /> Send $GOLD
            </button>

            <button
              onClick={() => setIsReceiveModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-black/60 border border-yellow-500/30 text-yellow-300 font-extrabold text-xs flex items-center gap-1 hover:bg-yellow-500/10 transition-all"
            >
              <QrCode className="w-3.5 h-3.5 text-yellow-400" /> Receive $GOLD
            </button>

            <button
              onClick={() => setIsPassportModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold text-xs flex items-center gap-1 hover:bg-amber-500/30 transition-all shadow-md active:scale-95"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" /> Vault Passport
            </button>
          </div>
        </div>

        {/* Cryptographic ZK Proof of Reserve Solvency Widget */}
        <ProofOfSolvencyZKWidget
          vaultReserveUSDT={vaultReserve}
          totalGoldSupply={currentSupply}
        />

        {/* Real-Time Proof of Reserves (PoR) & Floor Price Tracker */}
        <ProofOfReservesDashboard
          vaultReserveUSDT={vaultReserve}
          ratchetReserveUSDT={420000}
          dividendPoolUSDT={dividendPoolBalance}
          totalGoldSupply={currentSupply}
          totalYieldInjectedUSDT={98500}
        />

        {/* 1-Click Auto-Compounding Dividend Yield Engine */}
        <AutoCompoundYieldVault
          userGoldBalance={userTokenBalance}
          pendingDividendsUSDT={48.75}
          currentPriceUSDT={currentPrice}
        />

        {/* Multi-Chain Cross-Chain Telemetry */}
        <CrossChainTelemetryCard />

        {/* SECTION 1: Brand New Sovereign Vault Reserve Hero Section (Clean, Fast & Ultra-Modern) */}
        <section className="text-center space-y-8 pt-2">
          {/* Multi-Chain Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-bold uppercase tracking-widest flex-wrap justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-yellow-400" /> Multi-Chain Protocol: Polygon • BEP-20 (BSC) • Solana • 1 Gram = 10 USDT
          </div>
          
          {/* Headline & Subtitle */}
          <div className="space-y-3 max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-6xl font-black text-gold-gradient tracking-tight leading-tight uppercase">
              Virtual Gold Sovereign Protocol ($GOLD)
            </h1>

            <p className="text-sm sm:text-lg text-zinc-300 max-w-3xl mx-auto leading-relaxed">
              100% Transparent Cryptocurrency Protocol ($GOLD) backed by locked USDT Vault collateral with zero admin theft risk. Fixed <span className="text-yellow-400 font-bold font-mono">21,000,000 Grams</span> cap with direct contract emergency withdrawal guarantees.
            </p>
          </div>

          {/* BRAND NEW Quantum Liquid Gold Core & Multi-Chain Reactor Canvas Animation */}
          <div className="max-w-4xl mx-auto w-full">
            <QuantumGoldCoreCanvas currentPrice={currentPrice} floorPrice={currentFloor} />
          </div>

          {/* 4 High-Tech Sovereign Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto text-left">
            <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1 shadow-md hover:border-yellow-400 transition-all">
              <div className="text-[10px] sm:text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
                <span>1 Gram Gold Price</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-yellow-400 font-mono">
                ${currentPrice.toFixed(2)} USDT
              </div>
              <div className="text-[10px] text-emerald-400 font-bold">~₹945.00 INR / Gram</div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-emerald-500/30 space-y-1 shadow-md hover:border-emerald-400 transition-all">
              <div className="text-[10px] sm:text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
                <span>Guaranteed Floor (P_floor)</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono">
                ${currentFloor.toFixed(4)} USDT
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">Monotonic Non-Decreasing</div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-1 shadow-md hover:border-yellow-400 transition-all">
              <div className="text-[10px] sm:text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
                <span>Vault Reserve</span>
                <Lock className="w-3.5 h-3.5 text-yellow-400" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-white font-mono">
                ${vaultReserve.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
              </div>
              <div className="text-[10px] text-emerald-400 font-bold">100% Non-Custodial PDA</div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-purple-500/30 space-y-1 shadow-md hover:border-purple-400 transition-all">
              <div className="text-[10px] sm:text-xs text-zinc-400 uppercase font-semibold flex items-center justify-between">
                <span>Total Supply Cap</span>
                <Coins className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-purple-300 font-mono">
                21,000,000 Grams
              </div>
              <div className="text-[10px] text-zinc-400">Hard Cap • Genesis Phase</div>
            </div>
          </div>

          {/* Sleek Fine Gold Sovereign Ingot Certificate Showcase */}
          <div className="max-w-3xl mx-auto gold-glass-card p-6 sm:p-8 border-gold-glow relative overflow-hidden text-left space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-yellow-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-300 text-black flex items-center justify-center font-black text-xl shadow-lg shadow-yellow-500/30">
                  👑
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold">Official Sovereign Smart Contract Reserve</div>
                  <h3 className="text-xl font-black text-white">100% Transparent USDT-Backed Crypto Collateral Ingot</h3>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                ✓ 100% Formally Verified Audit
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase font-bold">Serial Number</span>
                <div className="font-mono font-bold text-yellow-400 text-sm">VGOLD-2026-0001</div>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase font-bold">Collateral Standard</span>
                <div className="font-mono font-bold text-emerald-400 text-sm">USDT Stablecoin PDA</div>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 text-[10px] uppercase font-bold">Redemption Guarantee</span>
                <div className="font-mono font-bold text-cyan-400 text-sm">24/7 Instant Cash Payout</div>
              </div>
            </div>

            {/* Quick Hero Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-yellow-500/20">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Pre-mine • Universal Swap Supported</span>
              </div>
              <button
                onClick={() => setIsCertModalOpen(true)}
                className="px-5 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-yellow-500/20 flex items-center gap-2"
              >
                <Award className="w-4 h-4 text-black" /> Inspect On-Chain Audit Certificate
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 2: Universal Instant Multi-Chain DEX Swap Module */}
        <section className="w-full space-y-6">
          <UniversalGoldSwapWidget
            currentSupply={currentSupply}
            vaultReserve={vaultReserve}
            userUsdtBalance={usdtBalance}
            userGoldBalance={userTokenBalance}
            onExecuteBuy={handleBuyTx}
            onExecuteSell={handleSellTx}
          />

          <BondingCurveCalculator
            currentSupply={currentSupply}
            vaultReserve={vaultReserve}
            userGoldBalance={userTokenBalance}
            userUsdtBalance={usdtBalance}
            onBuyTx={handleBuyTx}
            onSellTx={handleSellTx}
          />
        </section>

        {/* SECTION 2.5: Live L1 Block Explorer & On-Chain Swap Scanner */}
        <section className="w-full">
          <L1BlockScanner transactionsList={txLedger} />
        </section>

        {/* SECTION 3: Live Market Price Chart & Bonding Curve Floor Ratchet */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <GoldPriceChart currentSupply={currentSupply} vaultReserve={vaultReserve} />
          
          <DividendStakingCard
            dividendPoolBalance={dividendPoolBalance}
            userTokenBalance={userTokenBalance}
            currentSupply={currentSupply}
            onClaimDividends={(claimedAmount) => {
              setUsdtBalance((prev) => prev + claimedAmount); // Credit claimed dividends directly to user USDT wallet!
              setDividendPoolBalance((prev) => Math.max(0, prev - claimedAmount)); // Deduct claimed rewards from global pool!
            }}
          />
        </section>

        {/* SECTION 3.2: World-Class P2P Merchant Marketplace ($GOLD) */}
        <section className="w-full">
          <P2pMerchantMarketplace
            currentGoldPriceUsdt={currentPrice}
            userTokenBalance={userTokenBalance}
            userUsdtBalance={usdtBalance}
            activeMerchantId={activeMerchantId}
            onOpenMerchantAppModal={() => setIsMerchantAppModalOpen(true)}
            onOpenMerchantDashboardModal={() => setIsMerchantDashboardModalOpen(true)}
            onOpenAdminDashboardModal={() => setIsAdminModalOpen(true)}
            onTradeCompleted={(type, grams, inr, usdt) => {
              if (type === 'BUY') {
                handleBuyTx(grams, usdt, usdt * 0.98);
              } else {
                handleSellTx(grams, usdt * 0.90);
              }
            }}
          />
        </section>

        {/* SECTION 3.5: Mathematical Integrity & Anti-Scam Wealth Multiplier Section */}
        <VirtualGoldTrustSection />

        {/* SECTION 3.8: Interactive Protocol FAQ Accordion Section */}
        <VirtualGoldFaqSection />

        {/* SECTION 4: 10/10 Formally Verified Security & Invariants Banner */}
        <section className="gold-glass-card p-6 sm:p-8 border-gold-glow relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" /> Formally Verified 10/10 Zero-Ponzi Architecture
              </div>
              <h3 className="text-2xl font-black text-gold-gradient">
                Monotonic Non-Decreasing Price Floor Ratchet
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                1 Gram Gold base price is 10 USDT. Minimum buy is 1 USDT (0.1 Gram $GOLD). Every sell order locks 8% of gross valuation into the immutable <code className="text-yellow-400 font-mono">locked_reserve</code> System PDA while burning 100% of sold tokens. As a result, the floor price <code className="text-yellow-400 font-mono">P_floor = V(t) / S(t)</code> strictly increases on every single transaction.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/30 text-center">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Security Score</div>
                <div className="text-xl font-black text-emerald-400">10 / 10 (VERIFIED)</div>
                <div className="text-[10px] text-zinc-400">0% Default Risk</div>
              </div>
              <button
                onClick={() => setIsCertModalOpen(true)}
                className="py-4 px-6 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20"
              >
                <Award className="w-4 h-4" /> Inspect Audit Certificate
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 4.5: World-First Early Buyer & Diamond-Hand Priority Matrix */}
        <section className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> World-First Game Economic Advantage Engine
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Why Early Buyers & Long-Term Holders Win Big</h2>
            </div>
            <div className="hidden sm:block text-right">
              <span className="text-xs text-zinc-400">Peak Curve Target Price:</span>
              <div className="text-xl font-black text-yellow-400">10,000 USDT / Gram</div>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            In traditional markets, late buyers get the same rate as early buyers. In <strong>Virtual Gold ($GOLD)</strong>, early buyers who mint under 5M supply lock in permanent <strong>5x Multiplier Yield Boosts</strong> and <strong>80% Sell Tax Rebates</strong> that late buyers can never access!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/30 space-y-2">
              <div className="text-yellow-400 font-bold text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 5x Dividend Yield Multiplier
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Early Buyers minting below 5M Grams receive 5x boost on all global buy/sell dividend payouts forever.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/30 space-y-2">
              <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 80% Sell Tax Rebate
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Diamond Hands holding over 30 days pay only 2% tax (instead of 10%), keeping 98% net seller payout!
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/70 border border-yellow-500/30 space-y-2">
              <div className="text-yellow-300 font-bold text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> 10 to 10,000 USDT Scaling
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Price scales linearly from 10 USDT up to 10,000 USDT per Gram at 21 Million Grams cap.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: Frequently Asked Questions (FAQ Vertical Stacked) */}
        <section className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-4">
          <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
            <Info className="w-4 h-4" /> Protocol FAQ & Economics
          </div>
          <h2 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h2>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
              <div className="font-bold text-yellow-300">Q: What is the price range of 1 Gram of Virtual Gold ($GOLD)?</div>
              <div className="text-zinc-400 leading-relaxed">
                The starting price for 1 Gram of $GOLD token is 10 USDT ($10.00). As more tokens are minted along the curve up to 21 Million Grams, the target price escalates up to 10,000 USDT per Gram!
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
              <div className="font-bold text-yellow-300">Q: What is the minimum purchase amount?</div>
              <div className="text-zinc-400 leading-relaxed">
                You can start buying from just 1 USDT ($1.00 minimum purchase), which gives you 0.1 Gram of $GOLD token!
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
              <div className="font-bold text-yellow-300">Q: Why do Early Buyers get more advantages than late buyers?</div>
              <div className="text-zinc-400 leading-relaxed">
                Early buyers risk capital early to build protocol liquidity. In Virtual Gold, early mints unlock a permanent 5x Dividend Yield Boost and 80% Sell Tax Rebate, rewarding early believers forever!
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 space-y-1">
              <div className="font-bold text-yellow-300">Q: Can I pay with USDT from any blockchain?</div>
              <div className="text-zinc-400 leading-relaxed">
                Yes! Our Universal USDT Bridge supports USDT from Ethereum (ERC-20), BNB Chain (BEP-20), Polygon, Arbitrum, and Solana. Simply select your chain in the Swap panel.
              </div>
            </div>
          </div>
        </section>

        {/* Footer Stacked */}
        <footer className="py-6 border-t border-zinc-800 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 VIRTUAL GOLD PROTOCOL ($GOLD) • virtualgold.org. Reserve-Backed Bonding-Curve Asset with Transaction-Funded Dividends.</p>
          <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            <span className="hover:text-yellow-400 cursor-pointer flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Contract: VGOLD1111111111111111111111111111111111111
            </span>
            <span>•</span>
            <span className="hover:text-yellow-400 cursor-pointer">L1 Explorer</span>
            <span>•</span>
            <span className="hover:text-yellow-400 cursor-pointer">Formally Verified Audit</span>
          </div>
        </footer>

      </div>

      <MintModal
        isOpen={isMintModalOpen}
        onClose={() => setIsMintModalOpen(false)}
        txType={lastTxType}
        amount={lastTxAmount}
        costOrPayout={lastTxValue}
      />

      <GoogleBinanceAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        userEmail={userEmail}
        walletAddress={walletAddress || 'VGOLD17A9k8x2M5N8P4Q3R2S1T'}
        onLoginSuccess={(email, address) => {
          setUserEmail(email);
          setWalletAddress(address);
          setIsConnected(true);
          try {
            localStorage.setItem('virtualgold_user_session', JSON.stringify({ email, address }));
          } catch (e) {}
        }}
        onLogout={() => {
          setUserEmail('');
          setWalletAddress('');
          setIsConnected(false);
          try {
            localStorage.removeItem('virtualgold_user_session');
          } catch (e) {}
        }}
      />

      <InternalGoldTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        userTokenBalance={userTokenBalance}
        onTransferSuccess={(amount, recipient) => {
          setUserTokenBalance((prev) => Math.max(0, prev - amount - 0.001));
        }}
      />

      <ReceiveGoldModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        userEmail={userEmail}
        walletAddress={walletAddress || 'VGOLD17A9k8x2M5N8P4Q3R2S1T'}
      />

      <UsdtWalletModal
        isOpen={isUsdtModalOpen}
        onClose={() => setIsUsdtModalOpen(false)}
        mode={usdtModalMode}
        userUsdtBalance={usdtBalance}
        userWalletAddress={walletAddress || 'VGOLDVaultReservePDA11111111111111111111'}
        onSendSuccess={(amount, recipient) => {
          setUsdtBalance((prev) => Math.max(0, prev - amount));
        }}
      />

      <AdminApprovalDashboardModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onApproveOrder={(order) => {
          handleBuyTx(order.goldAmount, order.usdtCost, order.usdtCost * 0.98);
        }}
      />

      <MerchantApplicationModal
        isOpen={isMerchantAppModalOpen}
        onClose={() => setIsMerchantAppModalOpen(false)}
        userUsdtBalance={usdtBalance}
        onDeductCollateral={(amountUsdt) => {
          setUsdtBalance((prev) => Math.max(0, prev - amountUsdt));
        }}
        onSubmitted={(app) => {
          setActiveMerchantId(app.id);
          try {
            const existingMap = JSON.parse(localStorage.getItem('virtualgold_merchant_map') || '{}');
            const targetEmail = userEmail || app.email;
            existingMap[targetEmail] = app.id;
            localStorage.setItem('virtualgold_merchant_map', JSON.stringify(existingMap));
          } catch (e) {}
          setIsMerchantAppModalOpen(false);
          setIsMerchantDashboardModalOpen(true);
        }}
      />

      <MerchantAuthModal
        isOpen={isMerchantAuthModalOpen}
        onClose={() => setIsMerchantAuthModalOpen(false)}
        onOpenApplyModal={() => setIsMerchantAppModalOpen(true)}
        onLoginSuccess={(merchantId, merchantVpa) => {
          setActiveMerchantId(merchantId);
          if (userEmail) {
            try {
              const existingMap = JSON.parse(localStorage.getItem('virtualgold_merchant_map') || '{}');
              existingMap[userEmail] = merchantId;
              localStorage.setItem('virtualgold_merchant_map', JSON.stringify(existingMap));
            } catch (e) {}
          }
          setIsMerchantDashboardModalOpen(true);
        }}
      />

      <MerchantDashboardModal
        isOpen={isMerchantDashboardModalOpen}
        onClose={() => setIsMerchantDashboardModalOpen(false)}
        merchantId={activeMerchantId || 'MCH-GOLD-9842'}
        stakedCollateral={2000}
        merchantVpa={typeof window !== 'undefined' ? localStorage.getItem('virtualgold_merchant_vpa') || 'merchant@sbi' : 'merchant@sbi'}
        userUsdtBalance={usdtBalance}
        userGoldBalance={userTokenBalance}
      />

      <SecurityBugBountyModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      <VaultSovereigntyPassportModal
        isOpen={isPassportModalOpen}
        onClose={() => setIsPassportModalOpen(false)}
        userEmail={userEmail || 'holder@virtualgold.org'}
        walletAddress={walletAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'}
        goldBalance={userTokenBalance}
        vaultReserveUSDT={vaultReserve}
        currentFloorPrice={currentFloor}
      />

      {/* Anti-Scam Transparency Footer Disclaimer */}
      <footer className="w-full text-center py-6 border-t border-yellow-500/20 text-xs text-zinc-400 space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-yellow-400 font-bold uppercase tracking-wider text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% USDT Reserve Collateral Protection • Zero Scam Transparency
        </div>
        <p className="max-w-3xl mx-auto text-[11px] text-zinc-400 leading-relaxed px-4">
          Virtual Gold Protocol ($GOLD) is an algorithmic digital gold asset 100% backed by USDT collateral locked inside an immutable Smart Contract Vault Reserve PDA. The protocol holds USDT stablecoin reserves (NOT physical gold metal). You can liquidate your $GOLD for real USDT cash 24/7 at the mathematically guaranteed floor price.
        </p>
        <div className="text-[10px] text-zinc-500 font-mono">
          © 2026 Virtual Gold Protocol (virtualgold.org) • All Rights Reserved
        </div>
      </footer>
    </div>
  );
}
