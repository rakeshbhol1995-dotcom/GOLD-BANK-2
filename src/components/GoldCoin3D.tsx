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
  '24k':   { name: '24K Pure Gold', color: 0xFFD700, hex: '#FFD700', metalness: 1.0, roughness: 0.06 },
  rose:    { name: 'Rose Gold',     color: 0xE8836A, hex: '#E8836A', metalness: 0.95, roughness: 0.10 },
  white:   { name: 'White Gold',    color: 0xD8D4C8, hex: '#D8D4C8', metalness: 0.97, roughness: 0.07 },
  antique: { name: 'Antique Gold',  color: 0xC8A040, hex: '#C8A040', metalness: 0.90, roughness: 0.22 },
};

/* ─────────────────────────────── SHADERS ────────────────────────────────── */

/** Animated space nebula background */
const BG_VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`;
const BG_FRAG = `
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main(){
    vec2 uv = vUv;
    vec2 q = uv * 2.0 - 1.0;

    /* Deep void radial */
    float d = length(q);
    vec3 bg = mix(vec3(0.04,0.02,0.0), vec3(0.0,0.0,0.0), smoothstep(0.0,1.4,d));

    /* Nebula clouds */
    vec2 p = uv * 3.0 + vec2(uTime*0.018, uTime*0.012);
    float n = fbm(p);
    vec3 nebula = mix(
      vec3(0.35,0.18,0.0),   // warm gold
      vec3(0.12,0.04,0.22),  // deep purple
      smoothstep(0.3,0.8,n)
    );
    float cloud = smoothstep(0.38,0.72,n) * 0.45;
    bg = mix(bg, nebula, cloud * (1.0 - d*0.6));

    /* Star field */
    vec2 st = uv * 180.0;
    vec2 si = floor(st);
    float star = pow(max(0.0, 1.0 - length(fract(st)-0.5)*5.0), 8.0);
    float starN = hash(si);
    float twinkle = 0.5 + 0.5*sin(uTime*2.0 + starN*6.28);
    bg += star * twinkle * mix(vec3(1.0,0.9,0.5), vec3(0.7,0.8,1.0), starN);

    /* Central gold glow */
    float glow = exp(-d*2.2) * 0.18;
    bg += vec3(1.0, 0.72, 0.0) * glow;

    gl_FragColor = vec4(bg, 1.0);
  }
