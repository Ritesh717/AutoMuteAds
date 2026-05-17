/**
 * Audio Controller
 *
 * Primary: mute/unmute video/audio elements directly in the page DOM.
 * Secondary: notify background to mute at Chrome tab level.
 * UX: show a brief toast on the page when mute state changes.
 */

import { Message } from '../../types';

let muteTimer: ReturnType<typeof setTimeout> | null = null;
let unmuteTimer: ReturnType<typeof setTimeout> | null = null;
let adStartTime: number | null = null;

const originalVolumes = new WeakMap<HTMLVideoElement, number>();
const TAG = '[AutoMuteAds][Audio]';

// ─── Toast notification ───────────────────────────────────────────────────────

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
  injectToastStyles();

  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'automute-toast';
    toastEl.innerHTML = `<span class="automute-icon"></span><span class="automute-text"></span>`;
    document.body.appendChild(toastEl);
  }

  // Update content
  const iconEl = toastEl.querySelector('.automute-icon') as HTMLElement;
  const textEl = toastEl.querySelector('.automute-text') as HTMLElement;
  iconEl.textContent = icon;
  textEl.textContent = text;

  // Show
  toastEl.classList.add('automute-visible');

  // Auto-hide after 2000ms
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    toastEl?.classList.remove('automute-visible');
  }, 2000);
}

// ─── Direct DOM audio control ─────────────────────────────────────────────────

function muteAllVideoElements(): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  const audios  = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));

  console.log(`${TAG} muteAllVideoElements — found ${videos.length} video(s), ${audios.length} audio(s)`);

  videos.forEach((video, i) => {
    if (!originalVolumes.has(video)) {
      originalVolumes.set(video, video.volume);
    }
    const before = { muted: video.muted, volume: video.volume, src: video.currentSrc?.slice(0, 80) };
    video.muted = true;
    console.log(`${TAG}   video[${i}] before:`, before, '→ muted:', video.muted);
  });

  audios.forEach((audio, i) => {
    audio.muted = true;
    console.log(`${TAG}   audio[${i}] muted`);
  });

  if (videos.length === 0 && audios.length === 0) {
    console.warn(`${TAG} ⚠️ No video or audio elements found — mute had no effect`);
  }
}

function unmuteAllVideoElements(): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  const audios  = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));

  console.log(`${TAG} unmuteAllVideoElements — found ${videos.length} video(s), ${audios.length} audio(s)`);

  videos.forEach((video, i) => {
    const savedVolume = originalVolumes.get(video);
    video.muted = false;
    if (savedVolume !== undefined && savedVolume > 0) {
      video.volume = savedVolume;
    }
    console.log(`${TAG}   video[${i}] unmuted — volume restored to ${video.volume}`);
  });

  audios.forEach((audio, i) => {
    audio.muted = false;
    console.log(`${TAG}   audio[${i}] unmuted`);
  });
}

// ─── Background notification (secondary) ─────────────────────────────────────

function safeSend(msg: Message): void {
  if (!chrome.runtime?.id) {
    console.warn(`${TAG} safeSend skipped — extension context invalidated`);
    return;
  }
  chrome.runtime.sendMessage(msg)
    .then(() => console.log(`${TAG} safeSend OK → type: ${msg.type}`))
    .catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`${TAG} safeSend FAILED (SW likely asleep) — ${errMsg}`);
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function muteTab(delay: number = 0): void {
  console.log(`${TAG} muteTab() called — delay: ${delay}ms`);
  clearPendingTimers();

  muteTimer = setTimeout(() => {
    console.log(`${TAG} muteTab timer fired — muting now`);
    adStartTime = Date.now();
    muteAllVideoElements();
    showToast('🔇', 'Ad muted');
    safeSend({ type: 'AD_DETECTED' });
  }, delay);
}

export function unmuteTab(delay: number = 0): void {
  console.log(`${TAG} unmuteTab() called — delay: ${delay}ms`);
  clearPendingTimers();

  unmuteTimer = setTimeout(() => {
    console.log(`${TAG} unmuteTab timer fired — unmuting now`);
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
  if (muteTimer !== null) {
    clearTimeout(muteTimer);
    muteTimer = null;
    console.log(`${TAG} cleared pending muteTimer`);
  }
  if (unmuteTimer !== null) {
    clearTimeout(unmuteTimer);
    unmuteTimer = null;
    console.log(`${TAG} cleared pending unmuteTimer`);
  }
}
