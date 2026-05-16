/**
 * YouTube Ad Detector
 *
 * YouTube injects specific CSS classes and data attributes during ad playback.
 * Also monitors the page title which changes to "Ad - <title>" during ads.
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][YouTube]';

const SELECTORS = [
  '.ad-showing',
  '.ad-interrupting',
  '.ytp-ad-player-overlay',
  '.ytp-ad-progress',
  '.ytp-ad-skip-button',
  '.ytp-ad-text',
  '[class*="ytp-ad"]',
  '.video-ads.ytp-ad-module',
];

export function detect(): PlatformDetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  // 1. DOM selectors
  for (const selector of SELECTORS) {
    try {
      if (document.querySelector(selector)) {
        signals.push(selector);
        confidence += 30;
        break; // One match is a strong signal
      }
    } catch { /* invalid selector */ }
  }

  // Additional selectors add weight
  for (const selector of SELECTORS) {
    try {
      if (document.querySelector(selector) && !signals.includes(selector)) {
        signals.push(selector);
        confidence += 10;
      }
    } catch { /* invalid selector */ }
  }

  // 2. Page title changes during YouTube ads: "Ad - Video Title"
  const title = document.title.toLowerCase();
  if (title.includes('ad - ') || title.startsWith('ad |')) {
    signals.push('title-ad');
    confidence += 20;
  }

  // 3. Multiple video elements = YouTube pip ad overlay
  const videos = document.querySelectorAll('video');
  if (videos.length > 1) {
    signals.push(`multiple-videos:${videos.length}`);
    confidence += 15;
  }

  const capped = Math.min(100, confidence);
  if (signals.length) {
    console.log(`${TAG} confidence=${capped} | ${signals.join(', ')}`);
  }

  return { confidence: capped, signals };
}
