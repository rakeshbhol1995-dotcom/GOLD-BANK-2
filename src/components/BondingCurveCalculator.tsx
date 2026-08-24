'use client';

import React, { useState } from 'react';
import { Calculator, ArrowRight, ShieldCheck, Flame, TrendingUp, Sparkles, AlertCircle, Smartphone, CreditCard, Zap, Landmark, Wallet } from 'lucide-react';
import FiatUpiGatewayModal from './FiatUpiGatewayModal';
import SellCashPayoutModal from './SellCashPayoutModal';
import Web3UsdtTransferModal from './Web3UsdtTransferModal';
import { getLiveUsdtInrRate } from '@/services/exchangeRateService';

export const TOKEN_DECIMALS = 1_000_000; // 6 Decimals for USDT & $GOLD
export const MAX_SUPPLY_CAP = 21_000_000; // 21 Million Grams Total Supply Cap
export const BASE_PRICE_P0 = 10; // $10.00 USDT Base Price
export const TARGET_PRICE_P1 = 10_000; // $10,000.00 USDT Peak Target Price

export function calculatePriceAtSupply(supply: number): number {
  if (supply <= 0) return BASE_PRICE_P0;
  if (supply >= MAX_SUPPLY_CAP) return TARGET_PRICE_P1;
  return BASE_PRICE_P0 + ((TARGET_PRICE_P1 - BASE_PRICE_P0) / MAX_SUPPLY_CAP) * supply;
}

export function calculateIntegral(sStart: number, sEnd: number): number {
  if (sStart >= sEnd) return 0;
  const pStart = calculatePriceAtSupply(sStart);
  const pEnd = calculatePriceAtSupply(sEnd);
  return ((pStart + pEnd) / 2) * (sEnd - sStart);
}

interface BondingCurveCalculatorProps {
  currentSupply: number;
  vaultReserve: number;
  userGoldBalance?: number;
  userUsdtBalance?: number;
  onBuyTx: (amount: number, grossCost: number, vaultDeposit: number) => void;
  onSellTx: (amount: number, sellerPayout: number) => void;
}

