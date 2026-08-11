'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Repeat, Sparkles, Volume2, VolumeX, Target, ShieldCheck } from 'lucide-react';

export type AlloyType = '24k' | 'rose' | 'white' | 'antique';

interface GoldCoin3DProps {
  engravingText: string;
  alloy: AlloyType;
  weight: number;
  isSpinning: boolean;
  isSparklesActive: boolean;
  soundEnabled: boolean;
  onToggleSpin: () => void;
  onToggleSparkles: () => void;
  onToggleSound: () => void;
  onMintClick: () => void;
}

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!(gl && gl instanceof WebGLRenderingContext);
  } catch (e) {
    return false;
  }
}

export const alloyConfigs: Record<AlloyType, { name: string; color: number; hex: string; metalness: number; roughness: number }> = {
  '24k': { name: '24K Pure Gold', color: 0xF5C518, hex: '#F5C518', metalness: 0.96, roughness: 0.20 }
};

export default function GoldCoin3D({
  engravingText,
  alloy,
  weight,
  isSpinning,
  isSparklesActive,
  soundEnabled,
  onToggleSpin,
  onToggleSparkles,
  onToggleSound,
  onMintClick
}: GoldCoin3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [hasWebglError, setHasWebglError] = useState(false);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const coinGroupRef = useRef<THREE.Group | null>(null);
  const faceMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const sideMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);

  const isFlippingRef = useRef(false);
  const flipProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const isSpinningRef = useRef(isSpinning);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  // Web Audio Coin Chime Synthesizer
  const playCoinChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(4186, ctx.currentTime); // High C8 pitch chime
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Audio chime error:", e);
    }
  };

  // Helper to generate dynamic bump map canvas texture
  const createCoinTexture = (text: string, currentWeight: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Metallic Radial Gradient Base
    const grad = ctx.createRadialGradient(512, 512, 100, 512, 512, 512);
    grad.addColorStop(0, '#FFE87C');
    grad.addColorStop(0.5, '#F5C518');
    grad.addColorStop(0.85, '#B88200');
    grad.addColorStop(1, '#5C3E00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Outer Beaded Ring
    const beads = 64;
    for (let i = 0; i < beads; i++) {
      const angle = (i / beads) * Math.PI * 2;
      const x = 512 + Math.cos(angle) * 460;
      const y = 512 + Math.sin(angle) * 460;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#FFE87C';
      ctx.fill();
    }

    // Inner Concentric Engraved Border Rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(512, 512, 440, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(92, 62, 0, 0.7)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(512, 512, 420, 0, Math.PI * 2);
    ctx.stroke();

    // Emblem Star / Crown Insignia
    ctx.fillStyle = '#422B00';
    ctx.font = '900 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ IMMORTAL SOVEREIGN PROTOCOL ★', 512, 360);

    // Dynamic Engraved Custom Text
    const displayText = (text.trim() || '$GOLD L1 VAULT').toUpperCase();
    ctx.font = 'bold 56px sans-serif';
    ctx.fillStyle = '#2B1B00';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowOffsetY = 3;
    ctx.fillText(displayText, 512, 512);

    // Reset Shadow & Draw Purity Weight Stamp
    ctx.shadowColor = 'transparent';
    ctx.font = '600 34px sans-serif';
    ctx.fillStyle = '#422B00';
    ctx.fillText(`999.9 FINE GOLD • SOVEREIGN RESERVE`, 512, 640);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Initial Three.js Scene Setup
  useEffect(() => {
    if (!checkWebGLSupport()) {
      setHasWebglError(true);
      return;
    }

    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 500;
    const height = containerRef.current.clientHeight || 500;

    // Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 9.5);
    cameraRef.current = camera;

    // WebGL Renderer with Safe Fallback Guard
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      rendererRef.current = renderer;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
      }
    } catch (e) {
      console.warn("WebGL Context Creation Failed. Activating 24K Pure Gold Medallion View.", e);
      setHasWebglError(true);
      return;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    mainLight.position.set(6, 8, 7);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0xffd700, 3.5, 25);
    rimLight.position.set(-6, -4, 5);
    scene.add(rimLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.2);
    backLight.position.set(0, 0, -8);
    scene.add(backLight);

    // Coin Group
    const coinGroup = new THREE.Group();
    coinGroupRef.current = coinGroup;
    scene.add(coinGroup);

    // Texture & Materials
    const initialTexture = createCoinTexture(engravingText, weight);
    const cfg = alloyConfigs[alloy];

    const faceMat = new THREE.MeshStandardMaterial({
      map: initialTexture,
      metalness: cfg.metalness,
      roughness: cfg.roughness,
      color: cfg.color,
      bumpMap: initialTexture,
      bumpScale: 0.06
    });
    faceMatRef.current = faceMat;

    const sideMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      metalness: cfg.metalness,
      roughness: cfg.roughness + 0.1
    });
    sideMatRef.current = sideMat;

    const coinGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.35, 96, 4);
    const coinMesh = new THREE.Mesh(coinGeo, [sideMat, faceMat, faceMat]);
    coinMesh.rotation.x = Math.PI / 2; // Orient coin face upright
    coinGroup.add(coinMesh);

    // Sparkle Orbit Particle System
    const particleCount = 130;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 11;
      posArray[i + 1] = (Math.random() - 0.5) * 11;
      posArray[i + 2] = (Math.random() - 0.5) * 11;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.09,
      color: 0xffe57f,
      transparent: true,
      opacity: 0.85
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystemRef.current = particleSystem;
    scene.add(particleSystem);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (coinGroupRef.current) {
        // Auto spin
        if (isSpinningRef.current && !isDraggingRef.current && !isFlippingRef.current) {
          coinGroupRef.current.rotation.y += 0.012;
        }

        // Coin Flip Animation
        if (isFlippingRef.current) {
          flipProgressRef.current += 0.07;
          coinGroupRef.current.rotation.y += 0.28;
          coinGroupRef.current.position.y = Math.sin(flipProgressRef.current * Math.PI) * 1.6;

          if (flipProgressRef.current >= 1) {
            isFlippingRef.current = false;
            flipProgressRef.current = 0;
            coinGroupRef.current.position.y = 0;
          }
        }
      }

      if (particleSystemRef.current && particleSystemRef.current.visible) {
        particleSystemRef.current.rotation.y += 0.002;
      }

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Window Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update Dynamic Text Texture & Weight Scaling
  useEffect(() => {
    if (!faceMatRef.current) return;
    const newTexture = createCoinTexture(engravingText, weight);
    if (newTexture) {
      faceMatRef.current.map = newTexture;
      faceMatRef.current.bumpMap = newTexture;
      faceMatRef.current.needsUpdate = true;
    }

    if (coinGroupRef.current) {
      const scaleFactor = 1 + (weight - 5) * 0.04;
      coinGroupRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
  }, [engravingText, weight]);

  // Update Alloy Color & Finish
  useEffect(() => {
    const cfg = alloyConfigs[alloy];
    if (faceMatRef.current) {
      faceMatRef.current.color.setHex(cfg.color);
      faceMatRef.current.metalness = cfg.metalness;
      faceMatRef.current.roughness = cfg.roughness;
    }
    if (sideMatRef.current) {
      sideMatRef.current.color.setHex(cfg.color);
      sideMatRef.current.metalness = cfg.metalness;
      sideMatRef.current.roughness = cfg.roughness + 0.1;
    }
  }, [alloy]);

  // Toggle Sparkles Visibility
  useEffect(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.visible = isSparklesActive;
    }
  }, [isSparklesActive]);

  // Mouse & Touch Drag Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !coinGroupRef.current) return;
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;

    coinGroupRef.current.rotation.y += deltaX * 0.01;
    coinGroupRef.current.rotation.x += deltaY * 0.01;

    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleFlip = () => {
    if (!isFlippingRef.current) {
      isFlippingRef.current = true;
      flipProgressRef.current = 0;
      playCoinChime();
    }
  };

  const handleReset = () => {
    if (coinGroupRef.current) {
      coinGroupRef.current.rotation.set(0, 0, 0);
      coinGroupRef.current.position.set(0, 0, 0);
    }
    playCoinChime();
  };

  return (
    <div className="relative w-full h-[450px] sm:h-[500px] gold-glass-card border-gold-glow flex flex-col items-center justify-center overflow-hidden">
      
      {hasWebglError ? (
        /* High-Res 24K Pure Gold Medallion Canvas & CSS 3D Viewport (Zero-WebGL Fallback) */
        <div className="w-full h-full flex flex-col items-center justify-center relative p-6 text-center select-none">
          {/* Outer Pulsing Golden Halo */}
          <div className="absolute w-[280px] h-[280px] rounded-full bg-yellow-500/20 blur-2xl animate-pulse pointer-events-none" />
          
          {/* Animated 3D Spinning 24K Pure Gold Medallion Coin */}
          <div className={`relative w-[230px] h-[230px] rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-700 p-2 shadow-2xl shadow-yellow-500/40 border-4 border-yellow-200 transition-transform duration-700 ${
            isSpinning ? 'animate-[spin_10s_linear_infinite]' : ''
          }`}>
            {/* Inner Coin Rim */}
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-yellow-200 p-4 border-2 border-yellow-100 flex flex-col items-center justify-center text-black shadow-inner">
              <div className="text-[10px] font-black tracking-widest uppercase text-amber-950 mb-1">
                24K FINE GOLD 999.9
              </div>
              
              <div className="w-14 h-14 rounded-full bg-black/10 border border-amber-900/30 flex items-center justify-center my-1">
                <ShieldCheck className="w-8 h-8 text-amber-950" />
              </div>

              <div className="font-mono font-black text-xs tracking-wider text-amber-950 uppercase px-2 py-0.5 rounded bg-black/10">
                {engravingText || '$GOLD'}
              </div>

              <div className="text-[9px] font-bold text-amber-950/80 mt-1 uppercase tracking-widest">
                {weight} Grams • VIRTUAL GOLD L1
              </div>
            </div>
          </div>

          <div className="mt-4 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 z-10">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> SOVEREIGN L1 ASSET • 999.9 FINE SOVEREIGN
          </div>
        </div>
      ) : (
        /* 3D WebGL Canvas Container */
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      )}

      {/* Floating Canvas Toolbar Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/65 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/30 shadow-xl z-10">
        
        {/* Toggle Auto-Spin */}
        <button
          onClick={() => { onToggleSpin(); playCoinChime(); }}
          title="Toggle Auto Spin"
          className={`p-2.5 rounded-full transition-all ${
            isSpinning
              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
              : 'bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700'
          }`}
        >
          <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
        </button>

        {/* Flip Coin */}
        <button
          onClick={handleFlip}
          title="Flip Coin Jump"
          className="p-2.5 rounded-full bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700 transition-all active:scale-95"
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Sparkles Toggle */}
        <button
          onClick={() => { onToggleSparkles(); playCoinChime(); }}
          title="Toggle Sparkles"
          className={`p-2.5 rounded-full transition-all ${
            isSparklesActive
              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
              : 'bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Sound Chime Toggle */}
        <button
          onClick={() => { onToggleSound(); playCoinChime(); }}
          title="Toggle Sound Effects"
          className={`p-2.5 rounded-full transition-all ${
            soundEnabled
              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
              : 'bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Reset View */}
        <button
          onClick={handleReset}
          title="Reset Orientation"
          className="p-2.5 rounded-full bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700 transition-all active:scale-95"
        >
          <Target className="w-4 h-4" />
        </button>

      </div>

      {/* Mint Quick Action Overlay */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => { onMintClick(); playCoinChime(); }}
          className="px-4 py-1.5 rounded-full bg-gold-gradient text-black font-semibold text-xs tracking-wider uppercase shadow-lg shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          ★ Mint 3D Token
        </button>
      </div>

    </div>
  );
}
