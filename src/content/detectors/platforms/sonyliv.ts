/**
 * SonyLIV Ad Detector
 *
 * SonyLIV uses Google IMA SDK for ad delivery.
 * Detection is based on IMA SDK signals + SonyLIV-specific player class patterns.
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][SonyLIV]';

// IMA SDK + SonyLIV-specific selectors (checked in order of confidence)
const SELECTORS: Array<{ selector: string; score: number }> = [
  // IMA SDK — video element titled "Advertisement" (most reliable)
  { selector: 'video[title="Advertisement"]',          score: 60 },
  // IMA SDK standard container (visible during ad)
  { selector: '.ima-ad-container',                     score: 40 },
  // SonyLIV player ad container classes (observed via player source)
  { selector: '[class*="adContainer"]',                score: 30 },
  { selector: '[class*="ad-container"]',               score: 25 },
  { selector: '[class*="AdContainer"]',                score: 30 },
  // SonyLIV skip button
  { selector: '[class*="skipAd"]',                     score: 40 },
  { selector: '[class*="skip-ad"]',                    score: 40 },
  { selector: '[class*="SkipAd"]',                     score: 40 },
  // Ad countdown / label
  { selector: '[class*="adCountdown"]',                score: 35 },
  { selector: '[class*="ad-countdown"]',               score: 35 },
  { selector: '[class*="adLabel"]',                    score: 30 },
  // IMA iframe bridge
  { selector: 'iframe[src*="imasdk.googleapis.com"]',  score: 45 },
  // General ad overlay
  { selector: '[class*="adOverlay"]',                  score: 25 },
  { selector: '[class*="ad-overlay"]',                 score: 25 },
];

export function detect(): PlatformDetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  for (const { selector, score } of SELECTORS) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      signals.push(selector);
      confidence += score;

      // Early exit: IMA video alone is definitive
      if (confidence >= 100) break;
    } catch {
      // Invalid selector on some pages — skip
    }
  }

  const capped = Math.min(100, confidence);
  if (signals.length) {
    console.log(`${TAG} confidence=${capped} | ${signals.join(', ')}`);
  }
  return { confidence: capped, signals };
}
