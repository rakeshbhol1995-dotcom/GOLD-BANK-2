'use client';

import React from 'react';
import { Shield, Bug, Award, ExternalLink, FileText, CheckCircle2, AlertOctagon, Lock, X } from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityBugBountyModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-full hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <Bug className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-amber-300">
              Security Architecture & Immunefi Bug Bounty
            </h2>
            <p className="text-xs text-slate-400">
              Score: 9/10 Target Security Architecture — Fully Patched & Validated
            </p>
          </div>
        </div>

        {/* Master Audit Link Card */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-200">Consolidated Master Audit Codebase</div>
              <div className="text-[11px] text-slate-400 font-mono">VIRTUAL_GOLD_CONSOLIDATED_MASTER_AUDIT.sol (2,257 Lines)</div>
            </div>
          </div>
          <a
            href="/VIRTUAL_GOLD_CONSOLIDATED_MASTER_AUDIT.sol"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
          >
            Inspect Code <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Immunefi Bug Bounty Tiers Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" /> Immunefi Bug Bounty Tiers
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-rose-300 block">Critical Vulnerability</span>
              <span className="text-lg font-black text-rose-400 font-mono">$10,000 USDT</span>
              <p className="text-[10px] text-slate-400">Direct reserve drain or unauthorized minting</p>
            </div>

            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-amber-300 block">High Severity</span>
              <span className="text-lg font-black text-amber-400 font-mono">$2,500 USDT</span>
              <p className="text-[10px] text-slate-400">Dividend accounting manipulation or fee bypass</p>
            </div>

            <div className="p-3.5 bg-blue-950/30 border border-blue-500/30 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-blue-300 block">Medium Severity</span>
              <span className="text-lg font-black text-blue-400 font-mono">$1,000 USDT</span>
              <p className="text-[10px] text-slate-400">Temporary griefing or minor rounding loss</p>
            </div>
          </div>
        </div>

        {/* Security Invariants Checklist */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-slate-300 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-400" /> Active Security Invariants:
          </h3>
          <ul className="space-y-1.5 text-slate-300 text-[11px] font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>48-Hour Timelock Governance on ALL admin actions</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Permanently Locked Token Minter Role (`lockMinter()`)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Emergency Rescue Untracked Excess USDT Guard</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Strict 21,000,000 GOLD Hard Supply Cap Invariant</span>
            </li>
          </ul>
        </div>

        {/* Contact & Disclosure Note */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
          Responsible Disclosure Email: <span className="text-amber-300 font-mono font-bold">security@virtualgold.org</span>
        </div>

      </div>
    </div>
  );
};
