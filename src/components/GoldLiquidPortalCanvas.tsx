'use client';

import React, { useEffect, useRef } from 'react';

export default function GoldLiquidPortalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    let angle1 = 0;
    let angle2 = 0;
    let pulseAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.38;

      angle1 += 0.012;
      angle2 -= 0.008;
      pulseAngle += 0.03;

      const pulseScale = 1 + Math.sin(pulseAngle) * 0.03;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Outer Glowing Golden Energy Ring 1
      ctx.rotate(angle1);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 18, 6, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * pulseScale, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Counter-Rotating Emerald Ring 2
      ctx.rotate(angle2 * 2);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 14, 4, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, (baseRadius - 22) * pulseScale, 0, Math.PI * 2);
      ctx.stroke();

      // Cyan Quantum Particle Ring 3
      ctx.rotate(-angle1 * 1.5);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, (baseRadius + 18) * pulseScale, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating Node Particles on Ring 1
      const nodeCount = 8;
      for (let i = 0; i < nodeCount; i++) {
        const nodeAngle = (i / nodeCount) * Math.PI * 2 + angle1;
        const nx = Math.cos(nodeAngle) * baseRadius * pulseScale;
        const ny = Math.sin(nodeAngle) * baseRadius * pulseScale;

        ctx.fillStyle = '#FFF7D6';
        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Glow flare
        const nodeGlow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 12);
        nodeGlow.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
        nodeGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = nodeGlow;
        ctx.beginPath();
        ctx.arc(nx, ny, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 w-full h-full"
    />
  );
}