export default function BondingCurveCalculator({
  currentSupply,
  vaultReserve,
  userGoldBalance = 0,
  userUsdtBalance = 0,
  onBuyTx,
  onSellTx
}: BondingCurveCalculatorProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<number>(1.0); // Default 1.0 Gram Gold ($10.00 USDT ~ ₹945 INR)
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [isSellCashModalOpen, setIsSellCashModalOpen] = useState(false);
  const [isWeb3UsdtModalOpen, setIsWeb3UsdtModalOpen] = useState(false);
  const [usdtInrRate, setUsdtInrRate] = useState<number>(88.50);

  // Sync Live USDT/INR exchange rate from API
  React.useEffect(() => {
    getLiveUsdtInrRate().then((rate) => {
      if (rate && rate > 50) {
        setUsdtInrRate(rate);
      }
    });
  }, []);
  const [isOnrampModalOpen, setIsOnrampModalOpen] = useState(false);
  const [onrampMode, setOnrampMode] = useState<'BUY' | 'SELL'>('BUY');

  const currentPrice = calculatePriceAtSupply(currentSupply);
  const currentFloor = currentSupply > 0 ? vaultReserve / currentSupply : 0.00098;

  // Buy Calculations (2% Fee: 98% Vault, 1% Treasury, 1% Dividend)
  const buyGrossCost = calculateIntegral(currentSupply, Math.min(MAX_SUPPLY_CAP, currentSupply + amount));
  const buyTreasuryFee = buyGrossCost * 0.01;
  const buyDividendFee = buyGrossCost * 0.01;
  const buyVaultDeposit = buyGrossCost * 0.98;

  // Sell Calculations (10% Fee: 90% Seller, 8% Vault Lock, 1% Treasury, 1% Dividend)
  const sellGrossValuation = currentSupply > 0 ? vaultReserve * (amount / currentSupply) : 0;
  const sellTreasuryFee = sellGrossValuation * 0.01;
  const sellDividendFee = sellGrossValuation * 0.01;
  const sellRatchetLock = sellGrossValuation * 0.08;
  const sellPayout = sellGrossValuation * 0.90;

  // Projected Price Floor after Transaction
  const newSupplyAfterBuy = currentSupply + amount;
  const newVaultAfterBuy = vaultReserve + buyVaultDeposit;
  const projectedBuyFloor = newVaultAfterBuy / newSupplyAfterBuy;

  const newSupplyAfterSell = Math.max(1, currentSupply - amount);
  const newVaultAfterSell = Math.max(0, vaultReserve - sellPayout - sellTreasuryFee);
  const projectedSellFloor = newVaultAfterSell / newSupplyAfterSell;

  return (
    <div className="gold-glass-card gold-glass-card-interactive p-6 flex flex-col justify-between h-full border-gold-glow">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-yellow-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Virtual Gold Sovereign L1 Engine
            </div>
            <h3 className="text-xl font-bold text-gold-gradient mt-0.5">Virtual Gold L1 Swap Gateway</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/60 border border-zinc-800 mb-5">
          <button
            onClick={() => setTab('buy')}
            className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'buy'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            SWAP / BUY $GOLD
          </button>
          <button
            onClick={() => setTab('sell')}
            className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'sell'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            SWAP / SELL $GOLD
          </button>
        </div>

        {/* Source USDT Network Selection */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Select Target Protocol Chain:</span>
            <span className="text-[10px] text-yellow-400 font-mono">Polygon • BEP-20 (BSC) • Solana</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold">
            {[
              { id: 'POLYGON', label: 'Polygon (ERC-20)', icon: '🟣' },
              { id: 'BSC', label: 'BEP-20 (Binance)', icon: '🟡' },
              { id: 'SOLANA', label: 'Solana (Anchor)', icon: '🟢' }
            ].map((chain) => (
              <button
                key={chain.id}
                type="button"
                className="py-2.5 px-3 rounded-xl bg-yellow-500/20 border border-yellow-400 text-yellow-300 shadow-md font-black flex items-center justify-center gap-2 hover:bg-yellow-500/30 transition-all text-center"
              >
                <span>{chain.icon}</span>
                <span>{chain.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input & Fractional Buy/Sell Presets */}
        <div className="space-y-3 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-300 font-medium">
              {tab === 'buy' ? 'Select Amount (Buy from $1):' : 'Select Amount to Sell:'}
            </span>
            <span className="text-yellow-400 font-bold text-sm bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
              {amount.toFixed(4)} Grams $GOLD ({tab === 'buy' ? `~$${(amount * currentPrice).toFixed(2)} USDT` : `~$${sellPayout.toFixed(2)} Payout`})
            </span>
          </div>

          {/* Dynamic Presets (BUY vs SELL) */}
          {tab === 'buy' ? (
            <div className="grid grid-cols-5 gap-1 text-[10px] font-bold">
              {[
                { label: '$1 USDT', grams: 0.1 },
                { label: '$5 USDT', grams: 0.5 },
                { label: '$10 USDT', grams: 1.0 },
                { label: '$50 USDT', grams: 5.0 },
                { label: '$100 USDT', grams: 10.0 }
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setAmount(preset.grams)}
                  className={`py-1.5 rounded-lg border text-center transition-all ${
                    amount === preset.grams
                      ? 'bg-yellow-500/30 border-yellow-400 text-yellow-300 shadow-sm'
                      : 'bg-black/60 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold">
              {[
                { label: '25%', factor: 0.25 },
                { label: '50%', factor: 0.50 },
                { label: '75%', factor: 0.75 },
                { label: 'SELL ALL (MAX)', factor: 1.0 }
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setAmount(userGoldBalance * preset.factor)}
                  className={`py-2 rounded-lg border text-center transition-all ${
                    preset.factor === 1.0
                      ? 'bg-red-500/30 border-red-400 text-red-300 font-black shadow-md'
                      : 'bg-black/60 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <input
            type="range"
            min="0.1"
            max="1000"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>0.1 Gram ($1 USDT)</span>
            <span>500 Grams</span>
            <span>1,000 Grams</span>
          </div>
        </div>

        {/* Fee & Breakdown Box */}
        {tab === 'buy' ? (
          <div className="p-4 rounded-xl bg-black/60 border border-yellow-500/30 space-y-2 text-xs mb-5">
            <div className="flex justify-between">
              <span className="text-zinc-400">Base Gold Cost:</span>
              <span className="font-bold text-white">${buyGrossCost.toFixed(4)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Vault Reserve Collateral (98%):</span>
              <span className="font-bold text-emerald-400">${buyVaultDeposit.toFixed(4)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Treasury (1%) + Dividend Pool (1%):</span>
              <span className="font-bold text-zinc-400">${(buyTreasuryFee + buyDividendFee).toFixed(4)} USDT</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-semibold">
              <span>Gateway Fee (0% Direct Protocol Settlement):</span>
              <span>$0.00 USDT (FREE)</span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex justify-between">
              <span className="text-zinc-300 font-medium">New Floor Price P_floor:</span>
              <span className="font-bold text-yellow-400">${projectedBuyFloor.toFixed(6)} / $GOLD</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-black/60 border border-red-500/30 space-y-2 text-xs mb-5">
            <div className="flex justify-between">
              <span className="text-zinc-400">Proportional Vault Share:</span>
              <span className="font-bold text-white">${sellGrossValuation.toFixed(4)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Net Seller Payout (90%):</span>
              <span className="font-bold text-emerald-400">${sellPayout.toFixed(4)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Permanent Vault Lock (8%):</span>
              <span className="font-bold text-yellow-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> +${sellRatchetLock.toFixed(4)} USDT
              </span>
            </div>
            <div className="flex justify-between text-red-400 font-medium">
              <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> L1 Token Burn:</span>
              <span>100% ({amount.toLocaleString()} $GOLD Burned)</span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex justify-between">
              <span className="text-zinc-300 font-medium">Floor Price Increase:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> ${projectedSellFloor.toFixed(6)} (+{(((projectedSellFloor - currentFloor) / currentFloor) * 100).toFixed(3)}%)
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2.5 mt-4">
        {tab === 'buy' ? (
          <>
            <button
              onClick={() => onBuyTx(amount, buyGrossCost, buyVaultDeposit)}
              className="w-full py-4 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 text-black" /> ⚡ INSTANT SWAP (BUY ${amount.toFixed(2)} GRAMS $GOLD NOW)
            </button>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setIsUpiModalOpen(true)}
                className="py-2.5 px-3 rounded-xl bg-black/60 border border-yellow-500/30 text-yellow-300 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:bg-yellow-500/20 active:scale-[0.98]"
              >
                <Smartphone className="w-3.5 h-3.5 text-yellow-400" /> P2P Merchant UPI (INR)
              </button>
              <button
                onClick={() => setIsWeb3UsdtModalOpen(true)}
                className="py-2.5 px-3 rounded-xl bg-black/60 border border-yellow-500/30 text-yellow-300 font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:bg-yellow-500/20 active:scale-[0.98]"
              >
                <Wallet className="w-3.5 h-3.5 text-yellow-400" /> Web3 USDT Transfer
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => onSellTx(amount, sellPayout)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Flame className="w-4 h-4 text-white" /> 🔥 INSTANT SWAP (SELL ${amount.toFixed(2)} GRAMS $GOLD FOR USDT)
            </button>

            <button
              onClick={() => setIsSellCashModalOpen(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:bg-emerald-500/30 active:scale-[0.98]"
            >
              <Landmark className="w-4 h-4 text-emerald-400" /> P2P Merchant Bank / UPI Payout (INR)
            </button>
          </>
        )}
      </div>

      {/* Instant Buy UPI & Card Gateway Modal */}
      <FiatUpiGatewayModal
        isOpen={isUpiModalOpen}
        onClose={() => setIsUpiModalOpen(false)}
        goldAmount={amount}
        usdtCost={buyGrossCost}
        inrCost={Math.round(buyGrossCost * usdtInrRate)} // Live USDT/INR exchange rate from API
        onPaymentSuccess={() => {
          onBuyTx(amount, buyGrossCost, buyVaultDeposit);
        }}
      />

      {/* Direct Web3 USDT Wallet Transfer Modal */}
      <Web3UsdtTransferModal
        isOpen={isWeb3UsdtModalOpen}
        onClose={() => setIsWeb3UsdtModalOpen(false)}
        goldAmount={amount}
        usdtCost={buyGrossCost}
        onTransferSuccess={() => {
          onBuyTx(amount, buyGrossCost, buyVaultDeposit);
        }}
      />

      {/* Instant Sell Bank & Cash Payout Modal */}
      <SellCashPayoutModal
        isOpen={isSellCashModalOpen}
        onClose={() => setIsSellCashModalOpen(false)}
        goldAmount={amount}
        usdtPayout={sellPayout}
        inrPayout={Math.round(sellPayout * usdtInrRate)} // Live USDT/INR exchange rate from API
        onSellSuccess={() => {
          onSellTx(amount, sellPayout);
        }}
      />
    </div>
  );
}
