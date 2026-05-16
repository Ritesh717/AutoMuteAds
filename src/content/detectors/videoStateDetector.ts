/**
 * Video state detector.
 * Monitors HTMLVideoElement properties to infer ad playback.
 */

export interface VideoStateResult {
  isAdLikely: boolean;
  confidence: number;
  signals: string[];
}

/**
 * Analyse all video elements on the page and return ad likelihood.
 * Confidence contribution: up to 20 points (video state signal per architecture).
 */
export function detectAdViaVideoState(): VideoStateResult {
  const videos = Array.from(document.querySelectorAll('video'));
  const signals: string[] = [];
  let confidence = 0;

  for (const video of videos) {
    // YouTube injects a second video element during ads (pip-like overlay)
    if (videos.length > 1) {
      signals.push('multiple-videos');
      confidence += 10;
    }

    // Check for ad-specific data attributes
    const parent = video.closest('[class*="ad"], [class*="Ad"], [id*="ad"], [id*="Ad"]');
    if (parent) {
      signals.push('video-in-ad-container');
      confidence += 15;
    }

    // If the video is very short (under 2 min) it's more likely an ad
    if (video.duration && video.duration > 0 && video.duration < 120) {
      signals.push(`short-duration:${Math.round(video.duration)}s`);
      confidence += 5;
    }
  }

  return {
    isAdLikely: confidence > 0,
    confidence: Math.min(20, confidence),
    signals,
  };
}

/**
 * Get a reference to the primary (longest) video on the page.
 */
export function getPrimaryVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;
  return videos.reduce((longest, v) =>
    (v.duration ?? 0) > (longest.duration ?? 0) ? v : longest
  );
}
