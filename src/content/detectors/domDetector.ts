/**
 * DOM-based ad detector.
 * Looks for well-known ad indicator selectors across streaming platforms.
 */

export interface DomDetectionResult {
  detected: boolean;
  confidence: number;
  matchedSelectors: string[];
}

// YouTube selectors
const YOUTUBE_AD_SELECTORS = [
  '.ad-showing',
  '.ad-interrupting',
  '.ytp-ad-player-overlay',
  '.ytp-ad-progress',
  '.ytp-ad-skip-button',
  '.ytp-ad-text',
  '[class*="ytp-ad"]',
  '.video-ads.ytp-ad-module',
];

// Generic / other platform selectors
const GENERIC_AD_SELECTORS = [
  '[data-ad]',
  '[aria-label*="advertisement" i]',  // kept — specific enough
  // '[aria-label*="ad" i]' — removed: too broad, matches "Add" buttons
  '.advertisement',
  '.ad-overlay',
  '.ad-container',
  '#ad-container',
  '[class*="AdBanner"]',
  '[class*="adBanner"]',
  '[id*="ad-player"]',
  '[class*="sponsor"]',
  'ins.adsbygoogle',
];

// Twitch selectors
const TWITCH_AD_SELECTORS = [
  '.ad-banner',
  '[data-a-target="ad-banner"]',
  '.player-ad-countdown',
  '.video-ad-label',
];

// Prime Video selectors
const PRIME_AD_SELECTORS = [
  '.atvwebplayersdk-ad-timer',
  '[data-testid="ad-skip-button"]',
];

const ALL_SELECTORS = [
  ...YOUTUBE_AD_SELECTORS,
  ...GENERIC_AD_SELECTORS,
  ...TWITCH_AD_SELECTORS,
  ...PRIME_AD_SELECTORS,
];

// ── Zee5 — countdown-aware ad detection ──────────────────────────────────────
//
// #zee-ad-container is always in the DOM. Toggle signals:
//   Ad playing:  display:block  + pointer-events:auto
//   No ad:       display:none   + pointer-events:none
//
// Strategy: return 100 confidence while the container is active and the
// countdown has NOT yet reached 0:00. Only return 0 when the countdown is
// "0:00" or the container is hidden — this pins muting to the actual ad timer.

function parseCountdownSeconds(text: string): number {
  const match = text.trim().match(/(\d+):(\d+)/);
  if (!match) return -1; // -1 = countdown not parseable
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Detect a Zee5 ad using container visibility + countdown timer.
 * Returns 100 while ad is running, 0 when finished or hidden.
 */
export function detectZee5ImaAd(): { confidence: number; signal: string | null } {
  try {
    const adContainer = document.getElementById('zee-ad-container');
    if (!adContainer) return { confidence: 0, signal: null };

    const style   = window.getComputedStyle(adContainer);
    const visible = style.display !== 'none' && style.visibility !== 'hidden';
    const active  = style.pointerEvents !== 'none';

    // Container hidden or inactive → no ad
    if (!visible || !active) return { confidence: 0, signal: null };

    // Container is visible and active — check countdown
    const countdown    = document.getElementById('zee-countdown-div');
    const countdownTxt = countdown?.textContent?.trim() ?? '';
    const secsLeft     = parseCountdownSeconds(countdownTxt);

    // Countdown explicitly at 0:00 → ad just finished, drop confidence to 0
    // so the 3-tick hold kicks in and we unmute ~3 seconds after ad ends
    if (secsLeft === 0) {
      return { confidence: 0, signal: 'zee5-ad:countdown-zero' };
    }

    // Countdown running (e.g. "0:09" → 9s left) → stay muted with full confidence
    if (secsLeft > 0) {
      return { confidence: 100, signal: `zee5-ad:countdown(${countdownTxt}) ${secsLeft}s left` };
    }

    // No countdown div or unparseable → container visible+active is enough signal
    return { confidence: 100, signal: 'zee5-ad:container-active(no-countdown)' };
  } catch {
    return { confidence: 0, signal: null };
  }
}



/**
 * Run all selectors against the current DOM and return a detection result.
 * Confidence: each matched selector adds proportional weight up to 40 points.
 */
export function detectAdsInDom(): DomDetectionResult {
  const matchedSelectors: string[] = [];

  for (const selector of ALL_SELECTORS) {
    try {
      if (document.querySelector(selector) !== null) {
        matchedSelectors.push(selector);
      }
    } catch {
      // Ignore invalid selectors
    }
  }

  // Also run the visibility-aware Zee5 IMA check
  const zee5 = detectZee5ImaAd();
  if (zee5.signal) {
    matchedSelectors.push(zee5.signal);
  }

  if (matchedSelectors.length === 0) {
    return { detected: false, confidence: 0, matchedSelectors: [] };
  }

  // Weight: first match = 30pts, each additional = 5pts, capped at 40
  const confidence = Math.min(40, 30 + (matchedSelectors.length - 1) * 5);

  return { detected: true, confidence, matchedSelectors };
}

/**
 * Check the page title for ad indicators (YouTube changes title during ads).
 */
export function detectAdInTitle(): number {
  const title = document.title.toLowerCase();
  if (title.includes('ad - ') || title.startsWith('ad |')) {
    return 10;
  }
  return 0;
}
