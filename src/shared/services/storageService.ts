import {
  ExtensionSettings,
  DEFAULT_SETTINGS,
} from '../../types';

const STORAGE_KEY = 'automuteads_settings';

/**
 * Load settings from chrome.storage.sync with fallback to defaults.
 */
export async function loadSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

/**
 * Persist settings to chrome.storage.sync.
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const current = (result[STORAGE_KEY] as Partial<ExtensionSettings>) ?? DEFAULT_SETTINGS;
      const updated = { ...current, ...settings };
      chrome.storage.sync.set({ [STORAGE_KEY]: updated }, resolve);
    });
  });
}

/**
 * Increment the global muted-ads counter and add time saved.
 */
export async function incrementMutedAds(durationSeconds: number): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    mutedAdsCount: settings.mutedAdsCount + 1,
    timeSavedSeconds: settings.timeSavedSeconds + durationSeconds,
  });
}

/**
 * Add a domain to the whitelist.
 */
export async function addToWhitelist(domain: string): Promise<void> {
  const settings = await loadSettings();
  if (!settings.whitelist.includes(domain)) {
    await saveSettings({ whitelist: [...settings.whitelist, domain] });
  }
}

/**
 * Remove a domain from the whitelist.
 */
export async function removeFromWhitelist(domain: string): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    whitelist: settings.whitelist.filter((d) => d !== domain),
  });
}

/**
 * Check if a domain is whitelisted.
 */
export function isDomainWhitelisted(domain: string, whitelist: string[]): boolean {
  return whitelist.some((w) => domain === w || domain.endsWith(`.${w}`));
}
