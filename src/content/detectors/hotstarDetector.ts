/**
 * Hotstar Ad Detector
 *
 * Hotstar uses server-side ad stitching (SSAI) via `hesads.akamaized.net`.
 * Detection strategies (in order of reliability):
 *   1. Ad SDK event hooks  — listens to IMA/ad-sdk CustomEvents
 *   2. PerformanceObserver — catches ad CDN requests in real time
 *   3. DOM selectors       — best-effort overlay UI signals
 *   4. Video src / state   — fallback for when above miss
 *
 * IMPORTANT: All DOM/window access is guarded so this module is safe to
 * import in non-page contexts (e.g. service workers where CRXJS may
 * accidentally include content-script chunks).
 */

const TAG = '[AutoMuteAds][Hotstar]';

// Guard: do nothing if not in a page context
const IS_PAGE_CONTEXT = typeof document !== 'undefined' && typeof window !== 'undefined';

export interface HotstarDetectionResult {
  isAdLikely: boolean;
  confidence: number;
  signals: string[];
}

// ── 1. Event-based detection ──────────────────────────────────────────────────

let eventBasedAdActive = false;
let eventListenersAttached = false;

const AD_START_EVENTS = [
  'adStart', 'adstarted', 'ad-started',
  'adImpression', 'adimpression',
  'prerollStart', 'midrollStart',
  'ima_ad_started', 'ima_ad_impression',
];
const AD_END_EVENTS = [
  'adComplete', 'adcomplete', 'ad-complete',
  'adEnd', 'adended', 'ad-ended',
  'allAdsCompleted', 'ima_all_ads_completed',
  'adSkipped', 'adskipped',
];

function attachAdEventListeners(): void {
  if (!IS_PAGE_CONTEXT || eventListenersAttached) return;
  eventListenersAttached = true;

  const onAdStart = (e: Event) => {
    console.log(`${TAG} 🎯 Ad START event: ${e.type}`);
    eventBasedAdActive = true;
  };
  const onAdEnd = (e: Event) => {
    console.log(`${TAG} 🎯 Ad END event: ${e.type}`);
    eventBasedAdActive = false;
  };

  for (const evt of AD_START_EVENTS) {
    document.addEventListener(evt, onAdStart, { capture: true });
    window.addEventListener(evt, onAdStart, { capture: true });
  }
  for (const evt of AD_END_EVENTS) {
    document.addEventListener(evt, onAdEnd, { capture: true });
    window.addEventListener(evt, onAdEnd, { capture: true });
  }

  console.log(`${TAG} ad event listeners attached`);
}

// ── 2. PerformanceObserver ────────────────────────────────────────────────────

let perfObserver: PerformanceObserver | null = null;
let networkAdSignalCount = 0;
const NETWORK_SIGNAL_DECAY_MS = 15_000;

// Confirmed Hotstar ad CDN + common fallback patterns
const AD_URL_PATTERNS = [
  /hesads\.akamaized\.net/i,  // ← Hotstar's confirmed ad CDN
  /hesads/i,
  /\/ad\//i,
  /\/ads\//i,
  /[?&]ad=/i,
  /[?&]adtype=/i,
  /[?&]adsid=/i,
  /\/adbreak/i,
  /doubleclick\.net/i,
  /googlesyndication/i,
  /imasdk/i,
  /[?&]adServer/i,
  /pubads\.g\.doubleclick/i,
];

export function startNetworkObserver(): void {
  if (!IS_PAGE_CONTEXT || perfObserver) return;
  try {
    perfObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const url = (entry as PerformanceResourceTiming).name ?? '';
        if (AD_URL_PATTERNS.some((p) => p.test(url))) {
          console.log(`${TAG} 🌐 Ad network request: ${url.slice(0, 80)}`);
          networkAdSignalCount++;
          // Do NOT set eventBasedAdActive here — buffered replays trigger false positives.
          // Let networkAdSignalCount decay naturally as a weaker signal.
          setTimeout(() => {
            networkAdSignalCount = Math.max(0, networkAdSignalCount - 1);
          }, NETWORK_SIGNAL_DECAY_MS);
        }
      }
    });
    perfObserver.observe({ type: 'resource', buffered: false }); // only NEW requests
    console.log(`${TAG} PerformanceObserver started`);
  } catch {
    console.warn(`${TAG} PerformanceObserver not available`);
  }
}

export function stopNetworkObserver(): void {
  if (!IS_PAGE_CONTEXT) return;
  perfObserver?.disconnect();
  perfObserver = null;
  networkAdSignalCount = 0;
  eventBasedAdActive = false;
}

// ── 3. DOM selectors ──────────────────────────────────────────────────────────

