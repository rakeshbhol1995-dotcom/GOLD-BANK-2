'use client';

import React, { useState } from 'react';
import { ArrowDownUp, Sparkles, ShieldCheck, Zap, RefreshCw, Settings, Wallet, CheckCircle2, ChevronDown } from 'lucide-react';
import { calculatePriceAtSupply, calculateIntegral, MAX_SUPPLY_CAP } from './BondingCurveCalculator';

interface UniversalGoldSwapWidgetProps {
  currentSupply: number;
  vaultReserve: number;
  userUsdtBalance: number;
  userGoldBalance: number;
  onExecuteBuy: (amount: number, grossCost: number, vaultDeposit: number) => void;
  onExecuteSell: (amount: number, sellerPayout: number) => void;
}

export type SupportedChain = 'POLYGON' | 'BSC' | 'SOLANA';

export default function UniversalGoldSwapWidget({
  currentSupply,
  vaultReserve,
  userUsdtBalance,
  userGoldBalance,
  onExecuteBuy,
  onExecuteSell
}: UniversalGoldSwapWidgetProps) {
  const [selectedChain, setSelectedChain] = useState<SupportedChain>('POLYGON');
  const [swapMode, setSwapMode] = useState<'BUY' | 'SELL'>('BUY'); // BUY = USDT->GOLD, SELL = GOLD->USDT
  
  // Amounts
  const [fromAmountInput, setFromAmountInput] = useState<string>('10'); // Default $10 USDT
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [txSuccessMessage, setTxSuccessMessage] = useState<string>('');

  const currentPrice = calculatePriceAtSupply(currentSupply);
  const currentFloor = currentSupply > 0 ? vaultReserve / currentSupply : 9.80;

  // Numeric input
  const numericInput = parseFloat(fromAmountInput) || 0;

  // Calculations
  let estimatedReceiveGrams = 0;
  let estimatedCostUsdt = 0;
  let estimatedPayoutUsdt = 0;

  if (swapMode === 'BUY') {
    // Input is USDT, calculate how many GOLD grams
    estimatedCostUsdt = numericInput;
    estimatedReceiveGrams = currentPrice > 0 ? numericInput / currentPrice : 0;
  } else {
    // Input is GOLD grams, calculate USDT payout
    estimatedReceiveGrams = numericInput;
    const sellGrossValuation = currentSupply > 0 ? vaultReserve * (numericInput / currentSupply) : numericInput * 9.0;
    estimatedPayoutUsdt = sellGrossValuation * 0.90;
  }

  // Handle Swap Execution
  const handleSwapNow = () => {
    if (numericInput <= 0) {
      alert('Please enter a valid swap amount!');
      return;
    }

    if (swapMode === 'BUY') {
      if (userUsdtBalance < estimatedCostUsdt) {
        alert('Insufficient USDT balance! Click "Get +1,000 Test USDT Faucet" in your wallet bar to refill.');
        return;
      }
      setIsSwapping(true);
      setTimeout(() => {
        const vaultDeposit = estimatedCostUsdt * 0.98;
        onExecuteBuy(estimatedReceiveGrams, estimatedCostUsdt, vaultDeposit);
        setIsSwapping(false);
        setTxSuccessMessage(`✅ Successfully Swapped $${estimatedCostUsdt.toFixed(2)} USDT → ${estimatedReceiveGrams.toFixed(4)} Grams $GOLD!`);
        setTimeout(() => setTxSuccessMessage(''), 4000);
      }, 1200);
    } else {
      if (userGoldBalance < numericInput) {
        alert('Insufficient $GOLD balance to sell!');
        return;
      }
      setIsSwapping(true);
      setTimeout(() => {
        onExecuteSell(numericInput, estimatedPayoutUsdt);
        setIsSwapping(false);
        setTxSuccessMessage(`✅ Successfully Swapped ${numericInput.toFixed(4)} Grams $GOLD → $${estimatedPayoutUsdt.toFixed(2)} USDT Payout!`);
        setTimeout(() => setTxSuccessMessage(''), 4000);
      }, 1200);
    }
  };

  // Toggle Buy/Sell direction
  const handleToggleDirection = () => {
    setSwapMode((prev) => (prev === 'BUY' ? 'SELL' : 'BUY'));
    setFromAmountInput(swapMode === 'BUY' ? '1.0' : '10');
  };

  return (
    <div className="gold-glass-card gold-glass-card-interactive p-6 sm:p-8 border-gold-glow relative overflow-hidden space-y-6">
      
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-yellow-500/20 pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Multi-Chain Automated Market Maker (AMM)
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gold-gradient mt-1">
            Universal Instant DEX Swap
          </h2>
        </div>

        {/* Chain Selector Pills & Settings */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/60 border border-yellow-500/30 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedChain('POLYGON')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedChain === 'POLYGON'
                  ? 'bg-purple-500/30 text-purple-300 border border-purple-400 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>🟣</span> Polygon
            </button>

            <button
              onClick={() => setSelectedChain('BSC')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedChain === 'BSC'
                  ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>🟡</span> BEP-20
            </button>

            <button
              onClick={() => setSelectedChain('SOLANA')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedChain === 'SOLANA'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400 font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>🟢</span> Solana
            </button>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 text-zinc-400 hover:text-yellow-400 transition-colors"
            title="Slippage Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slippage Settings Panel */}
      {showSettings && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/40 text-xs space-y-2 animate-fade-in">
          <div className="font-bold text-yellow-300 flex items-center justify-between">
            <span>Slippage Tolerance</span>
            <span className="text-zinc-400">Current: {slippage}%</span>
          </div>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0, 2.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className={`px-3 py-1 rounded-lg border text-xs font-bold ${
                  slippage === val
                    ? 'bg-yellow-500 text-black border-yellow-400 font-black'
                    : 'bg-black/60 border-zinc-800 text-zinc-300'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {txSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{txSuccessMessage}</span>
        </div>
      )}

      {/* Main Interactive DEX Swap Box */}
      <div className="space-y-3">
        
        {/* FROM TOKEN BOX */}
        <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-2 focus-within:border-yellow-400 transition-colors">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>You Pay (From)</span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              Balance: {swapMode === 'BUY' ? `$${userUsdtBalance.toFixed(2)} USDT` : `${userGoldBalance.toFixed(4)} Grams $GOLD`}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <input
              type="number"
              value={fromAmountInput}
              onChange={(e) => setFromAmountInput(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-2xl sm:text-3xl font-black text-white focus:outline-none placeholder:text-zinc-600 font-mono"
            />

            {/* Token Badge */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-yellow-500/40 text-yellow-300 font-extrabold text-xs shrink-0 shadow-md">
              {swapMode === 'BUY' ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[10px]">₮</div>
                  <span>USDT</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-yellow-500/30 text-yellow-400 flex items-center justify-center font-bold text-[10px]">🪙</div>
                  <span>$GOLD</span>
                </>
              )}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex justify-between items-center text-[11px] text-zinc-500 pt-1">
            <span>1 Gram = ${currentPrice.toFixed(2)} USDT</span>
            <div className="flex gap-1.5 font-bold">
              {[
                { label: '25%', factor: 0.25 },
                { label: '50%', factor: 0.5 },
                { label: 'MAX', factor: 1.0 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    const maxVal = swapMode === 'BUY' ? userUsdtBalance : userGoldBalance;
                    setFromAmountInput(swapMode === 'BUY' ? (maxVal * p.factor).toFixed(2) : (maxVal * p.factor).toFixed(4));
                  }}
                  className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SWAP DIRECTION TOGGLE BUTTON */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleToggleDirection}
            className="w-11 h-11 rounded-2xl bg-yellow-500 text-black border-2 border-black flex items-center justify-center shadow-lg shadow-yellow-500/30 hover:scale-110 active:rotate-180 transition-all duration-300"
            title="Switch Swap Direction"
          >
            <ArrowDownUp className="w-5 h-5" />
          </button>
        </div>

        {/* TO TOKEN BOX */}
        <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-yellow-500/30 space-y-2">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>You Receive (To)</span>
            <span className="text-emerald-400 font-mono text-[10px]">Instant Settlement</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="w-full text-2xl sm:text-3xl font-black text-yellow-400 font-mono truncate">
              {swapMode === 'BUY' ? estimatedReceiveGrams.toFixed(4) : `$${estimatedPayoutUsdt.toFixed(2)}`}
            </div>

            {/* Token Badge */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-yellow-500/40 text-yellow-300 font-extrabold text-xs shrink-0 shadow-md">
              {swapMode === 'BUY' ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-yellow-500/30 text-yellow-400 flex items-center justify-center font-bold text-[10px]">🪙</div>
                  <span>$GOLD</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[10px]">₮</div>
                  <span>USDT</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Price Impact & Protocol Breakdown */}
      <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-400">Exchange Rate:</span>
          <span className="font-bold text-white font-mono">1 Gram $GOLD = ${currentPrice.toFixed(2)} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Target Protocol Network:</span>
          <span className="font-bold text-yellow-400">{selectedChain} Protocol ({selectedChain === 'SOLANA' ? 'Anchor' : 'ERC-20'})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Vault Reserve Guarantee (98%):</span>
          <span className="font-bold text-emerald-400">${(estimatedCostUsdt * 0.98).toFixed(2)} USDT</span>
        </div>
        <div className="flex justify-between text-emerald-400 font-semibold">
          <span>Gateway Surcharge Fee:</span>
          <span>$0.00 USDT (0% Fee)</span>
        </div>
        <div className="flex justify-between text-yellow-400 font-bold border-t border-zinc-800 pt-2">
          <span>Guaranteed Price Floor P_floor:</span>
          <span>${currentFloor.toFixed(4)} USDT / Gram</span>
        </div>
      </div>

      {/* EXECUTE SWAP BUTTON */}
      <button
        onClick={handleSwapNow}
        disabled={isSwapping}
        className={`w-full py-4 rounded-2xl bg-gold-gradient text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-yellow-500/25 transition-all flex items-center justify-center gap-2 ${
          isSwapping ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
        }`}
      >
        {isSwapping ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin text-black" />
            Processing Instant Multi-Chain Swap...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" /> ⚡ SWAP NOW ({swapMode === 'BUY' ? 'USDT → $GOLD' : '$GOLD → USDT'})
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 pt-1">
        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Non-Custodial Vault Settlement • 0% Default Risk
      </div>
    </div>
  );
}
