'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Zap, Coins, ArrowRight, CheckCircle2 } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'GENERAL' | 'SECURITY' | 'P2P' | 'PROFIT';
}

const FAQ_LIST: FaqItem[] = [
  {
    id: 'faq_1',
    category: 'GENERAL',
    question: 'What is Virtual Gold Protocol ($GOLD)?',
    answer: 'Virtual Gold ($GOLD) is a Reserve-Backed Bonding-Curve Asset with Transaction-Funded Dividends. Each 1 Gram $GOLD is collateralized by 100% USDT locked inside an immutable Smart Contract Vault PDA on Solana L1.'
  },
  {
    id: 'faq_2',
    category: 'SECURITY',
    question: 'Is Virtual Gold 100% Genuine and safe from rug-pulls?',
    answer: 'Yes! All reserve collateral is held in an immutable Program Derived Address (PDA). Only user token burn instructions can trigger collateral releases. Circuit breakers and contract upgrades are protected by a 48-hour timelocked multisig governance system.'
  },
  {
    id: 'faq_3',
    category: 'P2P',
    question: 'How do I buy $GOLD using UPI (Google Pay / PhonePe / Paytm)?',
    answer: 'Select your desired gold quantity (e.g. 1 Gram $GOLD or $1 USDT fractional buy) in the P2P Merchant Marketplace. Copy the verified merchant’s UPI VPA, pay via GPay/PhonePe/Paytm, and enter the 12-digit UTR reference number. Once verified, $GOLD tokens are auto-minted directly to your email wallet.'
  },
  {
    id: 'faq_4',
    category: 'P2P',
    question: 'How do I sell $GOLD and receive instant cash INR in my bank?',
    answer: 'Enter the amount of $GOLD you wish to sell and input your UPI ID or Bank Account details. The smart contract burns 100% of your sold $GOLD tokens, and the authorized P2P Merchant transfers instant INR cash directly to your bank account within minutes.'
  },
  {
    id: 'faq_5',
    category: 'SECURITY',
    question: 'What is the Monotonic Floor Price (P_floor)?',
    answer: 'The monotonic floor price (P_floor = V / S) is the internal smart contract cashout redemption floor. Because 98% of buys and 8% of sells lock collateral permanently in the vault while 100% of sold tokens are burned, the internal vault redemption floor is mathematically non-decreasing.'
  },
  {
    id: 'faq_6',
    category: 'PROFIT',
    question: 'How do Staking Dividends work?',
    answer: 'Staking dividends are transaction-funded yields generated directly from a 1% volume tax on global protocol transactions. 1% of every buy and sell order is distributed directly to token holders in real-time USDT.'
  },
  {
    id: 'faq_7',
    category: 'GENERAL',
    question: 'Which blockchain networks are supported for USDT swaps?',
    answer: 'Virtual Gold Protocol supports Multi-Chain USDT deposits and payouts across 7 major networks: Ethereum (ERC-20), BNB Smart Chain (BEP-20), Polygon (POS), Arbitrum (One), Solana (SPL Token), Avalanche (C-Chain), and Optimism. You can transfer USDT from any wallet on any chain, and receive $GOLD tokens instantly!'
  },
  {
    id: 'faq_8',
    category: 'GENERAL',
    question: 'What is the base price and total supply of $GOLD?',
    answer: 'The genesis base price is $10.00 USDT per 1 Gram $GOLD (~₹945 INR). Total protocol supply is hard-capped at 21,000,000 Grams (21 Million Grams), making $GOLD as scarce as Bitcoin.'
  },
  {
    id: 'faq_9',
    category: 'P2P',
    question: 'How do I log in or apply to become an authorized P2P Merchant?',
    answer: 'Merchant login and applications are handled exclusively on our dedicated Merchant Subdomain Portal (merchant.virtualgold.org / /merchant route). Visit the merchant portal to log in with your Merchant ID or apply for a $2,000 USDT collateral merchant license.'
  },
  {
    id: 'faq_10',
    category: 'SECURITY',
    question: 'Can the Admin or Founder steal funds or shut down user access?',
    answer: 'No. The admin has zero withdrawal keys or access to vault collateral. All reserves are locked in non-custodial Program Derived Address (PDA) smart contracts. Even if the website front-end or domain goes offline, users can directly interact with the smart contract on-chain (via PolygonScan / Block Explorer) to burn $GOLD tokens and withdraw their USDT.'
  }
];

export default function VirtualGoldFaqSection() {
  const [openId, setOpenId] = useState<string | null>('faq_1');

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section className="w-full space-y-6 py-8 text-left">
      <div className="gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-yellow-500/20 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold font-mono">
              <HelpCircle className="w-4 h-4" /> FREQUENTLY ASKED QUESTIONS
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5">
              Virtual Gold Protocol FAQ & Knowledge Base
            </h2>
            <p className="text-xs text-zinc-300 mt-1">
              Everything you need to know about $GOLD tokenomics, P2P merchant buying, security, and holding rewards.
            </p>
          </div>

          <div className="px-4 py-2 rounded-xl bg-black/80 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 100% Verified Answers
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {FAQ_LIST.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? 'bg-black/90 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                    : 'bg-black/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left transition-colors"
                >
                  <span className="font-extrabold text-sm sm:text-base text-white flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-yellow-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-zinc-800/80 text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans animate-fade-in">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
