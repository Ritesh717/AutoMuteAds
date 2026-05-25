/**
 * Content Script Entry Point
 *
 * Orchestrates platform-specific ad detection and audio control.
 * Each platform has its own isolated detector — changes to one platform
 * cannot affect detection on another.
 *
 * Fixes:
 *   #5  - Scan interval reduced to 500ms for faster ad detection
 *   #6  - Reports active platform name to background for popup display
 *   #9  - Manual mute toggle support via MANUAL_MUTE_TOGGLE message
 *   #11 - All platforms follow standardized init/cleanup interface
 *   #12 - Comprehensive error handling and Chrome API graceful degradation
 */

import { createMutationDetector } from './detectors/mutationDetector';
import { muteTab, unmuteTab, setNotificationsEnabled, isCurrentlyMuted } from './controllers/audioController';
import {
  Message,
  ExtensionSettings,
  DEFAULT_SETTINGS,
  SENSITIVITY_THRESHOLDS,
} from '../types';
import { isDomainWhitelisted } from '../shared/services/storageService';
import type { PlatformDetectionResult } from './detectors/platforms/types';

// Static imports for platform detectors
import * as youtube from './detectors/platforms/youtube';
import * as hotstar from './detectors/platforms/hotstar';
import * as zee5 from './detectors/platforms/zee5';
import * as prime from './detectors/platforms/prime';
import * as twitch from './detectors/platforms/twitch';
import * as netflix from './detectors/platforms/netflix';
import * as disneyplus from './detectors/platforms/disneyplus';
import * as generic from './detectors/platforms/generic';

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
 * Fix #11: all platforms share the standardised Platform interface.
 */
function resolvePlatform(): Platform {
  const host = window.location.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    return { name: 'YouTube', detect: youtube.detect };
  }

  if (host === 'hotstar.com' || host.endsWith('.hotstar.com')) {
    return { name: 'Hotstar', detect: hotstar.detect, init: hotstar.init, cleanup: hotstar.cleanup };
  }

  if (host === 'zee5.com' || host.endsWith('.zee5.com')) {
    return { name: 'Zee5', detect: zee5.detect };
  }

  if (host === 'primevideo.com' || host.endsWith('.primevideo.com') ||
      host === 'amazon.com'     || host.endsWith('.amazon.com')) {
    return { name: 'PrimeVideo', detect: prime.detect };
  }

  if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
    return { name: 'Twitch', detect: twitch.detect };
  }

  if (host === 'netflix.com' || host.endsWith('.netflix.com')) {
    return { name: 'Netflix', detect: netflix.detect };
  }

  if (host === 'disneyplus.com' || host.endsWith('.disneyplus.com')) {
    return { name: 'Disney+', detect: disneyplus.detect };
  }

  // Fallback for any other site (#12: errors in specific platform modules don't crash)
  return { name: 'Generic', detect: generic.detect };
}

// ─── State ────────────────────────────────────────────────────────────────────

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let isAdCurrentlyPlaying = false;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let mutationObserver: MutationObserver | null = null;
let activePlatform: Platform | null = null;

// Require N consecutive below-threshold ticks before unmuting (#5: at 500ms intervals = 1.5s hold)
let consecutiveLowScoreTicks = 0;
const UNMUTE_HOLD_TICKS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentDomain(): string {
  return window.location.hostname.replace(/^www\./, '');
}

function isWhitelisted(): boolean {
  try {
    return isDomainWhitelisted(getCurrentDomain(), settings.whitelist);
  } catch {
    return false;
  }
}

const TAG = '[AutoMuteAds]';

// ─── Detection tick ───────────────────────────────────────────────────────────