`;

/** Plasma aura ring */
const AURA_VERT = `
  varying vec2 vUv; varying vec3 vPos;
  uniform float uTime;
  void main(){
    vUv = uv; vPos = position;
    vec3 p = position;
    p.z += sin(p.x * 3.0 + uTime*2.0)*0.06 + cos(p.y*3.0+uTime*1.5)*0.06;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const AURA_FRAG = `
  varying vec2 vUv; varying vec3 vPos;
  uniform float uTime; uniform vec3 uColor; uniform float uRadius;
  void main(){
    vec2 c = vUv - 0.5;
    float d = length(c)*2.0;
    float ring = smoothstep(uRadius-0.06, uRadius, d) * (1.0-smoothstep(uRadius, uRadius+0.07, d));
    float pulse = 0.6 + 0.4*sin(uTime*3.0 + d*8.0 - atan(c.y,c.x)*3.0);
    float glow = exp(-(d-uRadius)*(d-uRadius)*120.0) * 0.7;
    vec3 col = uColor * (ring * pulse * 1.5 + glow);
    gl_FragColor = vec4(col, (ring*pulse + glow) * 0.9);
  }
`;

/** Coin edge shader (animated circuit traces) */
const EDGE_VERT = `
  varying vec2 vUv; varying vec3 vNorm; varying vec3 vWorld;
  void main(){
    vUv = uv; vNorm = normalize(normalMatrix*normal);
    vWorld = (modelMatrix*vec4(position,1.0)).xyz;
    gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;
const EDGE_FRAG = `
  varying vec2 vUv; varying vec3 vNorm; varying vec3 vWorld;
  uniform float uTime;
  void main(){
    vec3 gold1 = vec3(1.0,0.85,0.0);
    vec3 gold2 = vec3(0.8,0.55,0.0);
    float band = sin(vUv.y*140.0 + uTime*4.0)*0.5+0.5;
    float stripe = smoothstep(0.85,1.0,band);
    vec3 col = mix(gold2, gold1, stripe);
    float fresnel = pow(1.0 - abs(dot(vNorm, vec3(0,0,1))), 2.5);
    col += vec3(1.0,0.9,0.5)*fresnel*0.4;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ───────────────────────────── COIN TEXTURE ─────────────────────────────── */

function makeCoinFace(text: string, isFront: boolean): THREE.CanvasTexture {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  const cx = S / 2, cy = S / 2, R = S / 2;

  /* === BASE: deep metallic gold === */
  const base = c.createRadialGradient(cx - 320, cy - 320, 30, cx, cy, R);
  base.addColorStop(0.00, '#FFFEF0');
  base.addColorStop(0.12, '#FFE970');
  base.addColorStop(0.32, '#F5C518');
  base.addColorStop(0.58, '#C89008');
  base.addColorStop(0.78, '#7A5200');
  base.addColorStop(1.00, '#1E1000');
  c.fillStyle = base;
  c.beginPath(); c.arc(cx, cy, R - 1, 0, Math.PI * 2); c.fill();

  /* === Lathe micro-lines === */
  for (let r = 50; r < R - 20; r += 12) {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = r % 36 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)';
    c.lineWidth = 1; c.stroke();
  }

  /* === Outer milled rim (120 beads) === */
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const bx = cx + Math.cos(a) * (R - 40);
    const by = cy + Math.sin(a) * (R - 40);
    const g2 = c.createRadialGradient(bx - 3, by - 3, 1, bx, by, 12);
    g2.addColorStop(0, '#FFFAE8'); g2.addColorStop(0.5, '#F5C518'); g2.addColorStop(1, '#7A5200');
    c.beginPath(); c.arc(bx, by, 11, 0, Math.PI * 2); c.fillStyle = g2; c.fill();
  }

  /* === Double border rings === */
  [R - 72, R - 88].forEach((r, i) => {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = i === 0 ? 'rgba(255,235,100,0.65)' : 'rgba(60,35,0,0.7)';
    c.lineWidth = i === 0 ? 8 : 5; c.stroke();
  });

  if (isFront) {
    /* === Center circle === */
    const cg = c.createRadialGradient(cx - 70, cy - 70, 10, cx, cy, 230);
    cg.addColorStop(0, '#FFFFE0'); cg.addColorStop(0.25, '#FFD700');
    cg.addColorStop(0.65, '#B8860B'); cg.addColorStop(1, '#3D2500');
    c.beginPath(); c.arc(cx, cy - 50, 220, 0, Math.PI * 2);
    c.fillStyle = cg; c.fill();
    c.beginPath(); c.arc(cx, cy - 50, 220, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,240,120,0.7)'; c.lineWidth = 8; c.stroke();

    /* === 8-ray starburst (behind crown) === */
    c.save(); c.translate(cx, cy - 50); c.globalAlpha = 0.20;
    for (let i = 0; i < 16; i++) {
      const a1 = (i / 16) * Math.PI * 2;
      const a2 = a1 + Math.PI / 16;
      const r1 = 205, r2 = 80;
      c.beginPath(); c.moveTo(0, 0);
      c.lineTo(r1 * Math.cos(a1), r1 * Math.sin(a1));
      c.lineTo(r2 * Math.cos(a2), r2 * Math.sin(a2));
      c.closePath();
      c.fillStyle = i % 2 === 0 ? '#FFD700' : '#FFF8DC';
      c.fill();
    }
    c.globalAlpha = 1; c.restore();

    /* === Crown icon === */
    c.font = '210px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,200,0,1)'; c.shadowBlur = 50;
    c.fillStyle = '#18100000'; c.fillText('👑', cx + 3, cy - 47);
    // embossed effect
    c.shadowBlur = 0; c.fillStyle = '#18100088'; c.fillText('👑', cx + 3, cy - 47);

    /* === Circular arc text — TOP === */
    const topText = '⬡  IMMORTAL  SOVEREIGN  PROTOCOL  ⬡';
    const topR = 730;
    c.font = 'bold 52px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const topSpan = Math.PI * 1.72, topStart = -Math.PI / 2 - topSpan / 2;
    for (let i = 0; i < topText.length; i++) {
      const a = topStart + (i / (topText.length - 1)) * topSpan;
      c.save(); c.translate(cx + topR * Math.cos(a), cy + topR * Math.sin(a));
      c.rotate(a + Math.PI / 2);
      c.fillStyle = '#2A1800'; c.shadowColor = 'rgba(255,215,0,0.6)'; c.shadowBlur = 7;
      c.fillText(topText[i], 0, 0); c.shadowBlur = 0; c.restore();
    }

    /* === Circular arc text — BOTTOM === */
    const botText = '·  999.9  FINE  GOLD  ·  24  KARAT  ·';
    const botR = 730, botSpan = Math.PI * 1.55, botStart = Math.PI / 2 - botSpan / 2;
    c.font = 'bold 46px Georgia, serif';
    for (let i = 0; i < botText.length; i++) {
      const a = botStart + (i / (botText.length - 1)) * botSpan;
      c.save(); c.translate(cx + botR * Math.cos(a), cy + botR * Math.sin(a));
      c.rotate(a + Math.PI / 2);
      c.fillStyle = '#3A2200'; c.fillText(botText[i], 0, 0); c.restore();
    }

    /* === Main engraving text === */
    const label = (text.trim() || '$GOLD').toUpperCase();
    const fSize = label.length > 10 ? 76 : label.length > 7 ? 92 : 108;
    c.font = `900 ${fSize}px Georgia, serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // deep shadow
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(label, cx + 6, cy + 200 + 6);
    // gold fill
    const lg = c.createLinearGradient(0, cy + 165, 0, cy + 235);
    lg.addColorStop(0, '#FFFDE7'); lg.addColorStop(0.4, '#FFD700'); lg.addColorStop(1, '#A07000');
    c.fillStyle = lg;
    c.shadowColor = 'rgba(255,210,0,1)'; c.shadowBlur = 24;
    c.fillText(label, cx, cy + 200); c.shadowBlur = 0;

    /* === Purity stamp === */
    c.font = '500 40px monospace'; c.fillStyle = 'rgba(50,32,0,0.5)';
    c.fillText('SOVEREIGN  RESERVE  ·  L1  VAULT', cx, cy + 310);

  } else {
    /* ===== BACK FACE ===== */

    /* Hex grid background */
    c.globalAlpha = 0.10;
    const hexPath = (hx: number, hy: number, r: number) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        i === 0 ? c.moveTo(hx + r * Math.cos(a), hy + r * Math.sin(a))
                : c.lineTo(hx + r * Math.cos(a), hy + r * Math.sin(a));
      }
      c.closePath(); c.strokeStyle = '#FFD700'; c.lineWidth = 3; c.stroke();
    };
    for (let row = -1; row < 13; row++) {
      for (let col = -1; col < 13; col++) {
        const hr = 88;
        const hx2 = col * hr * 1.73 + (row % 2) * hr * 0.87;
        const hy2 = row * hr * 1.5;
        hexPath(hx2, hy2, hr * 0.9);
      }
    }
    c.globalAlpha = 1;

    /* Shield */
    c.font = '340px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,180,0,0.9)'; c.shadowBlur = 70;
    c.fillStyle = '#100800'; c.fillText('🛡️', cx, cy - 80);
    c.shadowBlur = 0;

    /* Texts */
    c.font = 'bold 78px Georgia'; c.fillStyle = '#2A1800';
    c.fillText('VAULT  RESERVE', cx, cy + 220);
    c.font = '500 50px monospace'; c.fillStyle = 'rgba(60,38,0,0.55)';
    c.fillText('21 MILLION  GRAMS  CAP', cx, cy + 315);
    c.font = '38px monospace'; c.fillStyle = 'rgba(255,215,0,0.35)';
    c.fillText('∞  RISING  FLOOR  PRICE', cx, cy + 385);
  }

  /* === Specular top-left highlight === */
  const shine = c.createRadialGradient(cx - 400, cy - 400, 0, cx - 180, cy - 180, 1000);
  shine.addColorStop(0, 'rgba(255,255,255,0.30)');
  shine.addColorStop(0.3, 'rgba(255,255,255,0.06)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  c.beginPath(); c.arc(cx, cy, R - 2, 0, Math.PI * 2);
  c.fillStyle = shine; c.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────────── */

export default function GoldCoin3D({
  engravingText, alloy, weight, isSpinning, isSparklesActive,
  soundEnabled, onToggleSpin, onToggleSparkles, onToggleSound, onMintClick
}: GoldCoin3DProps) {
  const wrapRef       = useRef<HTMLDivElement>(null);
  const audioRef      = useRef<AudioContext | null>(null);
  const [noWebGL, setNoWebGL] = useState(false);

  const rendRef    = useRef<THREE.WebGLRenderer | null>(null);
  const compRef    = useRef<EffectComposer | null>(null);
  const camRef     = useRef<THREE.PerspectiveCamera | null>(null);
  const coinGrpRef = useRef<THREE.Group | null>(null);
  const frontMatRef= useRef<THREE.MeshPhysicalMaterial | null>(null);
  const backMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const sideUniRef = useRef<{ uTime: { value: number } } | null>(null);
  const auraRefsRef= useRef<THREE.ShaderMaterial[]>([]);
  const timerRef   = useRef(new THREE.Timer());

  const dragging   = useRef(false);
  const prevMouse  = useRef({ x: 0, y: 0 });
  const flipping   = useRef(false);
  const flipP      = useRef(0);
  const spinRef    = useRef(isSpinning);
  const sparkRef   = useRef(isSparklesActive);
  const sparkObjs  = useRef<THREE.Object3D[]>([]);

  useEffect(() => { spinRef.current  = isSpinning;      }, [isSpinning]);
  useEffect(() => { sparkRef.current = isSparklesActive; }, [isSparklesActive]);

  /* Sound */
  const chime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioRef.current = new AC();
      }
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      [
        { f: 2093, g: 0.20, d: 0.6 },
        { f: 1318, g: 0.10, d: 0.7 },
        { f:  659, g: 0.06, d: 0.8 },
      ].forEach(({ f, g, d }) => {
        const o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(f * 0.35, ctx.currentTime + d);
        gn.gain.setValueAtTime(g, ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
        o.connect(gn); gn.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + d);
      });
    } catch {}
  };

  /* ─ INIT ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let W = el.clientWidth || 520, H = el.clientHeight || 540;

    /* WebGL check */
    try {
      const tmp = document.createElement('canvas');
      if (!tmp.getContext('webgl')) throw 0;
    } catch { setNoWebGL(true); return; }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 300);
    camera.position.set(0, 0.4, 11.5);
    camRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      rendRef.current = renderer;
      el.innerHTML = ''; el.appendChild(renderer.domElement);
    } catch { setNoWebGL(true); return; }

    /* Post-processing */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.32, 0.40, 0.85);
    composer.addPass(bloom);
    compRef.current = composer;

    /* ── FULLSCREEN BG QUAD ── */
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      depthWrite: false,
    });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bgMesh.frustumCulled = false;
    bgMesh.renderOrder = -999;
    // Render in a separate orthographic pass
    const bgScene = new THREE.Scene();
    const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bgScene.add(bgMesh);

    /* ── PROCEDURAL ENV MAP (for reflections) ── */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x201000);
    // Add colored lights to env scene so the coin reflects them
    [
      { col: 0xFFD700, pos: [5, 8, 5], int: 4 },
      { col: 0xFF8C00, pos: [-6, 3, 4], int: 2.5 },
      { col: 0xFFFFAA, pos: [0, -6, -5], int: 2 },
      { col: 0x003366, pos: [0, 10, -10], int: 1.5 },
    ].forEach(({ col, pos, int }) => {
      const l = new THREE.PointLight(col, int, 50);
      l.position.set(pos[0], pos[1], pos[2]);
      envScene.add(l);
    });
    const envTex = pmrem.fromScene(envScene).texture;

    /* ── LIGHTING (main scene) ── */
    scene.add(new THREE.AmbientLight(0xfff8dc, 0.55));

    const keyLight = new THREE.DirectionalLight(0xfff4c2, 2.6);
    keyLight.position.set(10, 14, 10); keyLight.castShadow = true;
    scene.add(keyLight);

    // Orbiting colored rim lights
    const orbitLights: { mesh: THREE.Mesh; light: THREE.PointLight; speed: number; radius: number; offset: number }[] = [];
    const orbitDefs = [
      { col: 0xFFAA00, int: 3.2, r: 10, spd: 0.5, off: 0 },
      { col: 0xFF6600, int: 2.2, r: 9,  spd: 0.4, off: Math.PI },
      { col: 0xFFEE88, int: 1.8, r: 8,  spd: 0.6, off: Math.PI / 2 },
    ];
    orbitDefs.forEach(({ col, int, r, spd, off }) => {
      const light = new THREE.PointLight(col, int, 25);
      // Visible sphere for the light
      const indicator = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 })
      );
      light.add(indicator);
      scene.add(light);
      orbitLights.push({ mesh: indicator, light, speed: spd, radius: r, offset: off });
    });

    /* ── COIN GROUP ── */
    const coinGroup = new THREE.Group();
    coinGrpRef.current = coinGroup;
    scene.add(coinGroup);

    const cfg = alloyConfigs[alloy];
    const frontTex = makeCoinFace(engravingText, true);
    const backTex  = makeCoinFace(engravingText, false);

    // PBR face materials (MeshPhysicalMaterial = iridescence + clearcoat)
    const makeFaceMat = (map: THREE.CanvasTexture) => new THREE.MeshPhysicalMaterial({
      map,
      color: cfg.color,
      metalness: 1.0,
      roughness: 0.07,
      iridescence: 0.85,
      iridescenceIOR: 1.5,
      iridescenceThicknessRange: [80, 500] as [number, number],
      clearcoat: 0.8,
      clearcoatRoughness: 0.04,
      envMap: envTex,
      envMapIntensity: 2.8,
      bumpMap: map,
      bumpScale: 0.025,
    });
    const frontMat = makeFaceMat(frontTex);
    const backMat  = makeFaceMat(backTex);
    frontMatRef.current = frontMat;
    backMatRef.current  = backMat;

    // Edge — animated shader
    const edgeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
    });
    sideUniRef.current = edgeMat.uniforms as any;

    // High-poly coin (256 segments)
    const geo = new THREE.CylinderGeometry(3.5, 3.5, 0.46, 256, 6);
    const coin = new THREE.Mesh(geo, [edgeMat, frontMat, backMat]);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    coinGroup.add(coin);

    // Reeded milled edge
    const reedMat = new THREE.MeshPhysicalMaterial({ color: cfg.color, metalness: 1.0, roughness: 0.08, envMap: envTex, envMapIntensity: 2.0 });
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      const rg = new THREE.BoxGeometry(0.05, 0.48, 0.14);
      const rm = new THREE.Mesh(rg, reedMat);
      rm.position.set(Math.cos(a) * 3.52, 0, Math.sin(a) * 3.52);
      rm.rotation.y = a;
      coinGroup.add(rm);
    }

    /* ── AURA PLASMA RINGS ── */
    const auraConfigs = [
      { r: 0.90, radius: 0.88, col: new THREE.Color(0xFFD700), scale: 5.5, rotX: Math.PI / 2 },
      { r: 0.85, radius: 0.88, col: new THREE.Color(0xFF8800), scale: 7.0, rotX: Math.PI / 2 + 0.3 },
      { r: 0.80, radius: 0.88, col: new THREE.Color(0xFFAA33), scale: 8.8, rotX: Math.PI / 2 - 0.2 },
    ];
    auraRefsRef.current = [];
    auraConfigs.forEach(({ radius, col, scale, rotX }) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:   { value: 0 },
          uColor:  { value: col },
          uRadius: { value: radius },
        },
        vertexShader:   AURA_VERT,
        fragmentShader: AURA_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      auraRefsRef.current.push(mat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), mat);
      mesh.rotation.x = rotX;
      scene.add(mesh);
    });

    /* ── ORBITAL PARTICLE RINGS (Saturn-style) ── */
    const makeRing = (count: number, r: number, spread: number, col1: THREE.Color, col2: THREE.Color, tiltX = 0, tiltZ = 0) => {
      const pos = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes  = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * spread;
        const rr = r + jitter;
        pos[i*3]   = Math.cos(a) * rr;
        pos[i*3+1] = (Math.random() - 0.5) * spread * 0.4;
        pos[i*3+2] = Math.sin(a) * rr;
        const t = Math.random();
        const c = col1.clone().lerp(col2, t);
        colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
        sizes[i] = 0.05 + Math.random() * 0.12;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      const m = new THREE.PointsMaterial({
        size: 0.10, vertexColors: true, transparent: true, opacity: 0.85,
        sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const pts = new THREE.Points(g, m);
      pts.rotation.x = tiltX;
      pts.rotation.z = tiltZ;
      scene.add(pts);
      sparkObjs.current.push(pts);
      return pts;
    };

    const gold  = new THREE.Color(0xFFD700);
    const amber = new THREE.Color(0xFF8800);
    const white = new THREE.Color(0xFFFFCC);
    const cyan  = new THREE.Color(0x00EEFF);

    const ring1 = makeRing(900, 5.2, 0.5, gold,  amber, 0.15, 0.08);
    const ring2 = makeRing(600, 6.8, 0.4, amber, white, -0.2, 0.12);
    const ring3 = makeRing(400, 8.2, 0.3, white, cyan,  0.08, -0.15);

    /* ── GOLDEN LIGHT PILLARS (vertical laser columns) ── */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 6.5, z = Math.sin(a) * 6.5;
      const pillarGeo = new THREE.CylinderGeometry(0.018, 0.018, 14, 6);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xFFD700 : 0xFF8800,
        transparent: true, opacity: 0.18 + Math.random() * 0.12,
        blending: THREE.AdditiveBlending,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 0, z);
      scene.add(pillar);
    }

    /* ── FLOATING CRYPTO DUST ── */
    const dustCount = 250;
    const dustPos = new Float32Array(dustCount * 3);
    const dustCol = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 4 + Math.random() * 7;
      dustPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      dustPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      dustPos[i*3+2] = r * Math.cos(phi);
      const t = Math.random();
      dustCol[i*3] = 1; dustCol[i*3+1] = 0.7 + t * 0.3; dustCol[i*3+2] = t * 0.2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color',    new THREE.BufferAttribute(dustCol, 3));
    const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      size: 0.07, vertexColors: true, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    scene.add(dustPts);
    sparkObjs.current.push(dustPts);

    /* ── ANIMATION LOOP ── */
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      timerRef.current.update();
      const t = timerRef.current.getElapsed();

      // Orbiting lights
      orbitLights.forEach(({ light, speed, radius, offset }) => {
        const a = t * speed + offset;
        light.position.set(Math.cos(a) * radius, Math.sin(a * 0.5) * 3, Math.sin(a) * radius);
        light.intensity = 4 + Math.sin(t * 4 + offset) * 1.5;
      });

      // Background time
      bgMat.uniforms.uTime.value = t;

      // Edge shader time
      if (sideUniRef.current) sideUniRef.current.uTime.value = t;

      // Aura rings
      auraRefsRef.current.forEach((mat, i) => {
        mat.uniforms.uTime.value = t;
      });

      // Coin group simple, clean, smooth rotation & interactive mouse parallax levitation
      if (coinGrpRef.current) {
        if (!dragging.current && !flipping.current) {
          if (spinRef.current) {
            coinGrpRef.current.rotation.y += 0.009; // Smooth steady Y-axis rotation
          }
          // Interactive smooth parallax tilt following cursor
          coinGrpRef.current.rotation.x += (targetTilt.current.x - coinGrpRef.current.rotation.x) * 0.05;
          coinGrpRef.current.rotation.z += (targetTilt.current.y - coinGrpRef.current.rotation.z) * 0.05;
          coinGrpRef.current.position.y = Math.sin(t * 1.2) * 0.12; // Gentle floating bob
        }

        if (flipping.current) {
          flipP.current += 0.04;
          coinGrpRef.current.rotation.y += 0.20;
          coinGrpRef.current.position.y = Math.sin(flipP.current * Math.PI) * 2.2;
          if (flipP.current >= 1) {
            flipping.current = false;
            flipP.current = 0;
            coinGrpRef.current.rotation.x = 0.15;
          }
        }
      }

      // Hide particle ring clutter for a clean, sleek look
      [ring1, ring2, ring3].forEach((r) => {
        r.visible = false;
      });
      dustPts.visible = false;
      dustPts.rotation.y += 0.0015;
      dustPts.visible = sparkRef.current;
      (dustPts.material as THREE.PointsMaterial).opacity = 0.5 + Math.sin(t * 2.2) * 0.2;

      // Render background first (orthographic, no depth)
      renderer.autoClear = false;
      renderer.clear();
      renderer.render(bgScene, bgCam);
      composer.render();
    };
    animate();

    /* Resize */
    const onResize = () => {
      if (!el || !rendRef.current || !camRef.current || !compRef.current) return;
      W = el.clientWidth; H = el.clientHeight;
      camRef.current.aspect = W / H;
      camRef.current.updateProjectionMatrix();
      rendRef.current.setSize(W, H);
      compRef.current.setSize(W, H);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      pmrem.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Update texture on text change */
  useEffect(() => {
    if (!frontMatRef.current) return;
    const tex = makeCoinFace(engravingText, true);
    frontMatRef.current.map = tex;
    frontMatRef.current.bumpMap = tex;
    frontMatRef.current.needsUpdate = true;
    if (coinGrpRef.current) {
      const s = 1 + (weight - 5) * 0.04;
      coinGrpRef.current.scale.set(s, s, s);
    }
  }, [engravingText, weight]);

  /* Update alloy */
  useEffect(() => {
    const cfg = alloyConfigs[alloy];
    [frontMatRef.current, backMatRef.current].forEach(m => {
      if (!m) return;
      m.color.setHex(cfg.color);
      m.metalness  = cfg.metalness;
      m.roughness  = cfg.roughness;
      m.needsUpdate = true;
    });
  }, [alloy]);

  /* Interactive Mouse Hover Parallax Tilt */
  const mousePos   = useRef({ x: 0, y: 0 });
  const targetTilt = useRef({ x: 0.15, y: 0 });

  const onDown = (e: React.MouseEvent) => { dragging.current = true; prevMouse.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.MouseEvent) => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetTilt.current = { x: 0.15 - ny * 0.35, y: nx * 0.45 };
    }
    if (!dragging.current || !coinGrpRef.current) return;
    const dx = e.clientX - prevMouse.current.x, dy = e.clientY - prevMouse.current.y;
    coinGrpRef.current.rotation.y += dx * 0.012;
    coinGrpRef.current.rotation.x += dy * 0.008;
    prevMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { dragging.current = false; };
  const onMouseLeaveWrap = () => {
    dragging.current = false;
    targetTilt.current = { x: 0.15, y: 0 };
  };

  const doFlip = () => { if (!flipping.current) { flipping.current = true; flipP.current = 0; chime(); } };
  const doReset = () => { if (coinGrpRef.current) coinGrpRef.current.rotation.set(0.15, 0, 0); chime(); };

  return (
    <div className="relative w-full h-[500px] sm:h-[560px] gold-glass-card border-gold-glow flex items-center justify-center overflow-hidden rounded-2xl group">
      
      {/* Floating Holographic 3D HUD Badges Overlay */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none transition-all duration-300 group-hover:scale-105">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-yellow-500/40 backdrop-blur-md text-[11px] font-black text-yellow-300 flex items-center gap-1.5 shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>1 Gram = $10.00 USDT</span>
        </div>
      </div>

      <div className="absolute top-4 right-20 z-20 pointer-events-none transition-all duration-300 group-hover:scale-105 hidden sm:block">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-emerald-500/40 backdrop-blur-md text-[11px] font-black text-emerald-400 flex items-center gap-1.5 shadow-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>P_floor: $9.80 USDT</span>
        </div>
      </div>

      <div className="absolute bottom-16 left-4 z-20 pointer-events-none transition-all duration-300 group-hover:scale-105 hidden md:block">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-yellow-500/30 backdrop-blur-md text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 shadow-lg">
          <span>🏆 24K Pure Fine Gold (999.9)</span>
        </div>
      </div>

      <div className="absolute bottom-16 right-4 z-20 pointer-events-none transition-all duration-300 group-hover:scale-105 hidden md:block">
        <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-yellow-500/30 backdrop-blur-md text-[10px] font-bold text-yellow-400 flex items-center gap-1.5 shadow-lg">
          <span>🔒 100% Vault Collateral Backed</span>
        </div>
      </div>

      {noWebGL ? (
        <div className="w-full h-full flex flex-col items-center justify-center relative select-none">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0e00] via-[#0d0800] to-black" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-yellow-500/15 blur-3xl animate-pulse" />
          <div className={`relative z-10 w-[220px] h-[220px] rounded-full shadow-2xl shadow-yellow-500/60 border-4 border-yellow-300/50
            bg-gradient-to-br from-yellow-200 via-yellow-500 to-amber-800
            ${isSpinning ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-700 via-yellow-400 to-yellow-100 p-3 flex flex-col items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-amber-950 mb-1" />
              <div className="font-black text-sm text-amber-950 uppercase tracking-widest">{engravingText || '$GOLD'}</div>
              <div className="text-[9px] font-bold text-amber-950/70 mt-1 uppercase">999.9 • {weight}g</div>
            </div>
          </div>
          <div className="relative z-10 mt-4 text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> SOVEREIGN L1 ASSET
          </div>
        </div>
      ) : (
        <div ref={wrapRef} className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onMouseLeaveWrap} />
      )}

      {/* Controls */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5
        bg-black/70 backdrop-blur-xl px-5 py-3 rounded-full
        border border-yellow-500/25 shadow-2xl shadow-black/60 z-10">
        {[
          { onClick: () => { onToggleSpin(); chime(); }, title: 'Spin', active: isSpinning, icon: <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} /> },
          { onClick: doFlip,  title: 'Flip',  active: false, icon: <Repeat    className="w-4 h-4" /> },
          { onClick: () => { onToggleSparkles(); chime(); }, title: 'Orbits', active: isSparklesActive, icon: <Sparkles className="w-4 h-4" /> },
          { onClick: () => { onToggleSound(); chime(); },   title: 'Sound',  active: soundEnabled, icon: soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" /> },
          { onClick: doReset, title: 'Reset', active: false, icon: <Target   className="w-4 h-4" /> },
        ].map(({ onClick, title, active, icon }) => (
          <button key={title} onClick={onClick} title={title}
            className={`p-2.5 rounded-full transition-all duration-200 ${
              active
                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50 scale-110'
                : 'bg-white/5 text-yellow-400 hover:bg-white/10 hover:scale-105 active:scale-95'
            }`}>
            {icon}
          </button>
        ))}
      </div>

      {/* Mint button */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={() => { onMintClick(); chime(); }}
          className="px-4 py-1.5 rounded-full bg-gold-gradient text-black font-bold text-xs
            tracking-wider uppercase shadow-lg shadow-yellow-500/40
            hover:scale-105 active:scale-95 transition-all duration-200">
          ✦ Mint Token
        </button>
      </div>

      {/* Live badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5
        bg-black/55 backdrop-blur-lg px-3 py-1.5 rounded-full
        border border-yellow-500/25 shadow-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
        </span>
        <span className="text-[10px] font-bold text-yellow-300 tracking-widest uppercase">24K Live</span>
      </div>
    </div>
  );
}
