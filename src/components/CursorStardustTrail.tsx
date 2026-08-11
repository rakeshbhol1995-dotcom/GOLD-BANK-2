'use client';

import React, { useEffect, useRef } from 'react';

interface StardustParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  life: number;
  maxLife: number;
  color: string;
  isCoin?: boolean;
  angle?: number;
  spinSpeed?: number;
}

export default function CursorStardustTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let cursorRingAngle = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const particles: StardustParticle[] = [];
    const colors = ['#FFF7D6', '#FFD700', '#FFE87C', '#DAA520', '#10B981', '#22D3EE'];

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Spawn 3-4 golden stardust particles
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: mouseX + (Math.random() * 16 - 8),
          y: mouseY + (Math.random() * 16 - 8),
          size: Math.random() * 3.5 + 1.2,
          speedX: (Math.random() - 0.5) * 2,
          speedY: (Math.random() - 0.5) * 2 - 0.8,
          life: 0,
          maxLife: Math.random() * 35 + 25,
          color: colors[Math.floor(Math.random() * colors.length)],
          isCoin: Math.random() < 0.15, // 15% chance to spawn mini gold coin emblem
          angle: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 0.1
        });
      }
    };

    // Click Shockwave Burst (Golden Sparkle Explosion)
    const handleMouseClick = (e: MouseEvent) => {
      const burstCount = 28;
      for (let i = 0; i < burstCount; i++) {
        const angle = (i / burstCount) * Math.PI * 2;
        const velocity = Math.random() * 6 + 3;
        particles.push({
          x: e.clientX,
          y: e.clientY,
          size: Math.random() * 4 + 2,
          speedX: Math.cos(angle) * velocity,
          speedY: Math.sin(angle) * velocity,
          life: 0,
          maxLife: Math.random() * 45 + 30,
          color: colors[Math.floor(Math.random() * colors.length)],
          isCoin: i % 4 === 0
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleMouseClick);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      cursorRingAngle += 0.04;

      // Draw Orbiting Quantum Ring around Cursor Position
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 18, cursorRingAngle, cursorRingAngle + Math.PI * 2);
      ctx.stroke();

      // Outer Glowing Ring Pulse
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 28, -cursorRingAngle * 1.5, -cursorRingAngle * 1.5 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Render Trail Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.angle !== undefined && p.spinSpeed !== undefined) {
          p.angle += p.spinSpeed;
        }

        const progress = p.life / p.maxLife;
        const opacity = 1 - progress;

        ctx.save();
        ctx.globalAlpha = Math.max(0, opacity);

        if (p.isCoin) {
          // Draw Floating Mini Golden Medallion Coin
          ctx.translate(p.x, p.y);
          if (p.angle) ctx.rotate(p.angle);
          
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#8B6508';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          ctx.fillStyle = '#3B2600';
          ctx.font = `${Math.max(8, p.size * 2)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0.5);
        } else {
          // Draw Glowing Stardust Sparkle
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - progress * 0.4), 0, Math.PI * 2);
          ctx.fill();

          // 4-Point Star Flare for larger particles
          if (p.size > 2.2) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x - p.size * 2.8, p.y);
            ctx.lineTo(p.x + p.size * 2.8, p.y);
            ctx.moveTo(p.x, p.y - p.size * 2.8);
            ctx.lineTo(p.x, p.y + p.size * 2.8);
            ctx.stroke();
          }
        }

        ctx.restore();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleMouseClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
}
