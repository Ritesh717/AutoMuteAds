/**
 * Zee5 Ad Detector
 *
 * Zee5 uses a #zee-ad-container div that is always present in the DOM.
 * Ad state is communicated via CSS:
 *   Ad playing:  display:block  + pointer-events:auto
 *   No ad:       display:none   + pointer-events:none
 *
 * The countdown timer (#zee-countdown-div) pins the mute duration —
 * confidence stays 100 until countdown reaches "0:00", then drops to 0.
 */

import type { PlatformDetectionResult } from './types';

const TAG = '[AutoMuteAds][Zee5]';

function parseCountdownSeconds(text: string): number {
  const match = text.trim().match(/(\d+):(\d+)/);
  if (!match) return -1; // -1 = not parseable
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function detect(): PlatformDetectionResult {
  try {
    const adContainer = document.getElementById('zee-ad-container');
    if (!adContainer) return { confidence: 0, signals: [] };

    const style   = window.getComputedStyle(adContainer);
    const visible = style.display !== 'none' && style.visibility !== 'hidden';
    const active  = style.pointerEvents !== 'none';

    // Container hidden or inactive → no ad
    if (!visible || !active) return { confidence: 0, signals: [] };

    // Container is active — check countdown timer
    const countdown    = document.getElementById('zee-countdown-div');
    const countdownTxt = countdown?.textContent?.trim() ?? '';
    const secsLeft     = parseCountdownSeconds(countdownTxt);

    // Countdown explicitly at 0:00 → ad just finished
    // Drop to 0 so the hold-tick mechanism kicks in and we unmute a few seconds later
    if (secsLeft === 0) {
      console.log(`${TAG} countdown reached 0:00 — ad ending`);
      return { confidence: 0, signals: ['zee5-countdown-zero'] };
    }

    // Countdown running → stay fully muted
    if (secsLeft > 0) {
      const signal = `zee5-countdown(${countdownTxt}) ${secsLeft}s left`;
      console.log(`${TAG} ${signal}`);
      return { confidence: 100, signals: [signal] };
    }

    // No countdown div or unparseable — container visible+active is enough
    const signal = 'zee5-container-active';
    console.log(`${TAG} ${signal}`);
    return { confidence: 100, signals: [signal] };
  } catch {
    return { confidence: 0, signals: [] };
  }
}
