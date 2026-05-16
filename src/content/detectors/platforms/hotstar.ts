/**
 * Hotstar Ad Detector — platform wrapper
 *
 * Re-exports from the core hotstarDetector module.
 * Detection strategies (in order of reliability):
 *   1. "Go Ads free" button ([data-testid="ad-free-nudge-cta"])
 *   2. Ad SDK CustomEvents (adStart, prerollStart, midrollStart…)
 *   3. PerformanceObserver watching hesads.akamaized.net CDN requests
 *   4. DOM class selectors (ad-container, AdCountdown, etc.)
 *   5. Video src URL and duration-switch heuristics
 */

import type { PlatformDetectionResult } from './types';
import {
  detectHotstarAd,
  initHotstarDetector,
  stopNetworkObserver,
} from '../hotstarDetector';

export function detect(): PlatformDetectionResult {
  const result = detectHotstarAd();
  return { confidence: result.confidence, signals: result.signals };
}

export function init(): void {
  initHotstarDetector();
}

export function cleanup(): void {
  stopNetworkObserver();
}