function runDetection(mutationBonus: number = 0): void {
  if (!settings.enabled || !activePlatform) return;
  if (isWhitelisted()) return;

  let result: PlatformDetectionResult;
  try {
    result = activePlatform.detect();
  } catch (err) {
    // Platform detector threw — log and skip tick (#12)
    console.warn(`${TAG}[${activePlatform.name}] detect() threw:`, err);
    return;
  }

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
      console.log(`${TAG}[${activePlatform.name}] ✅ AD ENDED — held for ${UNMUTE_HOLD_TICKS} ticks. Unmuting.`);
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
  console.log(`${TAG} Platform: ${activePlatform.name} on ${getCurrentDomain()}`);

  // Sync notification preference with audio controller (#7)
  setNotificationsEnabled(settings.showNotifications);

  try {
    activePlatform.init?.();
  } catch (err) {
    console.warn(`${TAG}[${activePlatform.name}] init() threw:`, err);
  }

  // Fix #5: 500ms interval for faster ad detection
  scanInterval = setInterval(() => runDetection(), 500);
  mutationObserver = createMutationDetector((confidence) => runDetection(confidence));
}

function stopDetection(): void {
  if (scanInterval)     { clearInterval(scanInterval); scanInterval = null; }
  if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
  try {
    activePlatform?.cleanup?.();
  } catch (err) {
    console.warn(`${TAG} cleanup() threw:`, err);
  }
  activePlatform = null;
}

// ─── Safe background messaging (#12) ─────────────────────────────────────────

function safeSendToBackground(msg: Message): void {
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(msg).catch(() => {
      // SW asleep — not an error
    });
  } catch {
    // Extension context invalidated — ignore
  }
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: Message) => {
  try {
    if (message.type === 'SETTINGS_CHANGED') {
      settings = message.payload as ExtensionSettings;
      // Sync notification preference live (#7)
      setNotificationsEnabled(settings.showNotifications);

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

    // Fix #9: manual mute toggle from popup
    if (message.type === 'MANUAL_MUTE_TOGGLE') {
      if (isCurrentlyMuted()) {
        unmuteTab(0);
        isAdCurrentlyPlaying = false;
      } else {
        muteTab(0);
        isAdCurrentlyPlaying = true;
      }
    }
  } catch (err) {
    console.warn(`${TAG} Message handler error:`, err);
  }
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function getSettingsFromBackground(): Promise<ExtensionSettings | null> {
  const tryOnce = (): Promise<ExtensionSettings | null> => {
    try {
      if (!chrome?.runtime?.id) return Promise.resolve(null);
      return chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  };

  const result = await tryOnce();
  if (result) return result;

  // SW may be asleep — wait 500ms and retry once (#12)
  await new Promise((r) => setTimeout(r, 500));
  return tryOnce();
}

async function init(): Promise<void> {
  // Guard: don't run if extension context has been invalidated (#12)
  try {
    if (!chrome?.runtime?.id) {
      console.warn(`${TAG} init aborted — extension context invalid`);
      return;
    }
  } catch {
    return; // chrome API not available (e.g. non-extension context)
  }

  console.log(`${TAG} Initialising on ${window.location.hostname}`);

  try {
    const response = await getSettingsFromBackground();
    if (response) {
      settings = response;
      console.log(`${TAG} Settings loaded:`, {
        enabled:     settings.enabled,
        sensitivity: settings.sensitivity,
        threshold:   SENSITIVITY_THRESHOLDS[settings.sensitivity],
      });
    } else {
      console.warn(`${TAG} SW unreachable — using defaults`);
    }
  } catch (err) {
    console.warn(`${TAG} Failed to load settings:`, err);
  }

  if (!settings.enabled) { console.log(`${TAG} Disabled — not starting`); return; }
  if (isWhitelisted())   { console.log(`${TAG} Whitelisted (${getCurrentDomain()}) — not starting`); return; }

  startDetection();
}

// Only execute in page context — guards against CRXJS/Vite SW import bug (#12)
if (typeof document !== 'undefined') {
  init().catch((err) => { console.warn(`${TAG} init error:`, err); });
}
