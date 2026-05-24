/**
 * Netflix Ad Detector
 *
 * Netflix injects ad UI elements with specific class patterns and data attributes.
 * These selectors are based on observed DOM structures during Netflix ad playback.
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][Netflix]';

const SELECTORS = [
  // Netflix ad countdown / skip button
  '[data-uia="ad-ui"]',
  '[data-uia="ad-countdown"]',
  '[data-uia="ad-skip-button"]',
  // Netflix injects an "Advertisement" label
  '[class*="AdPanel"]',
  '[class*="ad-panel"]',
  '[class*="AdCountdown"]',
  '[class*="adCountdown"]',
  // IMA SDK fallback (Netflix uses Google IMA for some regions)
  'video[title="Advertisement"]',
  '.ima-ad-container:not([style*="display: none"])',
];

export function detect(): PlatformDetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  for (const selector of SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        // Check visibility — Netflix keeps some elements in DOM but hides them
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
