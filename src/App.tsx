import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Copy, 
  Check, 
  QrCode, 
  Wifi, 
  WifiOff, 
  FolderUp, 
  Download, 
  RefreshCw, 
  File, 
  Video, 
  Image, 
  Music, 
  Globe, 
  ShieldCheck, 
  ServerOff, 
  X, 
  XCircle, 
  Users, 
  ArrowRight,
  ShieldAlert,
  HardDriveUpload,
  Clock,
  Play,
  Pause,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

import { usePeer } from './hooks/usePeer';
import { formatBytes, formatSpeed, formatTimeLeft, checkBrowserCompatibility } from './utils/helpers';
import { FileTransfer } from './types';

export default function App() {
  const {
    roomCode,
    isHost,
    peers,
    transfers,
    peerError,
    isInitializing,
    signalingStatus,
    createRoom,
    joinRoom,
    sendFile,
    togglePauseTransfer,
    cancelTransfer,
    retryTransfer,
    clearCompletedTransfers,
    leaveRoom
  } = usePeer();

  const [inputCode, setInputCode] = useState<string>('');
  const [createRipples, setCreateRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const [joinRipples, setJoinRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  const handleCreateRoomClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCreateRipples(prev => [...prev, { id: Date.now() + Math.random(), x, y, size }]);
    createRoom();
  };

  const handleJoinRoomClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!inputCode.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setJoinRipples(prev => [...prev, { id: Date.now() + Math.random(), x, y, size }]);
    joinRoom(inputCode);
  };

  const [copied, setCopied] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [compatReport, setCompatReport] = useState<ReturnType<typeof checkBrowserCompatibility> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Perform browser checks on startup
  useEffect(() => {
    setCompatReport(checkBrowserCompatibility());
  }, []);

  // Check URL query parameters for direct-joining
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom && !roomCode && !isInitializing) {
      joinRoom(urlRoom);
    }
  }, []);

  // Quick reset for button click interactions
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Generate invite QR Code data url dynamically
  useEffect(() => {
    if (roomCode) {
      const shareUrl = `${window.location.origin}/?room=${roomCode}`;
      QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 1,
        color: {
          dark: '#050508', // pure midnight black body background
          light: '#38bdf8', // sky-400 theme base border
        },
      })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('Error rendering QR code', err));
    }
  }, [roomCode]);

  // Invoked to copy sharing link to clipboard
  const copyRoomLink = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}/?room=${roomCode}`;
    
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => setCopied(true))
        .catch(() => copyFallback(shareUrl));
    } else {
      copyFallback(shareUrl);
    }
  };

  const copyFallback = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
    } catch (err) {
      console.error('Fallback clipboard copy write failed:', err);
    }
    document.body.removeChild(textArea);
  };

  // Drag Event Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files) as File[];
      sendMultipleFiles(filesList);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesList = Array.from(e.target.files) as File[];
      sendMultipleFiles(filesList);
    }
  };

  const sendMultipleFiles = async (files: File[]) => {
    for (const f of files) {
      await sendFile(f);
    }
  };

  const selectFilesManually = () => {
    fileInputRef.current?.click();
  };

  // Helper utility to calculate responsive item icons
  const getFileIcon = (mime: string, name: string) => {
    const combined = `${mime} ${name}`.toLowerCase();
    if (combined.includes('image/') || combined.includes('.png') || combined.includes('.jpg') || combined.includes('.webp') || combined.includes('.svg')) {
      return <Image className="w-8 h-8 text-sky-400" id="file-icon-img" />;
    }
    if (combined.includes('video/') || combined.includes('.mp4') || combined.includes('.mov') || combined.includes('.mkv')) {
      return <Video className="w-8 h-8 text-purple-400" id="file-icon-vid" />;
    }
    if (combined.includes('audio/') || combined.includes('.mp3') || combined.includes('.wav') || combined.includes('.ogg')) {
      return <Music className="w-8 h-8 text-emerald-400" id="file-icon-music" />;
    }
    return <File className="w-8 h-8 text-slate-400" id="file-icon-generic" />;
  };

  // Visual Helper: Render Signaling Status tag
  const getSignalingStatusElement = () => {
    switch (signalingStatus) {
      case 'connected':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono font-medium text-emerald-400 uppercase tracking-widest" id="signaling-online">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Broker Online
          </div>
        );
      case 'connecting':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono font-medium text-amber-400 uppercase tracking-widest" id="signaling-connecting">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            Contacting Broker
          </div>
        );
      case 'reconnecting':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono font-medium text-indigo-400 uppercase tracking-widest animate-pulse" id="signaling-reconnecting">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            Bridging Network
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] font-mono font-medium text-red-500 uppercase tracking-widest" id="signaling-offline">
            <WifiOff className="w-3 h-3 text-red-500" />
            Broker Offline
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 flex flex-col justify-between tracking-tight relative overflow-x-hidden font-sans select-none" id="quickdrop-app">
      
      {/* Decorative Blur Vectors */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Signaling Status Column */}
      <div className="w-full max-w-4xl mx-auto px-4 pt-4 flex justify-between items-center relative z-20" id="network-stat-rail">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-500 uppercase">SIGNAL:</span>
          {getSignalingStatusElement()}
        </div>
        
        {/* Simple Peer Counter Badge */}
        {roomCode && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono font-semibold text-slate-400">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Peers: {peers.length}</span>
          </div>
        )}
      </div>

      {/* Main App Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center relative z-10" id="main-content">
        
        {/* Simple Brand Header (Rendered on Active Rooms to preserve branding, hidden on Main Landing) */}
        {roomCode && (
          <header className="text-center mb-6" id="brand-header">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/10" id="logo-icon-box">
                <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <h1 className="text-xl font-display font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300 font-sans" id="app-title">
                QuickDrop
              </h1>
            </div>
          </header>
        )}

        {/* Browser compatibility prompt banner */}
        {compatReport && !compatReport.isFullyCompatible && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 shadow-lg"
            id="compat-warning-rail"
          >
            <div className="flex gap-3">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300 uppercase tracking-wider text-[11px] font-mono">Sandbox Limits</p>
                <div className="mt-1 space-y-1">
                  {compatReport.warnings.map((w, idx) => (
                    <p key={idx} className="leading-relaxed">• {w}</p>
                  ))}
                </div>
                <p className="mt-2 text-amber-400/80 leading-relaxed font-mono">
                  Make sure you are utilizing a secure connection (HTTPS) and a modern browser (Safari, Firefox, Chrome).
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Global Error Banner */}
        <AnimatePresence>
          {peerError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-950/40 border border-red-850/50 rounded-2xl p-4 mb-6 flex gap-3 text-sm text-red-200 shadow-xl items-start"
              id="error-banner"
            >
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300 uppercase tracking-wider text-xs font-mono">WebRTC Negotiation Terminated</p>
                <p className="text-red-400/90 mt-1 leading-relaxed text-xs">{peerError}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Switch Board Workspace */}
        <AnimatePresence mode="wait">
          
          {/* LANDING SECTION */}
          {!roomCode && !isInitializing && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-6"
              id="landing-container"
            >
              {/* BRAND HERO SECTION */}
              <div className="text-center max-w-3xl mx-auto mb-6 px-4" id="landing-hero">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/20 mb-6 rounded-full text-[10px] font-mono font-semibold tracking-wider text-sky-400 uppercase" id="hero-badge">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  E2E WebRTC Direct Streaming Engine
                </div>

                <h1 className="text-4.5xl sm:text-5.5xl md:text-6.5xl font-display font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-slate-400 leading-tight mb-4" id="hero-title">
                  Fast, Private File Sharing
                </h1>
                
                <p className="text-slate-400 text-sm sm:text-base md:text-md max-w-xl mx-auto leading-relaxed" id="hero-subtitle">
                  Transfer files directly between devices. No accounts. No cloud uploads.
                </p>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-6" id="trust-badges">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[11px] font-medium text-slate-300 shadow-xs hover:bg-white/[0.06] transition-colors">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span>Peer-to-Peer</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[11px] font-medium text-slate-300 shadow-xs hover:bg-white/[0.06] transition-colors">
                    <ServerOff className="w-3.5 h-3.5 text-purple-400" />
                    <span>No Cloud Storage</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[11px] font-medium text-slate-300 shadow-xs hover:bg-white/[0.06] transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>No Account Required</span>
                  </div>
                </div>
              </div>

              {/* Action Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="landing-panel-grid">
                {/* Creator Card */}
                <div 
                  className="bg-slate-900/40 border border-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 hover:border-white/10 hover:bg-slate-950/60 shadow-xl group relative overflow-hidden"
                  id="create-room-box"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/10 transition-colors" />
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 text-sm font-mono font-bold mb-6 group-hover:border-sky-400/40 group-hover:text-sky-300 transition-colors">
                      01
                    </div>
                    <h2 className="text-lg font-display font-semibold text-slate-100" id="card-create-title">
                      Host a Drop Room
                    </h2>
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed" id="card-create-desc">
                      Generates a cryptographically randomized, collision-resistant room code. Anyone pasting this passkey can stream bytes peer-to-peer.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleCreateRoomClick}
                    className="relative overflow-hidden w-full mt-8 py-3 px-4 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-2xl font-medium hover:bg-sky-500/20 hover:border-sky-500/30 transition-all duration-300 ease-out active:opacity-75 shadow-md flex items-center justify-center gap-2 group/btn cursor-pointer"
                    id="btn-create-room"
                  >
                    <AnimatePresence>
                      {createRipples.map(ripple => (
                        <motion.span
                          key={ripple.id}
                          initial={{ scale: 0, opacity: 0.4 }}
                          animate={{ scale: 2.2, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          style={{
                            position: 'absolute',
                            left: ripple.x,
                            top: ripple.y,
                            width: ripple.size,
                            height: ripple.size,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(56, 189, 248, 0.35)',
                            pointerEvents: 'none',
                            transform: 'translate(-50%, -50%)'
                          }}
                          onAnimationComplete={() => {
                            setCreateRipples(prev => prev.filter(r => r.id !== ripple.id));
                          }}
                        />
                      ))}
                    </AnimatePresence>
                    Create Room
                    <ArrowRight className="w-4 h-4 text-sky-400 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Joiner Card */}
                <div 
                  className="bg-slate-900/40 border border-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 hover:border-white/10 hover:bg-slate-950/60 shadow-xl group relative overflow-hidden"
                  id="join-room-box"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 text-sm font-mono font-bold mb-6 group-hover:border-purple-400/40 group-hover:text-purple-300 transition-colors">
                      02
                    </div>
                    <h2 className="text-lg font-display font-semibold text-slate-100" id="card-join-title">
                      Join Peer Session
                    </h2>
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed" id="card-join-desc">
                      Provide the host code to build target signaling bindings. You can also bypass manual typing by scanning the shared QR code.
                    </p>
                  </div>

                  <div className="mt-8 space-y-3" id="join-form-wrapper">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. swift-wave-m5z9"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && joinRoom(inputCode)}
                        className="w-full py-3 px-4 bg-black/40 border border-white/5 rounded-2xl font-mono text-xs tracking-wide text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10"
                      />
                    </div>
                    <button
                      onClick={handleJoinRoomClick}
                      disabled={!inputCode.trim()}
                      className="relative overflow-hidden w-full py-3 px-4 bg-linear-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-30 disabled:pointer-events-none rounded-2xl font-medium transition-all duration-300 ease-out active:opacity-75 shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm text-white"
                      id="btn-join-room"
                    >
                      <AnimatePresence>
                        {joinRipples.map(ripple => (
                          <motion.span
                            key={ripple.id}
                            initial={{ scale: 0, opacity: 0.4 }}
                            animate={{ scale: 2.2, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            style={{
                              position: 'absolute',
                              left: ripple.x,
                              top: ripple.y,
                              width: ripple.size,
                              height: ripple.size,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255, 255, 255, 0.45)',
                              pointerEvents: 'none',
                              transform: 'translate(-50%, -50%)'
                            }}
                            onAnimationComplete={() => {
                              setJoinRipples(prev => prev.filter(r => r.id !== ripple.id));
                            }}
                          />
                        ))}
                      </AnimatePresence>
                      Connect Link
                      <ArrowRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* HOW IT WORKS SECTION */}
              <div className="mt-10 pt-8 border-t border-white/5" id="how-it-works-panel">
                <h3 className="text-center text-xs font-mono font-bold tracking-widest text-sky-400 uppercase mb-8">
                  How It Works
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="space-y-3 p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-mono font-bold mx-auto text-xs">
                      1
                    </div>
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-100">Create Room</h4>
                    <p className="text-slate-400 text-xs leading-relaxed font-sans">
                      Instantly generate an isolated, secure peer-to-peer signal room with a single click.
                    </p>
                  </div>
                  <div className="space-y-3 p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-mono font-bold mx-auto text-xs">
                      2
                    </div>
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-100">Share Code or QR</h4>
                    <p className="text-slate-400 text-xs leading-relaxed font-sans">
                      Send the dynamic URL invite key, read out the code, or show the dynamic QR code to scan.
                    </p>
                  </div>
                  <div className="space-y-3 p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono font-bold mx-auto text-xs">
                      3
                    </div>
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-100">Transfer Files</h4>
                    <p className="text-slate-400 text-xs leading-relaxed font-sans">
                      Drag and drop any payload. Data streams safely directly in device RAM.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* INITIALIZING BROKER SCREEN */}
          {isInitializing && (
            <motion.div
              key="initializing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-12 text-center shadow-xl flex flex-col items-center justify-center"
              id="initialization-loading-screen"
            >
              <RefreshCw className="w-10 h-10 text-sky-400 animate-spin mb-4" />
              <h3 className="text-lg font-display font-semibold text-slate-200 mt-1" id="resolving-title">
                Resolving signaling session
              </h3>
              <p className="text-slate-500 text-xs mt-1 font-mono tracking-wider" id="resolving-subtitle">
                Pairing security certificates & reserving virtual NAT relay logs...
              </p>
            </motion.div>
          )}

          {/* ACTIVE AD HOC SESSION ROOM */}
          {roomCode && !isInitializing && (
            <motion.div
              key="active-room"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
              id="active-room-panel"
            >
              
              {/* Active Hub Station */}
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl" id="pairing-header-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Local Room Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
                        {isHost ? 'Active Creator Terminal' : 'Guest Node Bindings Secured'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2" id="room-code-tagline">
                      <span className="text-xs text-slate-400 font-mono">P2P Passkey:</span>
                      <code className="text-base font-mono font-bold tracking-wider text-slate-100 px-3 py-1 bg-black/40 border border-white/5 rounded-xl shadow-inner">
                        {roomCode}
                      </code>
                    </div>
                  </div>

                  {/* Top Control Triggers */}
                  <div className="flex flex-wrap items-center gap-2" id="action-triggers">
                    
                    {/* Clipboard trigger */}
                    <button
                      onClick={copyRoomLink}
                      className="py-2.5 px-4 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:border-white/10 transition-all flex items-center gap-1.5 shadow"
                      id="btn-copy-address"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Link Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          Copy Invite Link
                        </>
                      )}
                    </button>

                    {/* QR Modal Trigger */}
                    <button
                      onClick={() => setShowQrModal(true)}
                      className="py-2.5 px-4 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:border-white/10 transition-all flex items-center gap-1.5 shadow"
                      id="btn-show-qr"
                    >
                      <QrCode className="w-3.5 h-3.5 text-slate-400" />
                      Invite QR
                    </button>

                    {/* Disconnect/Leave Room Trigger */}
                    <button
                      onClick={leaveRoom}
                      className="py-2.5 px-4 bg-red-500/10 border border-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all shadow"
                      id="btn-leave-room"
                    >
                      Leave Room
                    </button>
                  </div>
                </div>

                {/* Inline device pairing status review */}
                <div className="border-t border-slate-800/60 mt-4 pt-4 flex flex-col md:flex-row md:items-center gap-4 justify-between" id="active-peers-status">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Users className="w-4 h-4 text-sky-500" />
                    <span className="font-mono">Paired browser pipelines:</span>
                    <strong className="text-slate-100 font-mono bg-black/40 px-2 py-0.5 border border-white/5 rounded-lg">
                      {peers.length}
                    </strong>
                  </div>

                  {/* Rendered Device pills */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {peers.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 italic font-mono" id="empty-peers-prompt">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-600 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-700"></span>
                        </span>
                        Awaiting direct NAT handshake client connections...
                      </div>
                    ) : (
                      peers.map((p, index) => (
                        <div 
                          key={p.id}
                          className="flex items-center gap-1.5 bg-white/5 border border-white/5 text-slate-300 text-[11px] font-mono py-1.5 px-3 rounded-xl hover:bg-white/10 transition-colors shadow-sm"
                          id={`peer-pill-${index}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          <span>{p.device || 'Remote Handset'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Connected Stage Wave Radar when idle / empty peers */}
              {peers.length === 0 && (
                <div className="relative py-14 bg-slate-900/20 border border-dashed border-white/5 rounded-3xl text-center overflow-hidden flex flex-col items-center justify-center backdrop-blur-xl p-8" id="discovery-radar">
                  <div className="absolute w-72 h-72 border border-sky-500/5 rounded-full peer-finding-wave-1" />
                  <div className="absolute w-72 h-72 border border-purple-500/5 rounded-full peer-finding-wave-2" />
                  <div className="absolute w-72 h-72 border border-emerald-500/5 rounded-full peer-finding-wave-3" />
                  
                  <div className="relative w-12 h-12 rounded-full bg-black/40 border border-white/5 flex items-center justify-center text-sky-450 mb-4 shadow-lg animate-pulse" id="radar-antenna">
                    <Wifi className="w-5 h-5 text-sky-400" />
                  </div>
                  <h4 className="text-xs font-mono font-bold tracking-wider text-slate-350 uppercase">Searching for Peer handshakes...</h4>
                  <p className="text-slate-400 text-xs mt-2.5 max-w-sm px-6 leading-relaxed">
                    Leave this session open. Launch <strong>QuickDrop</strong> on your secondary phone/laptop, select "Join Peer Session" and enter code: <strong className="text-sky-300 font-mono tracking-wide bg-sky-950/40 px-2 py-0.5 rounded border border-sky-900/30 font-bold">{roomCode}</strong>.
                  </p>
                </div>
              )}

              {/* drag & drop field frame */}
              {peers.length > 0 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={selectFilesManually}
                  className={`relative cursor-pointer transition-all duration-300 rounded-3xl p-8 sm:p-12 text-center border font-sans flex flex-col items-center justify-center backdrop-blur-xl ${
                    isDragging 
                    ? 'border-sky-500/40 bg-sky-950/20 shadow-2xl scale-[0.99]' 
                    : 'border-white/5 bg-slate-900/20 hover:border-sky-500/20 hover:bg-slate-950/40'
                  }`}
                  id="dropzone"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-black/30 border border-white/5 flex items-center justify-center text-slate-350 mb-4 shadow-inner transition-colors" id="drop-icon-box">
                    <FolderUp className={`w-6 h-6 ${isDragging ? 'text-sky-400 animate-bounce' : 'text-slate-300'}`} />
                  </div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                    {isDragging ? 'stream incoming payload instantly' : 'Drag & Drop files here, or click to browse'}
                  </h4>
                  <p className="text-slate-400 text-xs mt-2 max-w-xs leading-relaxed">
                    Binary payloads are locally sliced into memory segments and dynamic-casted to all destinations over the RTC channel.
                  </p>
                </div>
              )}

              {/* CURRENT TRANSFERS LISTING */}
              {transfers.length > 0 && (
                <div className="bg-slate-900/30 border border-white/5 backdrop-blur-md rounded-3xl p-6 shadow-xl space-y-4" id="transfers-container">
                  <div className="flex items-center justify-between" id="transfer-track-header">
                    <h3 className="text-xs font-mono font-bold tracking-wider text-slate-405 uppercase flex items-center gap-1.5">
                      <HardDriveUpload className="w-4 h-4 text-sky-400 animate-bounce" />
                      Live Transmission Streams
                    </h3>
                    
                    <button
                      onClick={clearCompletedTransfers}
                      className="text-[11px] font-mono font-semibold text-slate-300 hover:text-white transition-colors py-1.5 px-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 shadow cursor-pointer"
                      id="btn-clear-completed"
                    >
                      Clear Ended
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" id="transfers-list">
                    {transfers.map((t) => (
                      <div
                        key={t.id}
                        className={`border rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all duration-300 shadow bg-slate-950/40 ${
                          t.status === 'completed' 
                          ? 'border-emerald-500/10 hover:border-emerald-500/20' 
                          : t.status === 'failed' 
                          ? 'border-red-500/10 hover:border-red-500/20' 
                          : t.status === 'transferring'
                          ? 'border-sky-500/10 hover:border-sky-500/20'
                          : 'border-white/5'
                        }`}
                        id={`transfer-item-${t.id}`}
                      >
                        {/* Column with icon and metadata */}
                        <div className="flex items-center gap-3 w-full md:w-auto" id="file-meta-col">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-inner" id="file-ext-frame">
                            {getFileIcon(t.mime, t.name)}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-100 truncate pr-3" title={t.name}>
                              {t.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {formatBytes(t.size)}
                              <span className="mx-1.5 text-slate-700">•</span>
                              <span className={`uppercase tracking-wider text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-black/40 ${
                                t.direction === 'send' 
                                ? 'border-sky-500/10 text-sky-405' 
                                : 'border-purple-500/10 text-purple-405'
                              }`}>
                                {t.direction === 'send' ? 'Outgoing' : 'Incoming'}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Progression slider track */}
                        <div className="w-full md:flex-1 md:max-w-xs flex flex-col gap-1.5 font-mono" id="transfer-metrics-col">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-[10px]" id="transfer-status-tag">
                              {t.status === 'transferring' && (
                                <span className="text-sky-400 flex items-center gap-1.5">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Streaming ({t.progress}%)
                                </span>
                              )}
                              {t.status === 'paused' && (
                                <span className="text-amber-400 flex items-center gap-1">
                                  <Pause className="w-2.5 h-2.5 text-amber-400" />
                                  {t.isPausedByMe ? 'Paused by me' : 'Paused by peer'}
                                </span>
                              )}
                              {t.status === 'connecting' && <span className="text-slate-400 animate-pulse">Connecting...</span>}
                              {t.status === 'pending' && <span className="text-slate-400">Awaiting slot...</span>}
                              {t.status === 'completed' && <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px]">Directly Synced</span>}
                              {t.status === 'failed' && <span className="text-red-400 uppercase tracking-wider text-[9px]">Terminated</span>}
                            </span>
                            
                            {/* Live transfer rates and time estimations */}
                            {t.status === 'transferring' && (
                              <span className="text-slate-400 flex items-center gap-2">
                                <span>{formatSpeed(t.speed)}</span>
                                <span className="text-slate-800">|</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-slate-500" />
                                  {formatTimeLeft(t.timeLeft ?? Infinity)}
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Inline structural progression line */}
                          <div className="relative w-full h-1.5 bg-black/50 border border-white/5 rounded-full overflow-hidden" id="progressbar-container">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                t.status === 'completed' 
                                ? 'bg-emerald-500' 
                                : t.status === 'failed' 
                                ? 'bg-red-500' 
                                : t.status === 'paused'
                                ? 'bg-amber-500'
                                : 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 animate-pulse'
                              }`}
                              style={{ width: `${t.progress}%` }}
                              id="progressbar-fill"
                            />
                          </div>

                          {/* Failure reports if any */}
                          {t.error && (
                            <p className="text-[9px] text-red-400 font-sans mt-0.5 flex items-center gap-1 leading-snug" id="transfer-error-reason">
                              <XCircle className="w-2.5 h-2.5 shrink-0" />
                              {t.error}
                            </p>
                          )}
                        </div>

                        {/* Interactive triggers - Pause/Resume, Abort, Retry */}
                        <div className="w-full md:w-auto flex justify-end gap-1.5 shrink-0" id="transfer-actions-col">
                          
                          {/* Pause/Resume switch */}
                          {(t.status === 'transferring' || t.status === 'paused') && (
                            <button
                              onClick={() => togglePauseTransfer(t.id)}
                              className="p-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200 hover:text-white transition-colors rounded-xl text-[11px] flex items-center gap-1 shadow-sm font-mono cursor-pointer"
                              id="btn-pause-resume"
                            >
                              {t.status === 'paused' ? (
                                <>
                                  <Play className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
                                  <span>Resume</span>
                                </>
                              ) : (
                                <>
                                  <Pause className="w-2.5 h-2.5 text-amber-400" />
                                  <span>Pause</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Abort button for active flows */}
                          {(t.status === 'transferring' || t.status === 'paused' || t.status === 'connecting') && (
                            <button
                              onClick={() => cancelTransfer(t.id)}
                              className="p-1 px-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:text-white transition-colors rounded-xl text-xs flex items-center gap-1 shadow-sm"
                              id="btn-cancel-transfer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Abort
                            </button>
                          )}

                          {/* Save/Download button for client receiver */}
                          {t.status === 'completed' && t.direction === 'receive' && t.blobUrl && (
                            <a
                              href={t.blobUrl}
                              download={t.name}
                              className="py-1.5 px-3.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/25 hover:text-white transition-colors rounded-xl text-xs flex items-center gap-1 shadow-sm"
                              id="btn-download-file"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Save File
                            </a>
                          )}

                          {/* Retry button for failed transactions if the file exists on sender side */}
                          {t.status === 'failed' && t.direction === 'send' && t.fileObject && (
                            <button
                              onClick={() => retryTransfer(t.id)}
                              className="py-1.5 px-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors rounded-xl text-xs flex items-center gap-1 shadow-sm font-mono"
                              id="btn-retry-transfer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Retry
                            </button>
                          )}

                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>

        {/* SECURITY & DECENTRALIZED COMPLIANCES */}
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4" id="security-overview-section">
          
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-3 group hover:bg-white/10 hover:border-white/10 transition-all shadow" id="sec-card-p2p">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform" id="sec-icon-p2p">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest">End-to-End P2P</h4>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-sans">
                Leverages secure WebRTC RTCDataChannels. Data packets are exchanged browser-to-browser with absolute cryptographic encapsulation.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-3 group hover:bg-white/10 hover:border-white/10 transition-all shadow" id="sec-card-servers">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform" id="sec-icon-servers">
              <ServerOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest">Zero Cloud storage</h4>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-sans">
                Absolutely zero backend databases or buffers. Payloads and files reside strictly inside instant application memory logs.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-3 group hover:bg-white/10 hover:border-white/10 transition-all shadow" id="sec-card-accounts">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform" id="sec-icon-accounts">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest">No Account Logs</h4>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-sans">
                Establish sessions dynamically using a secure hash code. Zero personal registrations, trackers, metadata logs or cookies required.
              </p>
            </div>
          </div>

        </section>

      </main>

      {/* QR RECP INVITE DIALOG */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50" id="qr-modal-wrapper">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-white/10 backdrop-blur-md rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl"
              id="qr-modal-content"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-250 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors"
                id="btn-close-qr-modal"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-md font-display font-semibold text-slate-100" id="qr-modal-heading">
                Dynamic QR Invite
              </h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Aim a camera or phone lens at this QR image to load QuickDrop peer bindings and join room <strong>{roomCode}</strong> instantly.
              </p>

              {qrCodeDataUrl ? (
                <div className="my-6 p-4 bg-white rounded-2xl inline-block shadow-lg" id="qr-canvas-frame">
                  <img
                    src={qrCodeDataUrl}
                    alt={`${roomCode} QR Invite Code`}
                    referrerPolicy="no-referrer"
                    className="w-52 h-52 block mx-auto"
                  />
                </div>
              ) : (
                <div className="w-52 h-52 my-6 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-center text-slate-500 mx-auto" id="qr-placeholder">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                </div>
              )}

              <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-2" id="qr-modal-footer">
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Invite Address</p>
                  <p className="text-xs text-slate-300 truncate font-mono mt-0.5" title={`${window.location.origin}/?room=${roomCode}`}>
                    {`${window.location.origin}/?room=${roomCode}`}
                  </p>
                </div>
                <button
                  onClick={copyRoomLink}
                  className="py-1.5 px-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-semibold text-sky-450 transition-colors shrink-0 font-mono"
                  id="btn-copy-address-modal"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global app footprint */}
      <footer className="w-full text-center py-6 border-t border-white/10 bg-black/20 backdrop-blur-md mt-12 relative z-10 text-[10px] text-slate-500 font-mono tracking-widest uppercase flex flex-col sm:flex-row items-center justify-between max-w-4xl mx-auto px-4 gap-2" id="footer-container">
        <p>© 2026 QuickDrop Open Platform • Decoupled Peer Streaming</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
            100% Client Broker Sandboxed
          </span>
        </div>
      </footer>
    </div>
  );
}
