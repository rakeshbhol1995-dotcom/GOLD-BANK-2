'use client';

import React from 'react';

interface VirtualGoldLogoProps {
  className?: string;
  size?: number;
}

export default function VirtualGoldLogo({ className = '', size = 36 }: VirtualGoldLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_12px_rgba(255,215,0,0.5)] transition-transform hover:scale-105"
      >
        <defs>
          {/* Gold Metallic Gradients */}
          <linearGradient id="goldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF7D6" />
            <stop offset="25%" stopColor="#FFD700" />
            <stop offset="60%" stopColor="#DAA520" />
            <stop offset="100%" stopColor="#8B6508" />
          </linearGradient>

          <linearGradient id="goldGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE44D" />
            <stop offset="50%" stopColor="#FFC800" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>

          <radialGradient id="haloGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Halo Glow Circle */}
        <circle cx="50" cy="50" r="48" fill="url(#haloGlow)" />

        {/* Beveled Outer Sovereign Shield */}
        <circle cx="50" cy="50" r="42" fill="#0D0D0D" stroke="url(#goldGrad1)" strokeWidth="3" />
        <circle cx="50" cy="50" r="37" fill="none" stroke="url(#goldGrad2)" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />

        {/* 3D Gold Ingot / Medallion Coin Core */}
        <path
          d="M32 30 L68 30 L76 46 L68 70 L32 70 L24 46 Z"
          fill="url(#goldGrad1)"
          stroke="#5C4000"
          strokeWidth="1.5"
          filter="url(#glow)"
        />

        {/* Ingot Facet Highlight Lines */}
        <path d="M32 30 L50 46 L68 30" fill="none" stroke="#FFF7D6" strokeWidth="1.5" opacity="0.9" />
        <path d="M24 46 L50 46 L76 46" fill="none" stroke="#FFF5C0" strokeWidth="1.2" opacity="0.8" />
        <path d="M32 70 L50 46 L68 70" fill="none" stroke="#8B6508" strokeWidth="1.5" opacity="0.7" />

        {/* Center Crown / Sovereign Symbol */}
        <path
          d="M40 54 L44 48 L50 52 L56 48 L60 54 L40 54 Z"
          fill="#3B2600"
          stroke="url(#goldGrad1)"
          strokeWidth="1"
        />

        {/* Center $ Symbol Emblem */}
        <text
          x="50"
          y="62"
          fontSize="14"
          fontWeight="900"
          fill="#3B2600"
          textAnchor="middle"
          fontFamily="sans-serif"
        >
          $G
        </text>

        {/* Sparkling Stars */}
        <circle cx="28" cy="28" r="2" fill="#FFF7D6" />
        <circle cx="72" cy="28" r="1.5" fill="#FFF7D6" />
        <circle cx="74" cy="68" r="2" fill="#FFF7D6" />
        <circle cx="26" cy="68" r="1.5" fill="#FFF7D6" />
      </svg>

      <div className="flex flex-col text-left">
        <span className="text-lg font-black tracking-tight text-gold-gradient leading-none uppercase">
          VIRTUAL GOLD
        </span>
        <span className="text-[9px] font-mono tracking-widest text-yellow-400 font-bold uppercase mt-0.5">
          SOVEREIGN L1 PROTOCOL
        </span>
      </div>
    </div>
  );
}
