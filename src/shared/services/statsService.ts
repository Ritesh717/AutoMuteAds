/**
 * Stats Service
 *
 * Stores muted-ads count and time-saved in chrome.storage.local.
 * Separate from settings (chrome.storage.sync) because:
 *   - Stats are device-local, don't need cross-device sync
 *   - chrome.storage.local has a 10MB quota vs 102KB for sync
 *   - Stats update frequently; sync has rate limits
 */

const STATS_KEY = 'automuteads_stats';

export interface AdStats {
  mutedAdsCount: number;
  timeSavedSeconds: number;
  lastUpdated: number; // Unix timestamp ms
}

const DEFAULT_STATS: AdStats = {
  mutedAdsCount: 0,
  timeSavedSeconds: 0,
  lastUpdated: 0,
};

export async function getStats(): Promise<AdStats> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STATS_KEY, (result) => {
      const stored = result[STATS_KEY] as Partial<AdStats> | undefined;
      resolve({ ...DEFAULT_STATS, ...stored });
    });
  });
}

export async function incrementStats(durationSeconds: number): Promise<AdStats> {
  const current = await getStats();
  const updated: AdStats = {
    mutedAdsCount: current.mutedAdsCount + 1,
    timeSavedSeconds: current.timeSavedSeconds + durationSeconds,
    lastUpdated: Date.now(),
  };
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STATS_KEY]: updated }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(updated);
      }
    });
  });
}

export async function resetStats(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STATS_KEY]: DEFAULT_STATS }, resolve);
  });
}
