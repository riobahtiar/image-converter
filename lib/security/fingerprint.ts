/**
 * Device Fingerprinting Library
 *
 * Generates unique browser fingerprints to track users across IP changes.
 * Combines multiple signals to create a stable identifier.
 *
 * @module lib/security/fingerprint
 */

/**
 * Browser fingerprint data
 */
export interface BrowserFingerprint {
  /** Combined fingerprint hash */
  fingerprint: string;
  /** Individual components */
  components: {
    userAgent: string;
    language: string;
    colorDepth: number;
    deviceMemory?: number;
    hardwareConcurrency: number;
    screenResolution: string;
    availableScreenResolution: string;
    timezoneOffset: number;
    timezone: string;
    sessionStorage: boolean;
    localStorage: boolean;
    indexedDB: boolean;
    cpuClass?: string;
    platform: string;
    doNotTrack: string | null;
    plugins: string[];
    canvas?: string;
    webgl?: string;
    webglVendor?: string;
    adBlock: boolean;
    hasLiedLanguages: boolean;
    hasLiedResolution: boolean;
    hasLiedOs: boolean;
    hasLiedBrowser: boolean;
    touchSupport: {
      maxTouchPoints: number;
      touchEvent: boolean;
      touchStart: boolean;
    };
    fonts: string[];
    audio?: string;
  };
  /** Confidence score (0-100) */
  confidence: number;
}

/**
 * Generate browser fingerprint (client-side only)
 *
 * This function should only be called in the browser.
 * Returns a comprehensive fingerprint of the user's device.
 *
 * @returns Promise<BrowserFingerprint>
 *
 * @example
 * const fingerprint = await generateBrowserFingerprint();
 * console.log(fingerprint.fingerprint); // "a1b2c3d4e5f6..."
 */
export async function generateBrowserFingerprint(): Promise<BrowserFingerprint> {
  if (typeof window === "undefined") {
    throw new Error("generateBrowserFingerprint can only be called in the browser");
  }

  const components = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    colorDepth: screen.colorDepth,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    screenResolution: `${screen.width}x${screen.height}`,
    availableScreenResolution: `${screen.availWidth}x${screen.availHeight}`,
    timezoneOffset: new Date().getTimezoneOffset(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sessionStorage: !!window.sessionStorage,
    localStorage: !!window.localStorage,
    indexedDB: !!window.indexedDB,
    cpuClass: (navigator as any).cpuClass,
    platform: navigator.platform,
    doNotTrack: navigator.doNotTrack,
    plugins: getPlugins(),
    canvas: await getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    webglVendor: getWebGLVendor(),
    adBlock: await detectAdBlock(),
    hasLiedLanguages: detectLanguageLies(),
    hasLiedResolution: detectResolutionLies(),
    hasLiedOs: detectOsLies(),
    hasLiedBrowser: detectBrowserLies(),
    touchSupport: getTouchSupport(),
    fonts: await detectFonts(),
    audio: await getAudioFingerprint(),
  };

  // Generate hash from components
  const fingerprintString = JSON.stringify(components);
  const fingerprint = await hashString(fingerprintString);

  // Calculate confidence score
  const confidence = calculateConfidence(components);

  return {
    fingerprint,
    components,
    confidence,
  };
}

/**
 * Get installed plugins
 */
function getPlugins(): string[] {
  const plugins: string[] = [];
  if (navigator.plugins) {
    for (let i = 0; i < navigator.plugins.length; i++) {
      const plugin = navigator.plugins[i];
      if (plugin) {
        plugins.push(plugin.name);
      }
    }
  }
  return plugins.sort();
}

/**
 * Generate canvas fingerprint
 */
async function getCanvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    canvas.width = 200;
    canvas.height = 50;

    // Draw text with various styles
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Browser Fingerprint 🔐", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Browser Fingerprint 🔐", 4, 17);

    const dataURL = canvas.toDataURL();
    return await hashString(dataURL);
  } catch {
    return "";
  }
}

/**
 * Get WebGL fingerprint
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";

    const debugInfo = (gl as any).getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "";

    const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return renderer || "";
  } catch {
    return "";
  }
}

/**
 * Get WebGL vendor
 */
function getWebGLVendor(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";

    const debugInfo = (gl as any).getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "";

    const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    return vendor || "";
  } catch {
    return "";
  }
}

/**
 * Detect ad blocker
 */
async function detectAdBlock(): Promise<boolean> {
  try {
    // Try to fetch a known ad URL
    const testAd = document.createElement("div");
    testAd.innerHTML = "&nbsp;";
    testAd.className = "adsbox";
    document.body.appendChild(testAd);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const isBlocked = testAd.offsetHeight === 0;
    document.body.removeChild(testAd);
    return isBlocked;
  } catch {
    return false;
  }
}

/**
 * Detect language inconsistencies
 */
function detectLanguageLies(): boolean {
  const nav = navigator as any;
  if (nav.languages && nav.languages.length > 0) {
    return nav.languages[0] !== navigator.language;
  }
  return false;
}

