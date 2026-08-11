'use client';

import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  twinkleSpeed: number;
  increasing: boolean;
}

interface Asteroid {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  length: number;
  opacity: number;
  color: string;
}

export default function GalaxyCosmosBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Generate 180 Twinkling Galaxy Stars
    const starColors = ['#FFF7D6', '#FFD700', '#FFE87C', '#FFFFFF', '#6EE7B7', '#A7F3D0'];
    const stars: Star[] = [];
    for (let i = 0; i < 180; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.9 + 0.4,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        increasing: Math.random() > 0.5
      });
    }

    // Active Falling Asteroid Shower (Continuous 4-6 Active Falling Asteroids)
    const asteroids: Asteroid[] = [];
    const createAsteroid = (): Asteroid => ({
      x: Math.random() * (width * 1.2) - width * 0.2,
      y: -Math.random() * 100,
      size: Math.random() * 2.5 + 1.5,
      speedX: Math.random() * 5 + 4,
      speedY: Math.random() * 6 + 5,
      length: Math.random() * 120 + 80,
      opacity: Math.random() * 0.7 + 0.3,
      color: Math.random() > 0.3 ? '#FFD700' : '#FFFFFF'
    });

    for (let i = 0; i < 5; i++) {
      asteroids.push(createAsteroid());
    }

    let moonAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep Galaxy Radial Nebulae
      const nebulaGrad = ctx.createRadialGradient(
        width * 0.5, height * 0.2, 50,
        width * 0.5, height * 0.5, width * 0.8
      );
      nebulaGrad.addColorStop(0, 'rgba(255, 215, 0, 0.08)');
      nebulaGrad.addColorStop(0.3, 'rgba(16, 185, 129, 0.04)');
      nebulaGrad.addColorStop(0.7, 'rgba(139, 92, 246, 0.03)');
      nebulaGrad.addColorStop(1, 'rgba(8, 11, 17, 0)');

      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Floating 3D Golden Sovereign Moon in Top Right
      const moonX = width > 768 ? width - 180 : width - 90;
      const moonY = 120;
      const moonRadius = width > 768 ? 45 : 28;

      moonAngle += 0.005;
      const floatY = Math.sin(moonAngle) * 6;

      ctx.save();
      // Outer Moon Halo Glow
      const moonGlow = ctx.createRadialGradient(moonX, moonY + floatY, moonRadius * 0.8, moonX, moonY + floatY, moonRadius * 2.5);
      moonGlow.addColorStop(0, 'rgba(255, 215, 0, 0.35)');
      moonGlow.addColorStop(0.5, 'rgba(218, 165, 32, 0.12)');
      moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY + floatY, moonRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Crescent Moon Base
      const moonGrad = ctx.createLinearGradient(moonX - moonRadius, moonY - moonRadius, moonX + moonRadius, moonY + moonRadius);
      moonGrad.addColorStop(0, '#FFF7D6');
      moonGrad.addColorStop(0.4, '#FFD700');
      moonGrad.addColorStop(0.8, '#DAA520');
      moonGrad.addColorStop(1, '#8B6508');

      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(moonX, moonY + floatY, moonRadius, 0, Math.PI * 2);
      ctx.fill();

      // Moon Crescent Shadow Cutout
      ctx.fillStyle = '#080B11';
      ctx.beginPath();
      ctx.arc(moonX - moonRadius * 0.45, moonY + floatY - moonRadius * 0.1, moonRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Twinkling Stars
      stars.forEach((star) => {
        if (star.increasing) {
          star.alpha += star.twinkleSpeed;
          if (star.alpha >= 0.95) star.increasing = false;
        } else {
          star.alpha -= star.twinkleSpeed;
          if (star.alpha <= 0.15) star.increasing = true;
        }

        ctx.save();
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        // Extra cross flare for large stars
        if (star.radius > 1.4) {
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(star.x - star.radius * 2.5, star.y);
          ctx.lineTo(star.x + star.radius * 2.5, star.y);
          ctx.moveTo(star.x, star.y - star.radius * 2.5);
          ctx.lineTo(star.x, star.y + star.radius * 2.5);
          ctx.stroke();
        }
        ctx.restore();
      });

      // Render Continuous Falling Golden Asteroids & Meteors
      asteroids.forEach((ast, idx) => {
        ctx.save();
        ctx.globalAlpha = ast.opacity;

        // Tail Gradient
        const tailX = ast.x - ast.speedX * (ast.length / 10);
        const tailY = ast.y - ast.speedY * (ast.length / 10);

        const tailGrad = ctx.createLinearGradient(ast.x, ast.y, tailX, tailY);
        tailGrad.addColorStop(0, '#FFF7D6');
        tailGrad.addColorStop(0.2, '#FFD700');
        tailGrad.addColorStop(0.6, 'rgba(218, 165, 32, 0.4)');
        tailGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');

        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = ast.size;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(ast.x, ast.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Glowing Asteroid Core Head
        ctx.fillStyle = '#FFF5C0';
        ctx.beginPath();
        ctx.arc(ast.x, ast.y, ast.size * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Move Asteroid
        ast.x += ast.speedX;
        ast.y += ast.speedY;

        // Reset when out of bounds
        if (ast.y > height + 100 || ast.x > width + 100) {
          asteroids[idx] = createAsteroid();
        }
        ctx.restore();
      });

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
      className="fixed inset-0 pointer-events-none z-0 w-full h-full"
    />
  );
}