const HOTSTAR_DOM_SELECTORS = [
  '[class*="ad-container"]', '[class*="AdContainer"]',
  '[class*="ads-container"]', '[class*="ad-countdown"]',
  '[class*="AdCountdown"]', '[class*="ad-label"]', '[class*="AdLabel"]',
  '[class*="ad-skip"]', '[class*="AdSkip"]', '[class*="skip-ad"]',
  '[data-testid*="ad"]', '[data-testid*="Ad"]',
  '.ads-linear', '[class*="linearAd"]', '[class*="linear-ad"]',
  '[class*="preroll"]', '[class*="midroll"]',
];

/**
 * Hotstar shows a "Go Ads free" button ONLY during active ad playback.
 * Primary: data-testid="ad-free-nudge-cta" (stable attribute from the actual DOM)
 * Fallback: text-content match for resilience against attribute changes
 */
function hasGoAdsFreeButton(): boolean {
  // Primary — stable data-testid attribute
  if (document.querySelector('[data-testid="ad-free-nudge-cta"]')) return true;

  // Fallback — text content (handles future attribute renames)
  const candidates = document.querySelectorAll('button, a, [role="button"], span');
  for (const el of Array.from(candidates)) {
    const text = el.textContent?.trim().toLowerCase() ?? '';
    if (
      text === 'go ads free' ||
      text === 'go ad free' ||
      text === 'go ads-free' ||
      text === 'go ad-free' ||
      text === 'go adfree'
    ) {
      return true;
    }
  }
  return false;
}


// ── 4. Video src / state ──────────────────────────────────────────────────────

function checkVideoSrc(video: HTMLVideoElement): { score: number; signal: string | null } {
  try {
    const src = video.currentSrc ?? video.src ?? '';
    if (!src) return { score: 0, signal: null };
    for (const pattern of AD_URL_PATTERNS) {
      if (pattern.test(src)) {
        return { score: 20, signal: `hotstar-src:${src.slice(0, 80)}` };
      }
    }
  } catch { /* Hotstar Proxy throws on property access — ignore */ }
  return { score: 0, signal: null };
}

const videoMetaMap = new WeakMap<HTMLVideoElement, { lastDuration: number }>();

function checkVideoStateTransition(video: HTMLVideoElement): { score: number; signal: string | null } {
  try {
    const prev = videoMetaMap.get(video);
    const currDuration = video.duration;
    videoMetaMap.set(video, { lastDuration: currDuration });
    if (!prev) return { score: 0, signal: null };
    if (
      prev.lastDuration && currDuration &&
      Math.abs(currDuration - prev.lastDuration) > 5 &&
      currDuration < 300
    ) {
      return {
        score: 10,
        signal: `hotstar-duration-switch:${prev.lastDuration.toFixed(0)}→${currDuration.toFixed(0)}s`,
      };
    }
  } catch { /* Proxy error — ignore */ }
  return { score: 0, signal: null };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function detectHotstarAd(): HotstarDetectionResult {
  if (!IS_PAGE_CONTEXT) return { isAdLikely: false, confidence: 0, signals: [] };

  // Only run detection when at least one video element is actively playing
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  const hasPlayingVideo = videos.some((v) => !v.paused && !v.ended && v.readyState >= 2);
  if (!hasPlayingVideo) {
    return { isAdLikely: false, confidence: 0, signals: [] };
  }

  const signals: string[] = [];
  let confidence = 0;

  // 0. "Go Ads-Free" button — definitive Hotstar ad signal (only visible during ads)
  try {
    if (hasGoAdsFreeButton()) {
      console.log(`${TAG} 🎯 "Go Ads-Free" button detected — definitive ad signal`);
      signals.push('hotstar-go-ads-free-button');
      return { isAdLikely: true, confidence: 100, signals };
    }
  } catch { /* DOM access error — ignore */ }

  // 1. Event-based (highest confidence)
  if (eventBasedAdActive) {
    signals.push('hotstar-event:ad-sdk-active');
    return { isAdLikely: true, confidence: 100, signals };
  }

  // 2. Network observer residual count
  if (networkAdSignalCount > 0) {
    confidence += Math.min(40, networkAdSignalCount * 10);
    signals.push(`hotstar-network:${networkAdSignalCount}`);
  }

  // 3. DOM selectors
  for (const selector of HOTSTAR_DOM_SELECTORS) {
    try {
      if (document.querySelector(selector)) {
        signals.push(`hotstar-dom:${selector}`);
        confidence += 15;
        break;
      }
    } catch { /* invalid selector */ }
  }

  // 4. Video src / state
  for (const video of videos) {
    const { score: ss, signal: sig } = checkVideoSrc(video);
    if (ss > 0 && sig) { confidence += ss; signals.push(sig); }
    const { score: ts, signal: tsig } = checkVideoStateTransition(video);
    if (ts > 0 && tsig) { confidence += ts; signals.push(tsig); }
  }

  return { isAdLikely: confidence > 0, confidence: Math.min(100, confidence), signals };
}

// ── Explicit init — called from content/main.ts, NOT at module load time ──────

export function initHotstarDetector(): void {
  if (!IS_PAGE_CONTEXT) return;
  attachAdEventListeners();
  startNetworkObserver();
}
