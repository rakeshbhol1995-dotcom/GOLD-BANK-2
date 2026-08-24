'use client';

import React, { useEffect, useRef } from 'react';

interface QuantumGoldCoreCanvasProps {
  currentPrice: number;
  floorPrice: number;
}

export default function QuantumGoldCoreCanvas({ currentPrice, floorPrice }: QuantumGoldCoreCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    let height = (canvas.height = 420);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 700;
      height = canvas.height = 420;
    };
    window.addEventListener('resize', handleResize);

    // Particle system setup
    const particleCount = 120;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.5 + 1,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.2,
      orbitR: Math.random() * 160 + 40,
      color: Math.random() > 0.3 ? '#FFD700' : Math.random() > 0.5 ? '#FFA500' : '#14F195',
      alpha: Math.random() * 0.8 + 0.2
    }));

    let mouseX = width / 2;
    let mouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Outer Multi-Chain Holographic Orbit Rings
      const rings = [
        { r: 160, speed: 0.005, color: 'rgba(130, 71, 229, 0.4)', label: 'Polygon (ERC-20)' },
        { r: 120, speed: -0.008, color: 'rgba(243, 186, 47, 0.45)', label: 'BEP-20 (BSC)' },
        { r: 80, speed: 0.012, color: 'rgba(20, 241, 149, 0.5)', label: 'Solana (Anchor)' }
      ];

      rings.forEach((ring, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 12]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Orbiting node bead
        const beadAngle = time * ring.speed * 40 + idx * (Math.PI / 1.5);
        const bx = cx + Math.cos(beadAngle) * ring.r;
        const by = cy + Math.sin(beadAngle) * ring.r;

        // Glow behind node
        const glow = ctx.createRadialGradient(bx, by, 1, bx, by, 16);
        glow.addColorStop(0, ring.color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bx, by, 16, 0, Math.PI * 2);
        ctx.fill();

        // Node dot
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      });

      // 2. Liquid Gold Quantum Central Core (Pulsing Star)
      const coreR = 52 + Math.sin(time * 2) * 4;

      // Outer radial aura
      const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, coreR * 2.2);
      aura.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
      aura.addColorStop(0.4, 'rgba(255, 140, 0, 0.5)');
      aura.addColorStop(0.8, 'rgba(120, 60, 0, 0.15)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Golden core sphere gradient
      const coreGrad = ctx.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, coreR);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.2, '#FFE57F');
      coreGrad.addColorStop(0.5, '#FFC107');
      coreGrad.addColorStop(0.85, '#FF8F00');
      coreGrad.addColorStop(1, '#8F5100');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Inner Core Emblem ($GOLD)
      ctx.font = '900 24px sans-serif';
      ctx.fillStyle = '#1A0E00';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$GOLD', cx, cy);

      // 3. Floating Gold Stardust Particles
      particles.forEach((p) => {
        p.angle += p.speed * 0.02;

        // Gentle cursor magnetic attraction
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          p.x += (dx / dist) * 0.8;
          p.y += (dy / dist) * 0.8;
        }

        // Orbit drift
        p.x = cx + Math.cos(p.angle) * p.orbitR;
        p.y = cy + Math.sin(p.angle) * (p.orbitR * 0.6);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // 4. Floating Holographic Live Data Floating Pills
      ctx.font = 'bold 11px monospace';
      
      // Pill 1: Live Price
      const px1 = cx - 180 + Math.sin(time * 0.8) * 8;
      const py1 = cy - 80 + Math.cos(time * 0.8) * 5;
      drawPill(ctx, px1, py1, `⚡ 1 Gram = $${currentPrice.toFixed(2)} USDT`, '#FFD700');

      // Pill 2: Floor Price
      const px2 = cx + 110 + Math.cos(time * 0.9) * 8;
      const py2 = cy - 70 + Math.sin(time * 0.9) * 5;
      drawPill(ctx, px2, py2, `🛡️ P_floor: $${floorPrice.toFixed(4)} USDT`, '#14F195');

      // Pill 3: Multi-Chain Reserve
      const px3 = cx - 140 + Math.cos(time * 0.7) * 6;
      const py3 = cy + 110 + Math.sin(time * 0.7) * 6;
      drawPill(ctx, px3, py3, `🔒 100% Vault Reserve Collateral`, '#8247E5');

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [currentPrice, floorPrice]);

  return (
    <div className="w-full relative h-[420px] gold-glass-card border-gold-glow overflow-hidden rounded-2xl flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400 font-mono flex items-center gap-2 bg-black/60 px-4 py-1 rounded-full border border-yellow-500/20 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span>Quantum Vault Reactor Engine • Polygon • BSC • Solana</span>
      </div>
    </div>
  );
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  const metrics = ctx.measureText(text);
  const w = metrics.width + 20;
  const h = 26;

  ctx.fillStyle = 'rgba(8, 11, 17, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 13);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}
