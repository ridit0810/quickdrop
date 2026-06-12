/**
 * Helper utilities for QuickDrop
 */

/**
 * Format raw bytes into human-readable strings (e.g. 10.2 MB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format transit speed (e.g. 1.5 MB/s)
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond, 1)}/s`;
}

/**
 * Format remaining time (e.g. 2m 14s)
 */
export function formatTimeLeft(seconds: number): string {
  if (seconds === Infinity || isNaN(seconds) || seconds < 0) return 'estimating...';
  if (seconds < 1) return 'less than a sec';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);
  return `${minutes}m ${remainingSecs}s`;
}

/**
 * Detect simple client browser/OS structure for peer representation
 */
export function getDeviceDetails(): string {
  const userAgent = navigator.userAgent;
  let os = 'Unknown Device';
  
  if (userAgent.indexOf('Win') !== -1) os = 'Windows';
  else if (userAgent.indexOf('Mac') !== -1) {
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) {
      os = 'iPad';
    } else {
      os = 'macOS';
    }
  }
  else if (userAgent.indexOf('X11') !== -1) os = 'Linux';
  else if (userAgent.indexOf('Linux') !== -1) os = 'Android';
  else if (userAgent.indexOf('iPhone') !== -1) os = 'iPhone';
  else if (userAgent.indexOf('iPad') !== -1) os = 'iPad';

  let browser = 'Browser';
  if (userAgent.indexOf('Chrome') !== -1) browser = 'Chrome';
  else if (userAgent.indexOf('Safari') !== -1) browser = 'Safari';
  else if (userAgent.indexOf('Firefox') !== -1) browser = 'Firefox';
  else if (userAgent.indexOf('Edge') !== -1) browser = 'Edge';

  return `${os} (${browser})`;
}

/**
 * Generate a friendly, AirDrop-inspired room code that is highly collision-resistant: adjectives-noun-randomHex
 */
export function generateRoomCode(): string {
  const adjectives = [
    'swift', 'coral', 'ocean', 'breeze', 'cloud', 'solar', 'polar', 'velvet',
    'shadow', 'glowing', 'silent', 'cosmic', 'crimson', 'emerald', 'sapphire',
    'golden', 'frosty', 'aurora', 'alpine', 'desert', 'mystic', 'lunar', 'amber',
    'hyper', 'prism', 'nebula', 'storm', 'tidal', 'stellar', 'sonic', 'canyon'
  ];
  const nouns = [
    'falcon', 'wave', 'dune', 'peak', 'river', 'whisper', 'nexus', 'drift',
    'spark', 'haven', 'canyon', 'forest', 'island', 'crystal', 'nebula',
    'beacon', 'orbit', 'pulse', 'vortex', 'tide', 'glacier', 'mirage', 'comet',
    'phoenix', 'summit', 'atlas', 'oasis', 'quill', 'vector', 'echo', 'ripple'
  ];
  
  const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
  
  // Create a 4-character random alphanumeric suffix for collision resistance
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  
  return `${randAdj}-${randNoun}-${randomSuffix}`;
}

export interface CompatibilityReport {
  webrtc: boolean;
  secureContext: boolean;
  localStorage: boolean;
  isFullyCompatible: boolean;
  warnings: string[];
}

/**
 * Check if the browser environment supports the required modern WebRTC APIs
 */
export function checkBrowserCompatibility(): CompatibilityReport {
  const warnings: string[] = [];
  const webrtc = typeof window !== 'undefined' && 
                 typeof RTCPeerConnection !== 'undefined' && 
                 'RTCDataChannel' in window;
  const secureContext = typeof window !== 'undefined' && window.isSecureContext === true;
  const localStorageSupported = (() => {
    try {
      if (typeof window === 'undefined') return false;
      localStorage.setItem('__compat_test__', '1');
      localStorage.removeItem('__compat_test__');
      return true;
    } catch {
      return false;
    }
  })();

  if (!webrtc) {
    warnings.push('Your browser lacks WebRTC direct peer capabilities. Live streaming is unavailable.');
  }
  if (!secureContext && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    warnings.push('Insecure connection context (non-HTTPS). WebRTC state transitions may be blocked by browser security sandboxes.');
  }
  if (!localStorageSupported) {
    warnings.push('Local browser state persistence is blocked. Session cache won’t persist.');
  }

  return {
    webrtc,
    secureContext,
    localStorage: localStorageSupported,
    isFullyCompatible: webrtc,
    warnings
  };
}
