/**
 * Audio Controller
 *
 * Primary: mute/unmute video/audio elements directly in the page DOM.
 * Secondary: notify background to mute at Chrome tab level.
 * UX: show a brief toast on the page when mute state changes.
 *
 * Fixes:
 *   #1 - MutationObserver re-mutes dynamically added media elements
 *   #7 - Respects showNotifications setting
 *   #12 - Graceful degradation when Chrome APIs are unavailable
 */

import { Message } from '../../types';

let muteTimer: ReturnType<typeof setTimeout> | null = null;
let unmuteTimer: ReturnType<typeof setTimeout> | null = null;
let adStartTime: number | null = null;

// Track current mute state so newly added elements can be muted immediately
let currentlyMuted = false;

const originalVolumes = new WeakMap<HTMLVideoElement, number>();
const TAG = '[AutoMuteAds][Audio]';

// Whether to show toasts (updated externally via setNotificationsEnabled)
let notificationsEnabled = true;
export function setNotificationsEnabled(enabled: boolean): void {
  notificationsEnabled = enabled;
}

function enforceMuteState(media: HTMLVideoElement | HTMLAudioElement): void {
  try {
    if (media instanceof HTMLVideoElement) {
      if (!originalVolumes.has(media)) {
        originalVolumes.set(media, media.volume ?? 1);
      }
      media.volume = 0;
    }
    media.muted = true;

    if (!(media as any)._hasAutoMuteListener) {
      (media as any)._hasAutoMuteListener = true;
      media.addEventListener('volumechange', () => {
        if (currentlyMuted) {
          if (!media.muted || (media instanceof HTMLVideoElement && media.volume > 0)) {
            console.log(`${TAG} Enforcing mute state on volumechange`);
            media.muted = true;
            if (media instanceof HTMLVideoElement) {
              media.volume = 0;
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn(`${TAG} Failed to enforce mute state:`, err);
  }
}

// ─── Dynamic media element observer (#1) ─────────────────────────────────────

let mediaObserver: MutationObserver | null = null;

function startMediaObserver(): void {
  if (mediaObserver) return;
  mediaObserver = new MutationObserver((mutations) => {
    if (!currentlyMuted) return;
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLVideoElement || node instanceof HTMLAudioElement) {
          enforceMuteState(node);
          console.log(`${TAG} Auto-muted dynamically added media element`);
        } else if (node instanceof HTMLElement) {
          node.querySelectorAll<HTMLVideoElement>('video').forEach((v) => enforceMuteState(v));
          node.querySelectorAll<HTMLAudioElement>('audio').forEach((a) => enforceMuteState(a));
        }
      }
    }
  });
  mediaObserver.observe(document.body, { childList: true, subtree: true });
}

function stopMediaObserver(): void {
  mediaObserver?.disconnect();
  mediaObserver = null;
}

// ─── Toast notification (#7) ──────────────────────────────────────────────────

let toastEl: HTMLDivElement | null = null;
let toastHideTimer: ReturnType<typeof setTimeout> | null = null;

function injectToastStyles(): void {
  if (document.getElementById('automute-toast-style')) return;
  const style = document.createElement('style');
  style.id = 'automute-toast-style';
  style.textContent = `
    #automute-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 12px;
      background: rgba(10, 15, 30, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.10);
      backdrop-filter: blur(16px);
      color: #e2e8f0;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.01em;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
      pointer-events: none;
      opacity: 0;
      transform: translate(-50%, 12px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    #automute-toast.automute-visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    #automute-toast .automute-icon {
      font-size: 18px;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

function showToast(icon: string, text: string): void {
  if (!notificationsEnabled) return; // #7 - respect setting

  try {
    injectToastStyles();

    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'automute-toast';
      toastEl.innerHTML = `<span class="automute-icon"></span><span class="automute-text"></span>`;
      document.body.appendChild(toastEl);
    }

    const iconEl = toastEl.querySelector('.automute-icon') as HTMLElement;
    const textEl = toastEl.querySelector('.automute-text') as HTMLElement;
    iconEl.textContent = icon;
    textEl.textContent = text;

    toastEl.classList.add('automute-visible');

    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      toastEl?.classList.remove('automute-visible');
    }, 2000);
  } catch (err) {
    // Toast injection may fail on CSP-strict pages — silently ignore (#12)
    console.warn(`${TAG} Toast failed:`, err);
  }
}

// ─── Direct DOM audio control (#1) ────────────────────────────────────────────

function muteAllVideoElements(): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  const audios  = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));

  console.log(`${TAG} muteAllVideoElements — found ${videos.length} video(s), ${audios.length} audio(s)`);

  videos.forEach((video) => {
    enforceMuteState(video);
  });

  audios.forEach((audio) => {
    enforceMuteState(audio);
  });

  if (videos.length === 0 && audios.length === 0) {
    console.warn(`${TAG} ⚠️ No media elements found — mute had no effect`);
  }

  // Start watching for dynamically added elements (#1)
  startMediaObserver();
}

function unmuteAllVideoElements(): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  const audios  = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));

  console.log(`${TAG} unmuteAllVideoElements — found ${videos.length} video(s), ${audios.length} audio(s)`);

  videos.forEach((video, i) => {
    video.muted = false;
    const savedVolume = originalVolumes.get(video);
    // Restore original volume — guard against 0 to avoid silent content (#1)
    if (savedVolume !== undefined && savedVolume > 0) {
      video.volume = savedVolume;
    } else if (video.volume === 0) {
      video.volume = 1; // Fallback: restore to full volume
    }
    console.log(`${TAG}   video[${i}] unmuted — volume: ${video.volume}`);
  });

  audios.forEach((audio, i) => {
    audio.muted = false;
    console.log(`${TAG}   audio[${i}] unmuted`);
  });

  // Stop watching for new elements when we're no longer muted (#1)
  stopMediaObserver();
}

// ─── Background notification (#12) ────────────────────────────────────────────

function safeSend(msg: Message): void {
  try {
    if (!chrome?.runtime?.id) {
      // Extension context invalidated (e.g. reloaded) — skip silently (#12)
      return;
    }
    chrome.runtime.sendMessage(msg)
      .then(() => console.log(`${TAG} safeSend OK → ${msg.type}`))
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        // SW being asleep is expected — not an error worth surfacing (#12)
        if (!errMsg.includes('Receiving end does not exist')) {
          console.warn(`${TAG} safeSend FAILED — ${errMsg}`);
        }
      });
  } catch (err) {
    console.warn(`${TAG} safeSend threw:`, err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function muteTab(delay: number = 0): void {
  console.log(`${TAG} muteTab() — delay: ${delay}ms`);
  clearPendingTimers();

  muteTimer = setTimeout(() => {
    console.log(`${TAG} Muting now`);
    currentlyMuted = true;
    adStartTime = Date.now();
    muteAllVideoElements();
    showToast('🔇', 'Ad muted');
    safeSend({ type: 'AD_DETECTED' });
  }, delay);
}

export function unmuteTab(delay: number = 0): void {
  console.log(`${TAG} unmuteTab() — delay: ${delay}ms`);
  clearPendingTimers();

  unmuteTimer = setTimeout(() => {
    console.log(`${TAG} Unmuting now`);
    currentlyMuted = false;
    const durationSeconds = adStartTime
      ? Math.round((Date.now() - adStartTime) / 1000)
      : 0;
    adStartTime = null;
    unmuteAllVideoElements();
    showToast('🔊', 'Audio restored');
    safeSend({ type: 'AD_ENDED', payload: { durationSeconds } });
  }, delay);
}

export function clearPendingTimers(): void {
  if (muteTimer !== null) { clearTimeout(muteTimer); muteTimer = null; }
  if (unmuteTimer !== null) { clearTimeout(unmuteTimer); unmuteTimer = null; }
}

/** Whether the audio is currently muted by AutoMuteAds */
export function isCurrentlyMuted(): boolean {
  return currentlyMuted;
}