/**
 * Detect resolution inconsistencies
 */
function detectResolutionLies(): boolean {
  return screen.width < screen.availWidth || screen.height < screen.availHeight;
}

/**
 * Detect OS inconsistencies
 */
function detectOsLies(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  const osMap: Record<string, string[]> = {
    win: ["win32", "win64", "windows", "win16"],
    mac: ["macintel", "macppc", "mac68k", "macos"],
    linux: ["linux"],
    android: ["linux armv"],
    ios: ["iphone", "ipad", "ipod"],
  };

  for (const [os, platforms] of Object.entries(osMap)) {
    if (ua.includes(os) && !platforms.some((p) => platform.includes(p))) {
      return true;
    }
  }

  return false;
}

/**
 * Detect browser inconsistencies
 */
function detectBrowserLies(): boolean {
  const ua = navigator.userAgent;
  const nav = navigator as any;

  // Check for headless browser
  if (nav.webdriver) return true;
  if ((window as any).document.documentElement.getAttribute("webdriver")) return true;
  if (nav.plugins.length === 0) return true;

  return false;
}

/**
 * Get touch support info
 */
function getTouchSupport() {
  let maxTouchPoints = 0;
  let touchEvent = false;

  if (typeof navigator.maxTouchPoints !== "undefined") {
    maxTouchPoints = navigator.maxTouchPoints;
  } else if (typeof (navigator as any).msMaxTouchPoints !== "undefined") {
    maxTouchPoints = (navigator as any).msMaxTouchPoints;
  }

  try {
    document.createEvent("TouchEvent");
    touchEvent = true;
  } catch {
    touchEvent = false;
  }

  const touchStart = "ontouchstart" in window;

  return {
    maxTouchPoints,
    touchEvent,
    touchStart,
  };
}

/**
 * Detect installed fonts
 */
async function detectFonts(): Promise<string[]> {
  const baseFonts = ["monospace", "sans-serif", "serif"];
  const testFonts = [
    "Arial",
    "Verdana",
    "Times New Roman",
    "Courier New",
    "Georgia",
    "Palatino",
    "Garamond",
    "Bookman",
    "Comic Sans MS",
    "Trebuchet MS",
    "Impact",
  ];

  const detectedFonts: string[] = [];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return detectedFonts;

  const testString = "mmmmmmmmmmlli";
  const testSize = "72px";

  const baselines: Record<string, number> = {};
  for (const baseFont of baseFonts) {
    ctx.font = `${testSize} ${baseFont}`;
    baselines[baseFont] = ctx.measureText(testString).width;
  }

  for (const font of testFonts) {
    let detected = false;
    for (const baseFont of baseFonts) {
      ctx.font = `${testSize} '${font}', ${baseFont}`;
      const width = ctx.measureText(testString).width;
      if (width !== baselines[baseFont]) {
        detected = true;
        break;
      }
    }
    if (detected) {
      detectedFonts.push(font);
    }
  }

  return detectedFonts;
}

/**
 * Get audio fingerprint
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return "";

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gainNode = context.createGain();
    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

    oscillator.type = "triangle";
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(0);

    const audioData: number[] = [];

    await new Promise((resolve) => {
      scriptProcessor.onaudioprocess = function (event) {
        const output = event.outputBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) {
          audioData.push(output[i]);
        }
        if (audioData.length > 1000) {
          oscillator.stop();
          scriptProcessor.disconnect();
          resolve(null);
        }
      };
    });

    context.close();

    // Hash the audio data
    const sum = audioData.reduce((a, b) => a + Math.abs(b), 0);
    return sum.toFixed(2);
  } catch {
    return "";
  }
}

/**
 * Calculate confidence score
 */
function calculateConfidence(components: any): number {
  let score = 0;
  const weights = {
    canvas: 15,
    webgl: 15,
    audio: 10,
    fonts: 10,
    plugins: 5,
    userAgent: 5,
    language: 5,
    screenResolution: 5,
    timezone: 5,
    platform: 5,
    hardwareConcurrency: 5,
    deviceMemory: 5,
    touchSupport: 5,
    colorDepth: 5,
  };

  if (components.canvas) score += weights.canvas;
  if (components.webgl) score += weights.webgl;
  if (components.audio) score += weights.audio;
  if (components.fonts && components.fonts.length > 0) score += weights.fonts;
  if (components.plugins && components.plugins.length > 0) score += weights.plugins;
  if (components.userAgent) score += weights.userAgent;
  if (components.language) score += weights.language;
  if (components.screenResolution) score += weights.screenResolution;
  if (components.timezone) score += weights.timezone;
  if (components.platform) score += weights.platform;
  if (components.hardwareConcurrency) score += weights.hardwareConcurrency;
  if (components.deviceMemory) score += weights.deviceMemory;
  if (components.touchSupport) score += weights.touchSupport;
  if (components.colorDepth) score += weights.colorDepth;

  return Math.min(100, score);
}

/**
 * Hash a string using SHA-256
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Simple hash function (fallback for server-side)
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
