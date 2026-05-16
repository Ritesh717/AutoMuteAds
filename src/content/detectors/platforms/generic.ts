/**
 * Generic Ad Detector (fallback for unknown platforms)
 *
 * Uses broad but carefully chosen selectors that are unlikely to match
 * normal page content. Applied only on sites without a specific detector.
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][Generic]';

const SELECTORS = [
  '[data-ad]',
  '[aria-label*="advertisement" i]',
  '.advertisement',
  '.ad-overlay',
  '#ad-container',
  '[class*="AdBanner"]',
  '[class*="adBanner"]',
  '[id*="ad-player"]',
  'ins.adsbygoogle',
];

export function detect(): PlatformDetectionResult {
  const signals: string[] = [];
  let confidence = 0;

  // DOM selectors
  for (const selector of SELECTORS) {
    try {
      if (document.querySelector(selector)) {
        signals.push(selector);
        confidence += 20;
      }
    } catch { /* invalid selector */ }
  }

  // Video state heuristics
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));

  if (videos.length > 1) {
    signals.push(`multiple-videos:${videos.length}`);
    confidence += 15;
  }

  for (const video of videos) {
    // Video nested inside an ad-named container
    const parent = video.closest('[class*="ad"], [class*="Ad"], [id*="ad"], [id*="Ad"]');
    if (parent) {
      signals.push('video-in-ad-container');
      confidence += 15;
      break;
    }

    // Very short video (<2 min) is more likely an ad
    if (video.duration > 0 && video.duration < 120) {
      signals.push(`short-video:${Math.round(video.duration)}s`);
      confidence += 10;
    }
  }

  const capped = Math.min(100, confidence);
  if (signals.length) {
    console.log(`${TAG} confidence=${capped} | ${signals.join(', ')}`);
  }

  return { confidence: capped, signals };
}
