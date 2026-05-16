/**
 * Content Script Entry Point
 *
 * Orchestrates platform-specific ad detection and audio control.
 * Each platform has its own isolated detector — changes to one platform
 * cannot affect detection on another.
 */

import { createMutationDetector } from './detectors/mutationDetector';
import { muteTab, unmuteTab } from './controllers/audioController';
import {
  Message,
  ExtensionSettings,
  DEFAULT_SETTINGS,
  SENSITIVITY_THRESHOLDS,
} from '../types';
import { isDomainWhitelisted } from '../shared/services/storageService';
import type { PlatformDetectionResult } from './detectors/platforms/types';

// ─── Platform registry ────────────────────────────────────────────────────────

interface Platform {
  name: string;
  detect: () => PlatformDetectionResult;
  init?: () => void;
  cleanup?: () => void;
}

/**
 * Match the current hostname to a platform.
 * Returns the matching platform config or the generic fallback.
 */
function resolvePlatform(): Platform {
  const host = window.location.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    // Lazy import — only loaded when on YouTube
    const yt = require('./detectors/platforms/youtube') as typeof import('./detectors/platforms/youtube');
    return { name: 'YouTube', detect: yt.detect };
  }

  if (host === 'hotstar.com' || host.endsWith('.hotstar.com')) {
    const hs = require('./detectors/platforms/hotstar') as typeof import('./detectors/platforms/hotstar');
    return { name: 'Hotstar', detect: hs.detect, init: hs.init, cleanup: hs.cleanup };
  }

  if (host === 'zee5.com' || host.endsWith('.zee5.com')) {
    const z5 = require('./detectors/platforms/zee5') as typeof import('./detectors/platforms/zee5');
    return { name: 'Zee5', detect: z5.detect };
  }

  if (
    host === 'primevideo.com' || host.endsWith('.primevideo.com') ||
    host === 'amazon.com'     || host.endsWith('.amazon.com')
  ) {
    const pv = require('./detectors/platforms/prime') as typeof import('./detectors/platforms/prime');
    return { name: 'PrimeVideo', detect: pv.detect };
  }

  if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
    const tw = require('./detectors/platforms/twitch') as typeof import('./detectors/platforms/twitch');
    return { name: 'Twitch', detect: tw.detect };
  }

  // Fallback for any other site
  const gen = require('./detectors/platforms/generic') as typeof import('./detectors/platforms/generic');
  return { name: 'Generic', detect: gen.detect };
}

// ─── State ────────────────────────────────────────────────────────────────────

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let isAdCurrentlyPlaying = false;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let mutationObserver: MutationObserver | null = null;
let activePlatform: Platform | null = null;

// Require N consecutive below-threshold ticks before unmuting.
// Prevents a single score dip mid-ad from triggering premature unmute.
let consecutiveLowScoreTicks = 0;
const UNMUTE_HOLD_TICKS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentDomain(): string {
  return window.location.hostname.replace(/^www\./, '');
}

function isWhitelisted(): boolean {
  return isDomainWhitelisted(getCurrentDomain(), settings.whitelist);
}

const TAG = '[AutoMuteAds]';

// ─── Detection tick ───────────────────────────────────────────────────────────

function runDetection(mutationBonus: number = 0): void {
  if (!settings.enabled || !activePlatform) return;
  if (isWhitelisted()) return;

  const result    = activePlatform.detect();
  const total     = Math.min(100, result.confidence + mutationBonus);
  const threshold = SENSITIVITY_THRESHOLDS[settings.sensitivity];

  console.log(
    `${TAG}[${activePlatform.name}] score=${total}/${threshold} | isAd=${total >= threshold} | isMuted=${isAdCurrentlyPlaying}` +
    (result.signals.length ? ` | ${result.signals.join(', ')}` : '')
  );

  if (total >= threshold && !isAdCurrentlyPlaying) {
    consecutiveLowScoreTicks = 0;
    isAdCurrentlyPlaying = true;
    console.log(`${TAG}[${activePlatform.name}] ✅ AD DETECTED — score=${total}. Muting.`);
    muteTab(settings.muteDelay);

  } else if (total < threshold && isAdCurrentlyPlaying) {
    consecutiveLowScoreTicks++;
    if (consecutiveLowScoreTicks >= UNMUTE_HOLD_TICKS) {
      consecutiveLowScoreTicks = 0;
      isAdCurrentlyPlaying = false;
      console.log(`${TAG}[${activePlatform.name}] ✅ AD ENDED — held for ${UNMUTE_HOLD_TICKS}s. Unmuting.`);
      unmuteTab(settings.unmuteDelay);
    } else {
      console.log(`${TAG}[${activePlatform.name}] ⏳ holding mute (${consecutiveLowScoreTicks}/${UNMUTE_HOLD_TICKS})`);
    }
  } else {
    consecutiveLowScoreTicks = 0;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function startDetection(): void {
  activePlatform = resolvePlatform();
  console.log(`${TAG} platform detected: ${activePlatform.name}`);

  activePlatform.init?.();

  scanInterval = setInterval(() => runDetection(), 1000);
  mutationObserver = createMutationDetector((confidence) => runDetection(confidence));
}

function stopDetection(): void {
  if (scanInterval)     { clearInterval(scanInterval); scanInterval = null; }
  if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
  activePlatform?.cleanup?.();
  activePlatform = null;
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'SETTINGS_CHANGED') {
    settings = message.payload as ExtensionSettings;
    if (settings.enabled) {
      stopDetection();
      startDetection();
    } else {
      stopDetection();
      if (isAdCurrentlyPlaying) {
        isAdCurrentlyPlaying = false;
        unmuteTab(0);
      }
    }
  }
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function getSettingsFromBackground(): Promise<ExtensionSettings | null> {
  const tryOnce = (): Promise<ExtensionSettings | null> =>
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).catch(() => null);

  const result = await tryOnce();
  if (result) return result;

  await new Promise((r) => setTimeout(r, 500));
  return tryOnce();
}

async function init(): Promise<void> {
  if (!chrome.runtime?.id) {
    console.warn(`${TAG} init aborted — extension context invalid`);
    return;
  }

  console.log(`${TAG} initialising on ${window.location.hostname}`);

  const response = await getSettingsFromBackground();
  if (response) {
    settings = response;
    console.log(`${TAG} settings loaded:`, {
      enabled:    settings.enabled,
      sensitivity: settings.sensitivity,
      threshold:  SENSITIVITY_THRESHOLDS[settings.sensitivity],
    });
  } else {
    console.warn(`${TAG} SW unreachable — using defaults`);
  }

  if (!settings.enabled) { console.log(`${TAG} disabled — not starting`); return; }
  if (isWhitelisted())   { console.log(`${TAG} whitelisted (${getCurrentDomain()}) — not starting`); return; }

  startDetection();
}

// Only execute in page context — guards against CRXJS/Vite 8 SW import bug
if (typeof document !== 'undefined') {
  init().catch((err) => { console.warn(`${TAG} init error:`, err); });
}
