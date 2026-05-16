/**
 * Amazon Prime Video Ad Detector
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][Prime]';

const SELECTORS = [
  '.atvwebplayersdk-ad-timer',
  '[data-testid="ad-skip-button"]',
  '[data-testid="ad-badge"]',
  '.atvwebplayersdk-adtimeindicator-text',
  '[class*="adTimerText"]',
  '[class*="AdTimer"]',
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
