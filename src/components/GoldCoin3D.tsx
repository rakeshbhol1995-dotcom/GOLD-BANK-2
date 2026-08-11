'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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

export const alloyConfigs: Record<AlloyType, { name: string; color: number; hex: string; metalness: number; roughness: number }> = {
  '24k':    { name: '24K Pure Gold',  color: 0xF5C518, hex: '#F5C518', metalness: 0.96, roughness: 0.18 },
  rose:     { name: 'Rose Gold',      color: 0xE8836A, hex: '#E8836A', metalness: 0.92, roughness: 0.22 },
  white:    { name: 'White Gold',     color: 0xD8D4C8, hex: '#D8D4C8', metalness: 0.94, roughness: 0.18 },
  antique:  { name: 'Antique Gold',   color: 0xC8A040, hex: '#C8A040', metalness: 0.88, roughness: 0.30 },
};

// ─── GLSL SHADERS ─────────────────────────────────────────────────────────────

const COIN_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFresnel;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 n = normalize(normalMatrix * normal);
    vNormal = n;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;

    vec3 camDir = normalize(cameraPosition - wp.xyz);
    vFresnel = pow(1.0 - clamp(dot(n, camDir), 0.0, 1.0), 2.5);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const COIN_FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFresnel;

  uniform float uTime;
  uniform sampler2D uTex;
  uniform vec3 uGold;
  uniform float uIrid;

  // Iridescent spectrum
  vec3 spectrum(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.10, 0.20);
    return a + b * cos(6.28318 * (c * t + d));
  }

  // Gold palette
  vec3 goldPalette(float t) {
    return mix(
      vec3(1.0, 0.84, 0.0),
      vec3(1.0, 0.60, 0.05),
      sin(t * 3.14) * 0.5 + 0.5
    );
  }

  void main() {
    vec4 tex = texture2D(uTex, vUv);

    // Fresnel rim glow
    vec3 rimColor = mix(vec3(1.0, 0.75, 0.0), vec3(1.0, 0.95, 0.6), vFresnel);

    // Iridescent layer driven by normal + time
    float iridAngle = dot(vNormal, vec3(0.0, 1.0, 0.0)) + uTime * 0.08;
    vec3 irid = spectrum(iridAngle) * uIrid;
    vec3 goldIrid = mix(goldPalette(iridAngle), irid, 0.28);

    // Holographic scan lines (subtle)
    float scan = sin(vUv.y * 380.0 + uTime * 4.0) * 0.018 + 0.982;

    // Circuit-trace pattern on edge
    float circuit = step(0.97, sin(vUv.x * 160.0) * sin(vUv.y * 160.0 + uTime));

    // Final composite
    vec3 col = tex.rgb * goldIrid * scan;
    col += rimColor * vFresnel * 0.55;
    col += vec3(0.8, 0.65, 0.1) * circuit * 0.2 * (1.0 - tex.a * 0.5);

    // HDR bloom prep — push bright areas past 1
    float brightness = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += col * max(brightness - 0.7, 0.0) * 0.8;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const PLASMA_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;

  void main() {
    vUv = uv;
    vPos = position;
    vec3 p = position;
    p.z += sin(p.x * 2.5 + uTime * 1.6) * 0.08
         + cos(p.y * 2.5 + uTime * 1.2) * 0.08;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const PLASMA_FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;
  uniform vec3 uColor;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float wave = sin(d * 14.0 - uTime * 3.5) * 0.5 + 0.5;
    float ring = smoothstep(0.85, 1.0, d) * (1.0 - smoothstep(1.0, 1.05, d));
    float glow = exp(-d * 3.5) * wave;
    vec3 col = uColor * (glow + ring * 0.6);
    float alpha = (glow + ring) * 0.65;
    gl_FragColor = vec4(col, alpha);
  }
`;

const HEX_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;

  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.73))), p.x);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float d = hexDist(uv * 2.2);
    float edge = smoothstep(0.95, 1.0, d);
    float inner = 1.0 - smoothstep(0.85, 0.95, d);
    float pulse = sin(uTime * 2.5) * 0.5 + 0.5;
    vec3 col = uColor * (edge * 1.5 + inner * pulse * 0.15);
    float alpha = edge * 0.9 + inner * pulse * 0.08;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── TEXTURE GENERATOR ───────────────────────────────────────────────────────

function buildCoinTexture(text: string, side: 'front' | 'back'): THREE.CanvasTexture {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

  // ── Deep metallic base ──
  const bg = c.createRadialGradient(cx - 280, cy - 280, 40, cx, cy, S * 0.52);
  bg.addColorStop(0.00, '#FFFDE0');
  bg.addColorStop(0.15, '#FFE566');
  bg.addColorStop(0.38, '#F5C518');
  bg.addColorStop(0.62, '#C8920A');
  bg.addColorStop(0.82, '#7B5500');
  bg.addColorStop(1.00, '#241800');
  c.fillStyle = bg;
  c.beginPath(); c.arc(cx, cy, S * 0.5, 0, Math.PI * 2); c.fill();

  // ── Lathe concentric rings ──
  for (let r = 60; r < S * 0.48; r += 14) {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = r % 42 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
    c.lineWidth = 1.2; c.stroke();
  }

  // ── Sacred geometry: Flower of Life ──
  c.globalAlpha = 0.07;
  const drawHex = (x: number, y: number, r: number) => {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      i === 0 ? c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
              : c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    c.closePath(); c.strokeStyle = '#FFD700'; c.lineWidth = 3; c.stroke();
  };
  const folR = 110;
  drawHex(cx, cy, folR);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    drawHex(cx + folR * Math.cos(a), cy + folR * Math.sin(a), folR);
  }
  c.globalAlpha = 1;

  // ── Milled beaded rim ──
  const BEADS = 120;
  for (let i = 0; i < BEADS; i++) {
    const a = (i / BEADS) * Math.PI * 2;
    const bx = cx + Math.cos(a) * (S * 0.445);
    const by = cy + Math.sin(a) * (S * 0.445);
    const bg2 = c.createRadialGradient(bx - 4, by - 4, 1, bx, by, 13);
    bg2.addColorStop(0, '#FFF9C4'); bg2.addColorStop(0.5, '#F5C518'); bg2.addColorStop(1, '#7B5500');
    c.beginPath(); c.arc(bx, by, 12, 0, Math.PI * 2); c.fillStyle = bg2; c.fill();
  }

  // ── Inner raised ring ──
  c.beginPath(); c.arc(cx, cy, S * 0.41, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255,230,100,0.6)'; c.lineWidth = 9; c.stroke();
  c.beginPath(); c.arc(cx, cy, S * 0.395, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(80,50,0,0.65)'; c.lineWidth = 5; c.stroke();

  if (side === 'front') {
    // ── Center sovereign medallion ──
    const medalGrad = c.createRadialGradient(cx - 60, cy - 60, 10, cx, cy, 200);
    medalGrad.addColorStop(0, '#FFFDE0'); medalGrad.addColorStop(0.3, '#FFD700');
    medalGrad.addColorStop(0.7, '#B8860B'); medalGrad.addColorStop(1, '#4A3000');
    c.beginPath(); c.arc(cx, cy - 80, 180, 0, Math.PI * 2);
    c.fillStyle = medalGrad; c.fill();
    c.beginPath(); c.arc(cx, cy - 80, 180, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,240,130,0.7)'; c.lineWidth = 7; c.stroke();

    // ── 8-pointed star burst ──
    c.save(); c.translate(cx, cy - 80);
    c.globalAlpha = 0.18;
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate((i * Math.PI) / 4);
      c.fillStyle = '#FFD700';
      c.beginPath(); c.moveTo(0, -175); c.lineTo(12, 0); c.lineTo(0, 175); c.lineTo(-12, 0);
      c.closePath(); c.fill(); c.restore();
    }
    c.globalAlpha = 1; c.restore();

    // ── Crown symbol ──
    c.font = '180px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,215,0,0.9)'; c.shadowBlur = 40;
    c.fillStyle = '#1A0F00'; c.fillText('👑', cx, cy - 82); c.shadowBlur = 0;

    // ── Arc text "IMMORTAL SOVEREIGN" ──
    const arcR = 720;
    const arcText = '✦  IMMORTAL  ·  SOVEREIGN  ·  PROTOCOL  ✦';
    c.font = 'bold 56px "Georgia", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const totalC = arcText.length;
    const span = Math.PI * 1.78;
    const startA = -Math.PI / 2 - span / 2;
    for (let i = 0; i < totalC; i++) {
      const a = startA + (i / (totalC - 1)) * span;
      c.save(); c.translate(cx + arcR * Math.cos(a), cy + arcR * Math.sin(a));
      c.rotate(a + Math.PI / 2);
      c.fillStyle = '#2B1B00'; c.shadowColor = 'rgba(255,220,80,0.5)'; c.shadowBlur = 8;
      c.fillText(arcText[i], 0, 0); c.shadowBlur = 0; c.restore();
    }

    // ── Bottom arc text ──
    const arcText2 = '·  999.9  FINE  GOLD  ·  21M  GRAMS  CAP  ·';
    const span2 = Math.PI * 1.6;
    const startA2 = Math.PI / 2 - span2 / 2;
    c.font = 'bold 48px "Georgia", serif';
    for (let i = 0; i < arcText2.length; i++) {
      const a = startA2 + (i / (arcText2.length - 1)) * span2;
      c.save(); c.translate(cx + arcR * Math.cos(a), cy + arcR * Math.sin(a));
      c.rotate(a + Math.PI / 2);
      c.fillStyle = '#3B2500'; c.fillText(arcText2[i], 0, 0); c.restore();
    }

    // ── Main engraving text ──
    const display = (text.trim() || '$GOLD').toUpperCase();
    c.font = `bold ${display.length > 8 ? 80 : 100}px "Georgia", serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // Deep emboss
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillText(display, cx + 5, cy + 160 + 5);
    // Bright highlight
    c.fillStyle = '#FFF9C4'; c.shadowColor = 'rgba(255,215,0,1)'; c.shadowBlur = 28;
    c.fillText(display, cx, cy + 160); c.shadowBlur = 0;

    // ── Blockchain hash stamp ──
    c.font = '500 36px monospace'; c.fillStyle = 'rgba(60,40,0,0.55)';
    c.fillText('0xSOVEREIGN·VAULT·RESERVE·L1', cx, cy + 290);

    // ── Micro QR-like data matrix (corner) ──
    c.save(); c.translate(700, 700); c.globalAlpha = 0.2;
    for (let r = 0; r < 8; r++) {
      for (let cc = 0; cc < 8; cc++) {
        if (Math.random() > 0.5) {
          c.fillStyle = '#FFD700';
          c.fillRect(cc * 18, r * 18, 15, 15);
        }
      }
    }
    c.globalAlpha = 1; c.restore();

  } else {
    // ── Back: Vault shield + hex grid ──
    c.globalAlpha = 0.12;
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 20; col++) {
        const hx = col * 100 + (row % 2) * 50;
        const hy = row * 86;
        drawHex(hx, hy, 44);
      }
    }
    c.globalAlpha = 1;

    // Shield
    c.font = '320px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,180,0,0.8)'; c.shadowBlur = 60;
    c.fillStyle = '#1A0F00'; c.fillText('🛡️', cx, cy - 100); c.shadowBlur = 0;

    // Vault text
    c.font = 'bold 72px Georgia'; c.fillStyle = '#2B1B00';
    c.fillText('SOVEREIGN VAULT', cx, cy + 200);
    c.font = '500 50px monospace'; c.fillStyle = 'rgba(60,40,0,0.6)';
    c.fillText('∞ RISING FLOOR RESERVE', cx, cy + 300);

    // Serial number strip
    c.fillStyle = 'rgba(40,25,0,0.4)'; c.fillRect(cx - 320, cy + 370, 640, 60);
    c.font = '500 30px monospace'; c.fillStyle = 'rgba(255,215,0,0.5)';
    c.fillText('VG·L1·' + Array(20).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(), cx, cy + 405);
  }

  // ── Specular highlight overlay ──
  const spec = c.createRadialGradient(cx - 380, cy - 380, 10, cx - 150, cy - 150, 900);
  spec.addColorStop(0, 'rgba(255,255,255,0.32)');
  spec.addColorStop(0.4, 'rgba(255,255,255,0.06)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  c.beginPath(); c.arc(cx, cy, S * 0.5, 0, Math.PI * 2);
  c.fillStyle = spec; c.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function GoldCoin3D({
  engravingText, alloy, weight, isSpinning, isSparklesActive,
  soundEnabled, onToggleSpin, onToggleSparkles, onToggleSound, onMintClick
}: GoldCoin3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const [hasWebglError, setHasWebglError] = useState(false);

  // Three.js refs
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef    = useRef<EffectComposer | null>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const coinGroupRef   = useRef<THREE.Group | null>(null);
  const coinMatRef     = useRef<THREE.ShaderMaterial | null>(null);
  const backMatRef     = useRef<THREE.ShaderMaterial | null>(null);
  const particlesRef   = useRef<THREE.Points | null>(null);
  const hexNodesRef    = useRef<THREE.Group | null>(null);
  const plasmaRef      = useRef<THREE.Mesh | null>(null);
  const plasma2Ref     = useRef<THREE.Mesh | null>(null);
  const laserBeamsRef  = useRef<THREE.Group | null>(null);
  const clockRef       = useRef(new THREE.Timer());

  const isDraggingRef  = useRef(false);
  const prevMouseRef   = useRef({ x: 0, y: 0 });
  const isFlippingRef  = useRef(false);
  const flipProg       = useRef(0);
  const isSpinRef      = useRef(isSpinning);
  const isSparkRef     = useRef(isSparklesActive);

  useEffect(() => { isSpinRef.current  = isSpinning; },    [isSpinning]);
  useEffect(() => { isSparkRef.current = isSparklesActive; }, [isSparklesActive]);

  // Sound
  const playCoinChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      [[2637, 0.22, 0.55], [1318, 0.10, 0.65], [880, 0.06, 0.7]].forEach(([freq, gain, dur]) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq as number, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime((freq as number) * 0.4, ctx.currentTime + (dur as number));
        g.gain.setValueAtTime(gain as number, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur as number));
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (dur as number));
      });
    } catch {}
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let w = el.clientWidth || 520, h = el.clientHeight || 520;

    // ─ WebGL check
    try {
      const c2 = document.createElement('canvas');
      const gl = c2.getContext('webgl');
      if (!gl) throw new Error('no webgl');
    } catch {
      setHasWebglError(true); return;
    }

    // ─ Scene / Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 300);
    camera.position.set(0, 0.5, 13);
    cameraRef.current = camera;

    // ─ Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      rendererRef.current = renderer;
      el.innerHTML = ''; el.appendChild(renderer.domElement);
    } catch {
      setHasWebglError(true); return;
    }

    // ─ Post-processing: UnrealBloom
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.55, 0.62);
    composer.addPass(bloom);
    composerRef.current = composer;

    // ─ Lights
    scene.add(new THREE.AmbientLight(0xfff8dc, 0.9));

    const key = new THREE.DirectionalLight(0xfff5aa, 5);
    key.position.set(10, 12, 8); key.castShadow = true;
    scene.add(key);

    const rim1 = new THREE.PointLight(0xffb800, 6, 30);
    rim1.position.set(-9, 3, 5); scene.add(rim1);

    const rim2 = new THREE.PointLight(0xffd700, 5, 22);
    rim2.position.set(8, -4, 6); scene.add(rim2);

    const fill = new THREE.DirectionalLight(0xffe57f, 2);
    fill.position.set(0, -6, -12); scene.add(fill);

    const pulseLightA = new THREE.PointLight(0xffa500, 4, 18);
    pulseLightA.position.set(0, 7, 2); scene.add(pulseLightA);

    const pulseLightB = new THREE.PointLight(0x00d4ff, 1.5, 12); // Cyan accent
    pulseLightB.position.set(5, -5, 3); scene.add(pulseLightB);

    // ─ Coin group
    const coinGroup = new THREE.Group();
    coinGroupRef.current = coinGroup;
    scene.add(coinGroup);

    // Textures
    const frontTex = buildCoinTexture(engravingText, 'front');
    const backTex  = buildCoinTexture(engravingText, 'back');

    const cfg = alloyConfigs[alloy];
    const goldCol = new THREE.Color(cfg.hex);

    // Front/back shader materials
    const makeShader = (tex: THREE.CanvasTexture, irid = 1.0) => new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTex:  { value: tex },
        uGold: { value: goldCol },
        uIrid: { value: irid },
      },
      vertexShader:   COIN_VERT,
      fragmentShader: COIN_FRAG,
      side: THREE.FrontSide,
    });

    const frontMat = makeShader(frontTex, 1.0);
    const backMat  = makeShader(backTex,  0.7);
    coinMatRef.current = frontMat;
    backMatRef.current = backMat;

    const sideMat = new THREE.MeshStandardMaterial({
      color: cfg.color, metalness: 0.98, roughness: 0.08,
      envMapIntensity: 1.6,
    });

    // High-poly coin (256 segments!)
    const geo = new THREE.CylinderGeometry(3.5, 3.5, 0.44, 256, 8);
    const coin = new THREE.Mesh(geo, [sideMat, frontMat, backMat]);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    coinGroup.add(coin);

    // Reeded milled edge (180 reeds)
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const rg = new THREE.BoxGeometry(0.055, 0.46, 0.15);
      const rm = new THREE.Mesh(rg, sideMat);
      rm.position.set(Math.cos(a) * 3.52, 0, Math.sin(a) * 3.52);
      rm.rotation.y = a;
      coinGroup.add(rm);
    }

    // ─ Plasma aura rings (animated shader)
    const makePlasmaRing = (radius: number, col: THREE.ColorRepresentation, opacity: number) => {
      const rg = new THREE.PlaneGeometry(radius * 2.1, radius * 2.1, 1, 1);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(col) } },
        vertexShader:   PLASMA_VERT,
        fragmentShader: PLASMA_FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(rg, mat);
      m.rotation.x = Math.PI / 2;
      return m;
    };

    const plasma1 = makePlasmaRing(5.5, 0xFFD700, 0.7);
    scene.add(plasma1); plasmaRef.current = plasma1;

    const plasma2 = makePlasmaRing(7.0, 0xFF8C00, 0.4);
    plasma2.rotation.x = Math.PI / 2 + 0.2;
    scene.add(plasma2); plasma2Ref.current = plasma2;

    // ─ Blockchain hexagon nodes (6 orbiting)
    const hexGroup = new THREE.Group();
    hexNodesRef.current = hexGroup;
    scene.add(hexGroup);

    const NODES = 6;
    const nodeUniforms: { uTime: { value: number }; uColor: { value: THREE.Color } }[] = [];

    for (let i = 0; i < NODES; i++) {
      const a = (i / NODES) * Math.PI * 2;
      const r = 6.2;
      const hg = new THREE.PlaneGeometry(1.0, 1.0);
      const hMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:  { value: 0 },
          uColor: { value: new THREE.Color(i % 2 === 0 ? 0xFFD700 : 0x00D4FF) },
        },
        vertexShader:   'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: HEX_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      nodeUniforms.push(hMat.uniforms as any);
      const hm = new THREE.Mesh(hg, hMat);
      hm.position.set(Math.cos(a) * r, Math.sin(a) * 0.5, Math.sin(a) * r);
      hexGroup.add(hm);
    }

    // ─ Laser beams between nodes
    const laserGroup = new THREE.Group();
    laserBeamsRef.current = laserGroup;
    scene.add(laserGroup);

    for (let i = 0; i < NODES; i++) {
      const a1 = (i / NODES) * Math.PI * 2;
      const a2 = ((i + 1) / NODES) * Math.PI * 2;
      const r = 6.2;
      const p1 = new THREE.Vector3(Math.cos(a1) * r, Math.sin(a1) * 0.5, Math.sin(a1) * r);
      const p2 = new THREE.Vector3(Math.cos(a2) * r, Math.sin(a2) * 0.5, Math.sin(a2) * r);
      const mid = p1.clone().lerp(p2, 0.5);
      const len = p1.distanceTo(p2);
      const lg = new THREE.CylinderGeometry(0.015, 0.015, len, 6);
      const lm = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xFFD700 : 0x00EEFF,
        transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(lg, lm);
      beam.position.copy(mid);
      beam.lookAt(p2);
      beam.rotateX(Math.PI / 2);
      laserGroup.add(beam);
    }

    // ─ DNA Helix particle system (orbiting the coin)
    const HELIX_COUNT = 300;
    const helixPos = new Float32Array(HELIX_COUNT * 3);
    const helixCol = new Float32Array(HELIX_COUNT * 3);
    for (let i = 0; i < HELIX_COUNT; i++) {
      const t = i / HELIX_COUNT;
      const a = t * Math.PI * 8;
      const strand = i % 2 === 0 ? 1 : -1;
      helixPos[i * 3]     = Math.cos(a + strand * Math.PI / 2) * 4.3;
      helixPos[i * 3 + 1] = (t - 0.5) * 10;
      helixPos[i * 3 + 2] = Math.sin(a + strand * Math.PI / 2) * 4.3;
      // Gold-to-cyan gradient
      const g = Math.pow(t, 0.5);
      helixCol[i * 3]     = 1.0;
      helixCol[i * 3 + 1] = 0.6 + g * 0.4;
      helixCol[i * 3 + 2] = g * 0.8;
    }
    const helixGeo = new THREE.BufferGeometry();
    helixGeo.setAttribute('position', new THREE.BufferAttribute(helixPos, 3));
    helixGeo.setAttribute('color',    new THREE.BufferAttribute(helixCol, 3));
    const helixMat = new THREE.PointsMaterial({
      size: 0.10, vertexColors: true, transparent: true, opacity: 0.85,
      sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    const helixPts = new THREE.Points(helixGeo, helixMat);
    particlesRef.current = helixPts;
    scene.add(helixPts);

    // ─ Ambient floating sparkle cloud
    const SPARK_COUNT = 300;
    const sparkPos = new Float32Array(SPARK_COUNT * 3);
    const sparkCol = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 5 + Math.random() * 5;
      sparkPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      sparkPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      sparkPos[i * 3 + 2] = r * Math.cos(phi);
      const g = Math.random();
      sparkCol[i * 3] = 1.0; sparkCol[i * 3 + 1] = 0.65 + g * 0.35; sparkCol[i * 3 + 2] = g * 0.3;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color',    new THREE.BufferAttribute(sparkCol, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.08, vertexColors: true, transparent: true, opacity: 0.75,
      sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    const sparkPts = new THREE.Points(sparkGeo, sparkMat);
    sparkPts.name = 'sparks';
    scene.add(sparkPts);

    // ─ Holographic grid floor
    const gridHelper = new THREE.GridHelper(28, 28, 0xFFD700, 0x3A2800);
    (gridHelper.material as THREE.Material & { transparent: boolean; opacity: number; blending: THREE.Blending }).transparent = true;
    (gridHelper.material as THREE.Material & { transparent: boolean; opacity: number; blending: THREE.Blending }).opacity = 0.18;
    (gridHelper.material as THREE.Material & { transparent: boolean; opacity: number; blending: THREE.Blending }).blending = THREE.AdditiveBlending;
    gridHelper.position.y = -5.5;
    scene.add(gridHelper);

    // ─ Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      clockRef.current.update();
      const t = clockRef.current.getElapsed();

      // Update shader uniforms
      if (coinMatRef.current) coinMatRef.current.uniforms.uTime.value = t;
      if (backMatRef.current) backMatRef.current.uniforms.uTime.value = t;
      if (plasmaRef.current)  (plasmaRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      if (plasma2Ref.current) (plasma2Ref.current.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      nodeUniforms.forEach(u => { u.uTime.value = t; });

      // Flicker lights
      pulseLightA.intensity = 3 + Math.sin(t * 6.7) * 0.8 + Math.sin(t * 11.3) * 0.4;
      pulseLightB.intensity = 1 + Math.sin(t * 4.1 + 1) * 0.5;
      pulseLightB.position.x = Math.cos(t * 0.8) * 6;
      pulseLightB.position.z = Math.sin(t * 0.8) * 6;

      // Coin group
      if (coinGroupRef.current) {
        if (isSpinRef.current && !isDraggingRef.current && !isFlippingRef.current) {
          coinGroupRef.current.rotation.y += 0.007;
        }
        // Floating bob
        if (!isFlippingRef.current) {
          coinGroupRef.current.position.y = Math.sin(t * 1.3) * 0.22;
          coinGroupRef.current.rotation.z = Math.sin(t * 0.7) * 0.025;
        }
        // Flip
        if (isFlippingRef.current) {
          flipProg.current += 0.048;
          coinGroupRef.current.rotation.y += 0.2;
          coinGroupRef.current.position.y = Math.sin(flipProg.current * Math.PI) * 2.8;
          if (flipProg.current >= 1) { isFlippingRef.current = false; flipProg.current = 0; }
        }
      }

      // Hex nodes orbit
      if (hexNodesRef.current) {
        hexNodesRef.current.rotation.y = t * 0.25;
        hexNodesRef.current.children.forEach((child, i) => {
          (child as THREE.Mesh).lookAt(camera.position);
          const pulse = Math.sin(t * 2.5 + i * 1.05) * 0.12 + 1;
          child.scale.set(pulse, pulse, pulse);
        });
      }
      if (laserBeamsRef.current) {
        laserBeamsRef.current.rotation.y = t * 0.25;
        laserBeamsRef.current.children.forEach((b, i) => {
          const m = (b as THREE.Mesh).material as THREE.MeshBasicMaterial;
          m.opacity = 0.3 + Math.sin(t * 3 + i * 0.8) * 0.25;
        });
      }

      // Plasma rings pulse
      if (plasmaRef.current) {
        const s = 1 + Math.sin(t * 1.8) * 0.08;
        plasmaRef.current.scale.set(s, s, 1);
      }
      if (plasma2Ref.current) {
        const s = 1 + Math.sin(t * 1.4 + 1) * 0.07;
        plasma2Ref.current.scale.set(s, s, 1);
        plasma2Ref.current.rotation.z = t * 0.15;
      }

      // Helix rotation
      if (particlesRef.current) {
        particlesRef.current.visible = isSparkRef.current;
        particlesRef.current.rotation.y = t * 0.4;
        const hm = particlesRef.current.material as THREE.PointsMaterial;
        hm.opacity = 0.6 + Math.sin(t * 2) * 0.25;
      }

      // Spark cloud
      const sparks = scene.getObjectByName('sparks') as THREE.Points | undefined;
      if (sparks) {
        sparks.visible = isSparkRef.current;
        sparks.rotation.y += 0.002;
        sparks.rotation.x = Math.sin(t * 0.4) * 0.1;
        (sparks.material as THREE.PointsMaterial).opacity = 0.5 + Math.sin(t * 1.8 + 0.5) * 0.25;
      }

      // Grid holographic flicker
      (gridHelper.material as THREE.Material & { opacity: number }).opacity =
        0.12 + Math.sin(t * 0.9) * 0.06;

      composer.render();
    };
    animate();

    // Resize
    const onResize = () => {
      if (!el || !rendererRef.current || !cameraRef.current || !composerRef.current) return;
      w = el.clientWidth; h = el.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      composerRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update texture
  useEffect(() => {
    if (!coinMatRef.current) return;
    const tex = buildCoinTexture(engravingText, 'front');
    coinMatRef.current.uniforms.uTex.value = tex;
    coinMatRef.current.uniformsNeedUpdate = true;
    if (coinGroupRef.current) {
      const s = 1 + (weight - 5) * 0.04;
      coinGroupRef.current.scale.set(s, s, s);
    }
  }, [engravingText, weight]);

  // Update sparkles
  useEffect(() => {
    isSparkRef.current = isSparklesActive;
  }, [isSparklesActive]);

  // Drag controls
  const onMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !coinGroupRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    coinGroupRef.current.rotation.y += dx * 0.012;
    coinGroupRef.current.rotation.x += dy * 0.008;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { isDraggingRef.current = false; };

  const handleFlip = () => {
    if (!isFlippingRef.current) {
      isFlippingRef.current = true; flipProg.current = 0; playCoinChime();
    }
  };
  const handleReset = () => {
    if (coinGroupRef.current) coinGroupRef.current.rotation.set(0, 0, 0);
    playCoinChime();
  };

  return (
    <div className="relative w-full h-[500px] sm:h-[550px] gold-glass-card border-gold-glow flex items-center justify-center overflow-hidden">

      {hasWebglError ? (
        <div className="w-full h-full flex flex-col items-center justify-center relative p-6 text-center select-none">
          <div className="absolute w-[320px] h-[320px] rounded-full bg-yellow-500/20 blur-3xl animate-pulse pointer-events-none" />
          <div className={`relative w-[240px] h-[240px] rounded-full shadow-2xl shadow-yellow-500/60 border-4 border-yellow-200
            bg-gradient-to-br from-yellow-200 via-yellow-500 to-amber-800
            ${isSpinning ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-700 via-yellow-400 to-yellow-100 p-4 border-2 border-yellow-100 flex flex-col items-center justify-center text-black shadow-inner">
              <div className="text-[10px] font-black tracking-widest uppercase text-amber-950 mb-1">24K FINE GOLD 999.9</div>
              <ShieldCheck className="w-9 h-9 text-amber-950 my-1" />
              <div className="font-mono font-black text-sm tracking-wider text-amber-950 uppercase">{engravingText || '$GOLD'}</div>
              <div className="text-[9px] font-bold text-amber-950/80 mt-1 uppercase tracking-widest">{weight}g • L1 SOVEREIGN</div>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      )}

      {/* Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/75 backdrop-blur-xl px-5 py-2.5 rounded-full border border-yellow-500/30 shadow-2xl z-10">
        <button onClick={() => { onToggleSpin(); playCoinChime(); }} title="Spin"
          className={`p-2.5 rounded-full transition-all ${isSpinning ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 'bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700'}`}>
          <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={handleFlip} title="Flip" className="p-2.5 rounded-full bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700 transition-all active:scale-95">
          <Repeat className="w-4 h-4" />
        </button>
        <button onClick={() => { onToggleSparkles(); playCoinChime(); }} title="Sparkles"
          className={`p-2.5 rounded-full transition-all ${isSparklesActive ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 'bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700'}`}>
          <Sparkles className="w-4 h-4" />
        </button>
        <button onClick={() => { onToggleSound(); playCoinChime(); }} title="Sound"
          className={`p-2.5 rounded-full transition-all ${soundEnabled ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 'bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700'}`}>
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button onClick={handleReset} title="Reset" className="p-2.5 rounded-full bg-zinc-800/80 text-yellow-400 hover:bg-zinc-700 transition-all active:scale-95">
          <Target className="w-4 h-4" />
        </button>
      </div>

      {/* Mint CTA */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => { onMintClick(); playCoinChime(); }}
          className="px-4 py-1.5 rounded-full bg-gold-gradient text-black font-bold text-xs tracking-wider uppercase shadow-lg shadow-yellow-500/40 hover:scale-105 active:scale-95 transition-all"
        >
          ★ Mint 3D Token
        </button>
      </div>

      {/* Web3 label */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-cyan-500/30">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[10px] font-bold text-cyan-300 tracking-widest uppercase">Web3 • Live</span>
      </div>
    </div>
  );
}
