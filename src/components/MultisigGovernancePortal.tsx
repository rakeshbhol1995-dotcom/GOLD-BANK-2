'use client';

import React, { useState } from 'react';
import { Shield, Clock, CheckCircle2, AlertTriangle, Vote, PlusCircle, Lock, Key, ArrowRight, UserCheck, Play } from 'lucide-react';

export enum ActionType {
  TogglePause = 0,
  UpdateTreasury = 1,
  ReleaseRatchet = 2,
  TransferOwnership = 3,
  EmergencyRescueUSDT = 4,
  RotateMinter = 5
}

export interface ProposalItem {
  id: number;
  actionType: ActionType;
  targetAddress: string;
  amount: number; // in USDT micro-units or tokens
  queueTime: number; // timestamp
  executeTime: number; // timestamp (+48h)
  approvalsCount: number;
  multisigThreshold: number;
  executed: boolean;
  cancelled: boolean;
  userHasApproved?: boolean;
}

const ACTION_LABELS: Record<ActionType, { name: string; color: string; desc: string }> = {
  [ActionType.TogglePause]: { name: 'Toggle Protocol Pause', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', desc: 'Emergency circuit breaker pause/unpause' },
  [ActionType.UpdateTreasury]: { name: 'Update Admin Treasury', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', desc: 'Update protocol 1% fee collection address' },
  [ActionType.ReleaseRatchet]: { name: 'Release Ratchet Funds', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', desc: 'Move floor ratchet reserve into active vault reserve' },
  [ActionType.TransferOwnership]: { name: 'Transfer Ownership', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', desc: 'Transfer protocol admin ownership' },
  [ActionType.EmergencyRescueUSDT]: { name: 'Emergency Rescue Excess USDT', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10', desc: 'Rescue untracked excess USDT (User reserves protected & untouchable)' },
  [ActionType.RotateMinter]: { name: 'Rotate Minter Authority', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', desc: 'Rotate token minting authority contract' }
};

export const MultisigGovernancePortal: React.FC = () => {
  const [proposals, setProposals] = useState<ProposalItem[]>([
    {
      id: 101,
      actionType: ActionType.ReleaseRatchet,
      targetAddress: '0x0000000000000000000000000000000000000000',
      amount: 50000,
      queueTime: Date.now() - 3600000 * 24, // 24h ago
      executeTime: Date.now() + 3600000 * 24, // 24h remaining
      approvalsCount: 2,
      multisigThreshold: 2,
      executed: false,
      cancelled: false,
      userHasApproved: true,
    },
    {
      id: 102,
      actionType: ActionType.EmergencyRescueUSDT,
      targetAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      amount: 10000,
      queueTime: Date.now() - 3600000 * 49, // 49h ago (ready to execute!)
      executeTime: Date.now() - 3600000, // expired 1h ago
      approvalsCount: 3,
      multisigThreshold: 2,
      executed: false,
      cancelled: false,
      userHasApproved: true,
    }
  ]);

  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionType>(ActionType.TogglePause);
  const [targetAddressInput, setTargetAddressInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQueueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const newProp: ProposalItem = {
        id: proposals.length + 101,
        actionType: selectedAction,
        targetAddress: targetAddressInput || '0x0000000000000000000000000000000000000000',
        amount: Number(amountInput) || 0,
        queueTime: Date.now(),
        executeTime: Date.now() + 48 * 3600 * 1000, // 48h timelock
        approvalsCount: 1,
        multisigThreshold: 2,
        executed: false,
        cancelled: false,
        userHasApproved: true,
      };

      setProposals([newProp, ...proposals]);
      setIsSubmitting(false);
      setShowQueueModal(false);
      setTargetAddressInput('');
      setAmountInput('');
    }, 500);
  };

  const handleApprove = (id: number) => {
    setProposals(proposals.map(p => {
      if (p.id === id && !p.userHasApproved) {
        return { ...p, approvalsCount: p.approvalsCount + 1, userHasApproved: true };
      }
      return p;
    }));
  };

  const handleExecute = (id: number) => {
    setProposals(proposals.map(p => {
      if (p.id === id) {
        return { ...p, executed: true };
      }
      return p;
    }));
  };

  const formatRemainingTime = (executeTime: number) => {
    const diff = executeTime - Date.now();
    if (diff <= 0) return 'Timelock Expired — Ready to Execute';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining (48h Timelock)`;
  };

  return (
    <div className="w-full bg-slate-950 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Shield className="w-64 h-64 text-amber-400" />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <Lock className="w-3.5 h-3.5" /> 48-Hour Timelock Multisig Active
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-400">
              On-Chain Multisig Governance Portal
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Zero single-owner admin control. Every critical parameter update, pause toggle, or ratchet release requires multi-signer approval and a mandatory 48-hour timelock delay before execution.
            </p>

            <div className="pt-4 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowQueueModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-4 h-4" /> Queue Proposal
              </button>
              
              <div className="flex items-center gap-4 text-xs text-slate-400 border-l border-slate-700 pl-4">
                <div>Multisig Threshold: <span className="font-bold text-amber-300">2 of 3 Signers</span></div>
                <div>Timelock Delay: <span className="font-bold text-amber-300">48 Hours Mandatory</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Proposals Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
              <Vote className="w-5 h-5 text-amber-400" /> Active Governance Proposals
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Total Proposals Queued: {proposals.length}
            </span>
          </div>

          <div className="space-y-4">
            {proposals.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 text-sm">
                No active governance proposals queued.
              </div>
            ) : (
              proposals.map((item) => {
                const actionMeta = ACTION_LABELS[item.actionType];
                const isReady = Date.now() >= item.executeTime;
                const hasThresholdMet = item.approvalsCount >= item.multisigThreshold;

                return (
                  <div
                    key={item.id}
                    className={`bg-slate-900/90 border ${item.executed ? 'border-slate-800 opacity-70' : 'border-slate-800 hover:border-amber-500/30'} rounded-2xl p-6 transition-all shadow-xl space-y-4`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500 font-bold">#PROP-{item.id}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${actionMeta.color}`}>
                            {actionMeta.name}
                          </span>
                          {item.executed && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Executed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{actionMeta.desc}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Approvals Status</span>
                          <span className="font-mono font-bold text-sm text-amber-300">
                            {item.approvalsCount} / {item.multisigThreshold} Signatures
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Target & Amount Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 text-xs font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500 block">Target Address:</span>
                        <span className="truncate block font-mono text-slate-200">{item.targetAddress}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Amount Parameter:</span>
                        <span>{item.amount ? `${item.amount.toLocaleString()} USDT / Units` : 'N/A'}</span>
                      </div>
                    </div>

                    {/* Timelock & Actions Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className={isReady ? 'text-emerald-400 font-bold' : 'text-slate-400 font-mono'}>
                          {formatRemainingTime(item.executeTime)}
                        </span>
                      </div>

                      {!item.executed && (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={item.userHasApproved}
                            className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {item.userHasApproved ? 'Approved by You' : 'Approve Proposal'}
                          </button>

                          <button
                            onClick={() => handleExecute(item.id)}
                            disabled={!isReady || !hasThresholdMet}
                            className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" /> Execute
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal for Queueing Proposal */}
        {showQueueModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative">
              <h3 className="text-xl font-bold text-amber-300 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" /> Queue Governance Proposal
              </h3>

              <form onSubmit={handleQueueSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Select Administrative Action</label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(Number(e.target.value) as ActionType)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-400 outline-none font-semibold"
                  >
                    <option value={ActionType.TogglePause}>Toggle Protocol Pause (Circuit Breaker)</option>
                    <option value={ActionType.UpdateTreasury}>Update Admin Treasury Address</option>
                    <option value={ActionType.ReleaseRatchet}>Release Ratchet Reserve Funds</option>
                    <option value={ActionType.TransferOwnership}>Transfer Protocol Ownership</option>
                    <option value={ActionType.EmergencyRescueUSDT}>Emergency Rescue Excess USDT</option>
                    <option value={ActionType.RotateMinter}>Rotate Token Minter Authority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Target Address (If Applicable)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={targetAddressInput}
                    onChange={(e) => setTargetAddressInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Amount / Value (If Applicable)</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono focus:border-amber-400 outline-none"
                  />
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Queueing this proposal initiates a mandatory 48-hour timelock delay. It cannot be executed until 2 of 3 multisig signatures are collected.
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQueueModal(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-bold rounded-xl active:scale-95 transition-all"
                  >
                    {isSubmitting ? 'Queueing...' : 'Queue Proposal (48h Lock)'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
