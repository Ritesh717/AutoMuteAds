/**
 * Zustand store for the popup UI.
 * Syncs with chrome.storage via background messages.
 * Stats are loaded from chrome.storage.local directly for real-time accuracy.
 */

import { create } from 'zustand';
import { ExtensionSettings, DEFAULT_SETTINGS } from '../../types';
import type { AdStats } from '../../shared/services/statsService';

interface PopupState {
  settings: ExtensionSettings;
  isMuted: boolean;
  isLoading: boolean;
  activeTab: 'dashboard' | 'settings' | 'whitelist';
  activePlatform: string | null;
  stats: AdStats;

  // Actions
  loadFromBackground: () => Promise<void>;
  refreshStats: () => Promise<void>;
  toggleExtension: () => Promise<void>;
  updateSettings: (patch: Partial<ExtensionSettings>) => Promise<void>;
  addToWhitelist: (domain: string) => Promise<void>;
  removeFromWhitelist: (domain: string) => Promise<void>;
  setActiveTab: (tab: PopupState['activeTab']) => void;
  manualMuteToggle: () => Promise<void>;
}

const DEFAULT_STATS: AdStats = { mutedAdsCount: 0, timeSavedSeconds: 0, lastUpdated: 0 };

async function sendMsg<T>(type: string, payload?: unknown, timeoutMs = 2000): Promise<T | null> {
  const result = await Promise.race([
    chrome.runtime.sendMessage({ type, payload }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  return (result ?? null) as T | null;
}

/** Read stats directly from chrome.storage.local — no SW round-trip needed */
async function readLocalStats(): Promise<AdStats> {
  return new Promise((resolve) => {
    chrome.storage.local.get('automuteads_stats', (result) => {
      const stored = result['automuteads_stats'] as Partial<AdStats> | undefined;
      resolve({ ...DEFAULT_STATS, ...stored });
    });
  });
}

export const usePopupStore = create<PopupState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isMuted: false,
  isLoading: true,
  activeTab: 'dashboard',
  activePlatform: null,
  stats: DEFAULT_STATS,

  loadFromBackground: async () => {
    const [status, stats] = await Promise.all([
      sendMsg<{ isMuted: boolean; settings: ExtensionSettings; activePlatform?: string }>('GET_STATUS'),
      readLocalStats(),
    ]);
    set({
      settings:       status?.settings ?? { ...DEFAULT_SETTINGS },
      isMuted:        status?.isMuted ?? false,
      activePlatform: status?.activePlatform ?? null,
      stats,
      isLoading:      false,
    });

    // Listen to storage changes for live stat updates
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['automuteads_stats']) {
        const newStats = changes['automuteads_stats'].newValue as AdStats;
        if (newStats) set({ stats: newStats });
      }
    });
  },

  refreshStats: async () => {
    const stats = await readLocalStats();
    set({ stats });
  },

  toggleExtension: async () => {
    const newSettings = await sendMsg<ExtensionSettings>('TOGGLE_EXTENSION');
    if (newSettings) set({ settings: newSettings });
  },

  updateSettings: async (patch) => {
    const newSettings = await sendMsg<ExtensionSettings>('UPDATE_SETTINGS', patch);
    if (newSettings) set({ settings: newSettings });
  },

  addToWhitelist: async (domain) => {
    const { settings } = get();
    await get().updateSettings({ whitelist: [...settings.whitelist, domain] });
  },

  removeFromWhitelist: async (domain) => {
    const { settings } = get();
    await get().updateSettings({ whitelist: settings.whitelist.filter((d) => d !== domain) });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  manualMuteToggle: async () => {
    const { isMuted } = get();
    await sendMsg('MANUAL_MUTE_TOGGLE');
    set({ isMuted: !isMuted });
  },
}));
