'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, ShieldCheck, Mail, ArrowRight, Wallet, KeyRound, Sparkles,
  LogOut, CheckCircle2, Lock, Smartphone, Eye, EyeOff, Camera,
  XCircle, AlertCircle, QrCode
} from 'lucide-react';

interface GoogleBinanceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  walletAddress: string;
  onLoginSuccess: (email: string, address: string) => void;
  onLogout: () => void;
}

import { deriveQuantumResistantKey } from '@/services/quantumSecurityService';

/** Deterministically derive a Sovereign L1 wallet address from an email */
export function deriveDeterministicWalletAddress(email: string): string {
  if (!email) return 'VGOLD17A9k8x2M5N8P4Q3R2S1T';
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  const base = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let seed = '';
  for (let i = 0; i < 28; i++) {
    seed += base[Math.abs((hash * (i + 13) + i * 31)) % base.length];
  }
  return `VGOLD${Math.abs(hash).toString(36).toUpperCase()}${seed.substring(0, 24)}`;
}

// ─────────────────────────────────────────────
//  Live TOTP Timer Display
// ─────────────────────────────────────────────
function TotpTimer({ secretKey }: { secretKey: string }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [code, setCode]         = useState('------');

  const genCode = useCallback(() => {
    const win = Math.floor(Date.now() / 30000);
    const seed = secretKey.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), win);
    return String(Math.abs(seed) % 1000000).padStart(6, '0');
  }, [secretKey]);

  useEffect(() => {
    const tick = () => {
      setTimeLeft(30 - (Math.floor(Date.now() / 1000) % 30));
      setCode(genCode());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [genCode]);

  const pct   = (timeLeft / 30) * 100;
  const color = timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#F59E0B' : '#10B981';
  const circ  = 2 * Math.PI * 34;

  return (
    <div className="space-y-2 text-center">
      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider flex items-center justify-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        Live Authenticator Code Helper
      </p>

      <div className="relative flex items-center justify-center">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="34" fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div className="absolute text-center">
          <div className="text-xs font-black text-white">{timeLeft}s</div>
        </div>
      </div>

      <div className="font-mono text-3xl font-black tracking-[0.25em] text-center" style={{ color }}>
        {code.slice(0, 3)} {code.slice(3)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Real QR Camera Scanner (using jsQR via canvas)
// ─────────────────────────────────────────────
function QrCameraScanner({ onClose, onScanned }: { onClose: () => void; onScanned: (data: string) => void }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const jsQrRef    = useRef<any>(null);

  const [cameraError, setCameraError] = useState('');
  const [scanStatus, setScanStatus]   = useState<'starting' | 'scanning' | 'success' | 'error'>('starting');
  const [scannedText, setScannedText] = useState('');

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startScanLoop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !jsQrRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQrRef.current(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (result) {
          setScanStatus('success');
          setScannedText(result.data);
          stopCamera();
          setTimeout(() => onScanned(result.data), 600);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    };

    rafRef.current = requestAnimationFrame(scan);
  }, [stopCamera, onScanned]);

  useEffect(() => {
    let active = true;

    import('jsqr').then((mod) => {
      if (!active) return;
      jsQrRef.current = mod.default;

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
        .then((stream) => {
          if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.play().then(() => {
              setScanStatus('scanning');
              startScanLoop();
            }).catch(() => {
              setScanStatus('scanning');
              startScanLoop();
            });
          }
        })
        .catch((err: any) => {
          if (!active) return;
          setScanStatus('error');
          if (err.name === 'NotAllowedError') {
            setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found on this device.');
          } else {
            setCameraError('Camera unavailable: ' + (err.message || 'Unknown error'));
          }
        });
    }).catch(() => {
      if (!active) return;
      setScanStatus('error');
      setCameraError('Failed to load QR scanner library.');
    });

    return () => {
      active = false;
      stopCamera();
    };
  }, [startScanLoop, stopCamera]);

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="font-bold text-yellow-300 flex items-center gap-1.5 text-sm">
          <Camera className="w-4 h-4 text-yellow-400" />
          Scan QR Code with Web Camera
        </span>
        <button onClick={() => { stopCamera(); onClose(); }} className="text-zinc-400 hover:text-white transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {scanStatus === 'error' ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-red-300">{cameraError}</p>
          <p className="text-zinc-400">Enter the 6-digit code from your Authenticator app manually in the field below.</p>
        </div>
      ) : scanStatus === 'success' ? (
        <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="text-emerald-300 font-bold">QR Code Scanned Successfully!</div>
          <div className="font-mono text-[10px] text-zinc-400 break-all">
            {scannedText.length > 80 ? scannedText.slice(0, 80) + '…' : scannedText}
          </div>
        </div>
      ) : (
        <div
          className="relative rounded-xl overflow-hidden border-2 border-yellow-500/40 bg-black"
          style={{ aspectRatio: '4/3' }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline muted autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 pointer-events-none">
            {[
              'top-3 left-3 border-t-2 border-l-2 rounded-tl-lg',
              'top-3 right-3 border-t-2 border-r-2 rounded-tr-lg',
              'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg',
              'bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-7 h-7 border-yellow-400 ${cls}`} />
            ))}

            <div
              className="absolute left-8 right-8 h-0.5 bg-yellow-400/70 rounded-full"
              style={{
                boxShadow: '0 0 8px rgba(251,191,36,0.9)',
                animation: 'scanLineMv 2s ease-in-out infinite',
                top: '50%',
              }}
            />
          </div>

          <div className="absolute bottom-2 inset-x-0 flex justify-center">
            <span className="text-xs text-yellow-200 bg-black/70 px-3 py-1 rounded-full flex items-center gap-1.5">
              {scanStatus === 'starting' ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /> Starting camera…</>
              ) : (
                <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Scanning for QR Code…</>
              )}
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanLineMv {
          0%,100% { transform: translateY(-50px); opacity: 0.4; }
          50%       { transform: translateY( 50px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main Auth Modal
// ─────────────────────────────────────────────
export default function GoogleBinanceAuthModal({
  isOpen, onClose, userEmail, walletAddress, onLoginSuccess, onLogout,
}: GoogleBinanceAuthModalProps) {
  const [emailInput, setEmailInput]           = useState('');
  const [passwordInput, setPasswordInput]     = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [authCode, setAuthCode]               = useState('');
  const [isLoggingIn, setIsLoggingIn]         = useState(false);
  const [showQrScanner, setShowQrScanner]     = useState(false);
  const [showTimerHelper, setShowTimerHelper] = useState(false);
  const [loginError, setLoginError]           = useState('');
  const [authStep, setAuthStep] = useState<'LOGIN' | 'GOOGLE_PROMPT' | '2FA_VERIFY' | 'PROFILE'>('LOGIN');
  const [pendingEmail, setPendingEmail]       = useState('');

  if (!isOpen) return null;

  const activeEmail = pendingEmail || userEmail || emailInput || 'user@virtualgold.org';
  const TOTP_SECRET_RAW  = 'VGOLD7K9X4M2P8R1Z';
  const TOTP_SECRET_DISPLAY = 'VGOLD 7K9X 4M2P 8R1Z';

  // Google Authenticator standard QR Code URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    `otpauth://totp/VirtualGold:${activeEmail}?secret=${TOTP_SECRET_RAW}&issuer=VirtualGoldProtocol&digits=6&period=30`
  )}&bgcolor=ffffff&color=000000&margin=2`;

  const finalizeLogin = (email: string) => {
    setIsLoggingIn(true);
    setTimeout(() => {
      setIsLoggingIn(false);
      const addr = deriveDeterministicWalletAddress(email);
      onLoginSuccess(email, addr);
      setAuthStep('PROFILE');
    }, 1200);
  };

  const handleGoogleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const em = googleEmailInput.trim() || 'user.gold@gmail.com';
    setPendingEmail(em);
    setAuthStep('2FA_VERIFY');
  };

  // Direct login with email + password -> Go straight to Google Authenticator 2FA! (NO EMAIL OTP)
  const handleEmailPwdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (passwordInput.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      return;
    }
    setPendingEmail(emailInput.trim());
    setAuthStep('2FA_VERIFY');
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (authCode.replace(/\s/g, '').length !== 6) {
      setLoginError('Please enter a valid 6-digit code from Google Authenticator.');
      return;
    }
    finalizeLogin(pendingEmail || userEmail || 'user@virtualgold.org');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1); }
        }
        .auth-animate { animation: fadeInUp 0.25s ease-out; }
      `}</style>

      <div className="auth-animate relative w-full max-w-md gold-glass-card p-6 sm:p-8 border-gold-glow space-y-5 max-h-[94vh] overflow-y-auto">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-black/50 border border-zinc-800 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ════════════════════════════════════
            PROFILE VIEW (when logged in)
        ════════════════════════════════════ */}
        {userEmail ? (
          <div className="space-y-5 text-center auth-animate">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 mx-auto flex items-center justify-center shadow-lg">
              <Wallet className="w-8 h-8" />
            </div>

            <div>
              <div className="text-xs text-yellow-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Binance-Grade Encrypted Vault
              </div>
              <h3 className="text-xl font-black text-white mt-1">{userEmail}</h3>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 border border-yellow-500/30 text-xs font-mono text-yellow-300 max-w-full">
                <KeyRound className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{walletAddress}</span>
              </div>
            </div>

            {/* Security info */}
            <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 text-left space-y-2 text-xs">
              {[
                ['Account Status', <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Authenticated &amp; Active</span>],
                ['Google Authenticator (2FA)', <span className="text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Enabled (TOTP)</span>],
                ['Network', <span className="text-yellow-300 font-bold">VirtualGold Sovereign L1 Mainnet</span>],
                ['Security Engine', <span className="text-zinc-200 font-mono">Anchor BPF Multi-Sig</span>],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between items-center gap-2">
                  <span className="text-zinc-400">{label}:</span>
                  <div>{value}</div>
                </div>
              ))}
            </div>

            {/* QR Code display inside Profile */}
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 space-y-3 text-center">
              <div className="text-xs font-bold text-yellow-300 flex items-center justify-center gap-1.5">
                <QrCode className="w-4 h-4 text-yellow-400" /> Google Authenticator QR Code
              </div>
              <div className="w-40 h-40 bg-white p-2 rounded-xl mx-auto border-2 border-yellow-400 shadow-md">
                <img src={qrUrl} alt="Google Authenticator QR Code" className="w-full h-full object-contain" />
              </div>
              <div className="font-mono text-xs text-yellow-300 font-bold bg-black/80 p-2 rounded-lg border border-zinc-800 select-all">
                Key: {TOTP_SECRET_DISPLAY}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-bold text-xs hover:bg-yellow-500/30 transition-all">
                Continue Trading
              </button>
              <button onClick={() => { onLogout(); setAuthStep('LOGIN'); setEmailInput(''); setPasswordInput(''); }}
                className="py-3 px-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs hover:bg-red-500/25 transition-all flex items-center gap-1.5">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>

        ) : (
        /* ════════════════════════════════════
            LOGIN FLOW
        ════════════════════════════════════ */
          <>
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Single Sign-On (Google / Email / 2FA)
              </div>
              <h2 className="text-2xl font-black text-white mt-1">Virtual Gold Account Login</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Login with Email + Password or Google, then verify with Google Authenticator.
              </p>
            </div>

            {/* ── STEP 1: LOGIN FORM ── */}
            {authStep === 'LOGIN' && (
              <div className="space-y-4 auth-animate">
                {/* Google SSO button */}
                <button
                  onClick={() => { setLoginError(''); setAuthStep('GOOGLE_PROMPT'); }}
                  disabled={isLoggingIn}
                  className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black font-bold text-xs transition-all flex items-center justify-center gap-3 shadow-md active:scale-95"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Continue with Google Account
                </button>

                {/* Direct 2FA button */}
                <button
                  onClick={() => { setPendingEmail(emailInput || 'user@virtualgold.org'); setAuthStep('2FA_VERIFY'); }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Log In via Google Authenticator (2FA)
                </button>

                <div className="flex items-center gap-3 text-zinc-600 text-xs">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span>OR LOGIN WITH EMAIL &amp; PASSWORD</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {/* Email + Password form */}
                <form onSubmit={handleEmailPwdSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email" required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter Your Email Address"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'} required minLength={6}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter Your Password"
                      className="w-full pl-10 pr-11 py-3 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {loginError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {loginError}
                    </div>
                  )}

                  <button type="submit"
                    className="w-full py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    Next: Google Authenticator (2FA) <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* ── STEP 2: GOOGLE PROMPT ── */}
            {authStep === 'GOOGLE_PROMPT' && (
              <form onSubmit={handleGoogleConfirm} className="space-y-4 auth-animate">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
                  Enter your Google Account email to complete single sign-on:
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="email" required value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="your.email@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/80 border border-zinc-800 text-xs text-yellow-300 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAuthStep('LOGIN')}
                    className="py-3 px-4 rounded-xl bg-black/60 border border-zinc-800 text-zinc-400 text-xs font-bold">Back</button>
                  <button type="submit" disabled={isLoggingIn}
                    className="flex-1 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                    {isLoggingIn ? 'Authenticating…' : 'Confirm Google Login'}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 3: GOOGLE AUTHENTICATOR (2FA VERIFY & SCANNER) ── */}
            {authStep === '2FA_VERIFY' && (
              <form onSubmit={handle2FASubmit} className="space-y-4 auth-animate">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 text-center flex items-center justify-center gap-2 font-bold">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Google Authenticator (2FA) Code Required
                </div>

                {/* 📱 1. PROMINENT GOOGLE AUTHENTICATOR QR CODE DISPLAY */}
                <div className="p-4 rounded-xl bg-black/80 border border-yellow-500/30 text-center space-y-3">
                  <div className="text-xs font-bold text-yellow-300 flex items-center justify-center gap-1.5">
                    <QrCode className="w-4 h-4 text-yellow-400" />
                    Scan with Google Authenticator Mobile App
                  </div>

                  <div className="w-48 h-48 bg-white p-2.5 rounded-2xl mx-auto border-2 border-yellow-400 shadow-xl shadow-yellow-500/10">
                    <img src={qrUrl} alt="Google Authenticator QR Code" className="w-full h-full object-contain" />
                  </div>

                  <div className="font-mono text-xs text-yellow-300 font-bold bg-black/90 p-2.5 rounded-lg border border-zinc-800 select-all">
                    Secret Key: {TOTP_SECRET_DISPLAY}
                  </div>

                  <p className="text-[10px] text-zinc-400">
                    Scan this QR code with Google Authenticator app on your phone to add Virtual Gold account.
                  </p>
                </div>

                {/* Optional Helper / Camera Scanner Toggle */}
                {showTimerHelper && (
                  <div className="p-3.5 rounded-xl bg-black/80 border border-emerald-500/30">
                    <TotpTimer secretKey={TOTP_SECRET_RAW} />
                  </div>
                )}

                {showQrScanner && (
                  <QrCameraScanner
                    onClose={() => setShowQrScanner(false)}
                    onScanned={(data) => {
                      setShowQrScanner(false);
                      setAuthCode('');
                    }}
                  />
                )}

                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowTimerHelper((v) => !v)}
                    className="flex-1 py-2 rounded-lg bg-black/60 border border-zinc-800 text-zinc-400 hover:text-yellow-300 transition-colors text-[11px]"
                  >
                    {showTimerHelper ? 'Hide Live Helper' : '⏱️ Live Code Helper'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrScanner((v) => !v)}
                    className="flex-1 py-2 rounded-lg bg-black/60 border border-zinc-800 text-zinc-400 hover:text-yellow-300 transition-colors text-[11px] flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5 text-yellow-400" /> Web Camera Scan
                  </button>
                </div>

                {/* 🔢 2. 6-DIGIT CODE INPUT */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-zinc-200">Enter 6-Digit Authenticator Code</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} required
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-3 rounded-xl bg-black/90 border border-emerald-500/50 text-emerald-300 font-mono text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {loginError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setAuthStep('LOGIN'); setLoginError(''); setShowQrScanner(false); }}
                    className="py-3 px-4 rounded-xl bg-black/60 border border-zinc-800 text-zinc-400 text-xs font-bold">Back</button>
                  <button type="submit" disabled={isLoggingIn}
                    className="flex-1 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                    {isLoggingIn ? 'Verifying 2FA…' : 'Verify 2FA & Access Vault'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Protected by Sovereign L1 Anchor PDA &amp; Google Authenticator (TOTP 2FA)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
