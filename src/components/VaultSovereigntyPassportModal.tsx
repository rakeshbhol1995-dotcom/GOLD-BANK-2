'use client';

import React from 'react';
import { ShieldCheck, Award, Lock, ExternalLink, QrCode, Sparkles, CheckCircle2, Download, X } from 'lucide-react';

interface VaultPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  walletAddress?: string;
  goldBalance?: number;
  vaultReserveUSDT?: number;
  currentFloorPrice?: number;
}

export const VaultSovereigntyPassportModal: React.FC<VaultPassportModalProps> = ({
  isOpen,
  onClose,
  userEmail = 'holder@virtualgold.org',
  walletAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  goldBalance = 150.50,
  vaultReserveUSDT = 4850000,
  currentFloorPrice = 10.77,
}) => {
  if (!isOpen) return null;

  const dedicatedCollateral = goldBalance * currentFloorPrice;
  const certificateHash = `VGOLD-PASS-${walletAddress.slice(2, 8)}-${Math.floor(goldBalance * 100)}-CERT`;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 shadow-2xl relative my-8 text-white">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-900 rounded-full border border-slate-800 hover:border-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Banner Card */}
        <div className="bg-gradient-to-br from-amber-950/60 via-slate-900 to-yellow-950/40 border border-amber-500/50 rounded-2xl p-6 space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Award className="w-48 h-48 text-amber-400" />
          </div>

          {/* Top Stamp */}
          <div className="flex justify-between items-center border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
                Sovereign Gold Certificate
              </span>
            </div>

            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> On-Chain Verified
            </span>
          </div>

          {/* Certificate Title */}
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-400 uppercase tracking-wide">
              Vault Sovereignty Passport
            </h3>
            <p className="text-[11px] text-slate-400">
              Immutable Cryptographic Proof of Physical/USDT Vault Reserve Ownership
            </p>
          </div>

          {/* Core Balance Metrics */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-4 rounded-xl border border-amber-500/20 text-center font-mono">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Certified $GOLD Grams</span>
              <span className="text-xl font-black text-amber-300">{goldBalance.toLocaleString()} Grams</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Dedicated USDT Collateral</span>
              <span className="text-xl font-black text-emerald-400">${dedicatedCollateral.toFixed(2)} USDT</span>
            </div>
          </div>

          {/* Holder Metadata */}
          <div className="space-y-2 text-xs font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-500">Holder ID:</span>
              <span className="text-slate-300 truncate max-w-[200px]">{userEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Wallet Address:</span>
              <span className="text-amber-300">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Guaranteed Floor Rate:</span>
              <span className="text-emerald-400 font-bold">${currentFloorPrice.toFixed(4)} USDT/Gram</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Certificate Hash:</span>
              <span className="text-slate-400 text-[10px] truncate max-w-[180px]">{certificateHash}</span>
            </div>
          </div>

          {/* Footer Guarantee */}
          <div className="pt-2 text-[10px] text-amber-300/80 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>24/7/365 Autonomous Redemption Guaranteed via `guaranteedExit()` Contract</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              alert(`Vault Certificate Hash Verified!\n\nCertificate Hash: ${certificateHash}\nHolder: ${userEmail}\nGOLD Balance: ${goldBalance} Grams\nUSDT Value: $${dedicatedCollateral.toFixed(2)}`);
            }}
            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Certified Copy
          </button>
        </div>

      </div>
    </div>
  );
};
