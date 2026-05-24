/**
 * Disney+ Ad Detector (international: disneyplus.com)
 *
 * Disney+ uses standard IMA SDK for ad delivery with Disney-specific wrappers.
 * Note: JioHotstar (hotstar.com) is handled separately in hotstar.ts.
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][Disney+]';

const SELECTORS = [
  // Disney+ ad overlay and skip controls
  '[data-testid="ad-overlay"]',
  '[data-testid="skip-ad-button"]',
  '[class*="AdOverlay"]',
  '[class*="ad-overlay"]',
  '[class*="AdSlate"]',
  // IMA countdown badge
  '.ima-countdown-div:not([style*="display: none"])',
  // Video element titled "Advertisement" injected by IMA
  'video[title="Advertisement"]',
  // Disney+ specific ad badge
  '[class*="AdBadge"]',
  '[class*="ad-badge"]',
];

export function detect(): PlatformDetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  for (const selector of SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          signals.push(selector);
          confidence += 35;
        }
      }
    } catch { /* invalid selector */ }
  }

  const capped = Math.min(100, confidence);
  if (signals.length) {
    console.log(`${TAG} confidence=${capped} | ${signals.join(', ')}`);
  }
  return { confidence: capped, signals };
}
