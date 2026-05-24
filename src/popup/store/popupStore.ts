/**
 * Zustand store for the popup UI.
 * Syncs with chrome.storage via background messages.
 */

import { create } from 'zustand';
import { ExtensionSettings, DEFAULT_SETTINGS } from '../../types';

interface PopupState {
  settings: ExtensionSettings;
  isMuted: boolean;
  isLoading: boolean;
  activeTab: 'dashboard' | 'settings' | 'whitelist';
  activePlatform: string | null; // #6: real-time platform name

  // Actions
  loadFromBackground: () => Promise<void>;
  toggleExtension: () => Promise<void>;
  updateSettings: (patch: Partial<ExtensionSettings>) => Promise<void>;
  addToWhitelist: (domain: string) => Promise<void>;
  removeFromWhitelist: (domain: string) => Promise<void>;
  setActiveTab: (tab: PopupState['activeTab']) => void;
  manualMuteToggle: () => Promise<void>; // #9
}

/**
 * Send a message to the background service worker with a timeout fallback.
 */
async function sendMsg<T>(type: string, payload?: unknown, timeoutMs = 2000): Promise<T | null> {
  const result = await Promise.race([
    chrome.runtime.sendMessage({ type, payload }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  return (result ?? null) as T | null;
}

export const usePopupStore = create<PopupState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isMuted: false,
  isLoading: true,
  activeTab: 'dashboard',
  activePlatform: null,

  loadFromBackground: async () => {
    const status = await sendMsg<{ isMuted: boolean; settings: ExtensionSettings; activePlatform?: string }>('GET_STATUS');
    set({
      settings:       status?.settings ?? { ...DEFAULT_SETTINGS },
      isMuted:        status?.isMuted ?? false,
      activePlatform: status?.activePlatform ?? null,
      isLoading:      false,
    });
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
    await get().updateSettings({
      whitelist: settings.whitelist.filter((d) => d !== domain),
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  // #9: manual mute toggle from popup
  manualMuteToggle: async () => {
    const { isMuted } = get();
    await sendMsg('MANUAL_MUTE_TOGGLE');
    set({ isMuted: !isMuted }); // optimistic update
  },
}));
