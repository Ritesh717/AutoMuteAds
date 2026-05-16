/**
 * Twitch Ad Detector
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][Twitch]';

const SELECTORS = [
  '.ad-banner',
  '[data-a-target="ad-banner"]',
  '.player-ad-countdown',
  '.video-ad-label',
  '[data-a-target="ad-countdown"]',
  '.tw-ad-countdown',
];

export function detect(): PlatformDetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  for (const selector of SELECTORS) {
    try {
      if (document.querySelector(selector)) {
        signals.push(selector);
        confidence += 35;
      }
    } catch { /* invalid selector */ }
  }

  const capped = Math.min(100, confidence);
  if (signals.length) {
    console.log(`${TAG} confidence=${capped} | ${signals.join(', ')}`);
  }

  return { confidence: capped, signals };
}
