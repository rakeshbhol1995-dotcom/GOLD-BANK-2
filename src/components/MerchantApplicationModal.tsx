'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, UserPlus, Building, Phone, Mail, CreditCard, Landmark, ArrowRight } from 'lucide-react';

export interface MerchantApplication {
  id: string;
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  upiId: string;
  dailyCapacity: string;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface MerchantApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (app: MerchantApplication) => void;
}

export default function MerchantApplicationModal({
  isOpen,
  onClose,
  onSubmitted
}: MerchantApplicationModalProps) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [dailyCapacity, setDailyCapacity] = useState('₹1,00,000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const newApp: MerchantApplication = {
        id: `MCH_${Date.now().toString(36).toUpperCase()}`,
        fullName,
        businessName: businessName || 'Independent Merchant',
        email,
        phone,
        upiId,
        dailyCapacity,
        timestamp: new Date().toLocaleTimeString(),
        status: 'PENDING'
      };

      try {
        const existing = JSON.parse(localStorage.getItem('virtualgold_merchant_apps') || '[]');
        localStorage.setItem('virtualgold_merchant_apps', JSON.stringify([newApp, ...existing]));
      } catch (err) {}

      onSubmitted(newApp);
      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl gold-glass-card p-6 sm:p-8 border-gold-glow space-y-6 flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          <div className="text-center py-12 space-y-4 animate-fade-in my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white">Merchant Application Submitted!</h3>
            <p className="text-xs text-zinc-300 max-w-md mx-auto">
              Your P2P Merchant application has been submitted to the Admin Protocol Review Queue. Upon verification, your Merchant VPA will be authorized!
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-400" /> Authorized P2P Merchant Network
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Apply to Become a P2P Merchant</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Provide P2P UPI liquidity for $GOLD token buyers and earn automated trading spread fees!
              </p>
            </div>

            {/* Application Form */}
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Full Name / Merchant Name:</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Email Address:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@gmail.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Phone / WhatsApp Number:</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Primary Merchant UPI ID (VPA):</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. rahulmerchant@sbi or 9876543210@paytm"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Daily P2P Liquidity Capacity:</label>
                <select
                  value={dailyCapacity}
                  onChange={(e) => setDailyCapacity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 font-bold focus:outline-none focus:border-yellow-400"
                >
                  <option value="₹50,000">₹50,000 INR / Day</option>
                  <option value="₹1,00,000">₹1,00,000 INR / Day</option>
                  <option value="₹5,00,000">₹5,00,000 INR / Day</option>
                  <option value="₹10,00,000+">₹10,00,000+ INR / Day (VIP Enterprise)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Submitting Application...' : 'Submit Merchant Application'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
