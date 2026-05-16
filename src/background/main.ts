/**
 * Background Service Worker
 * Central coordinator for the AutoMuteAds extension.
 * Manages mute state, settings, and bridges content scripts ↔ popup.
 */

import {
  Message,
  ExtensionSettings,
  AdDetectedPayload,
  AdStatUpdatePayload,
  DEFAULT_SETTINGS,
} from '../types';
import {
  loadSettings,
  saveSettings,
  incrementMutedAds,
} from '../shared/services/storageService';

// ─── State ────────────────────────────────────────────────────────────────────

/** tabId → whether the tab is muted due to an ad */
const mutedTabs = new Map<number, boolean>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setTabMuted(tabId: number, muted: boolean): Promise<void> {
  try {
    await chrome.tabs.update(tabId, { muted });
    mutedTabs.set(tabId, muted);
  } catch (e) {
    console.error('[AutoMuteAds BG] Failed to update tab mute state:', e);
  }
}

async function broadcastSettingsChange(settings: ExtensionSettings): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SETTINGS_CHANGED',
        payload: settings,
      } as Message).catch(() => {
        // Ignore tabs without content script
      });
    }
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    const tabId = sender.tab?.id;

    (async () => {
      const settings = await loadSettings();

      switch (message.type) {
        case 'AD_DETECTED': {
          if (!settings.enabled) break;
          if (!tabId) break;
          const payload = message.payload as AdDetectedPayload | undefined;
          console.log(
            `[AutoMuteAds BG] Ad detected on tab ${tabId}`,
            payload?.signals ?? []
          );
          await setTabMuted(tabId, true);
          break;
        }

        case 'AD_ENDED': {
          if (!tabId) break;
          const statPayload = message.payload as AdStatUpdatePayload | undefined;
          const duration = statPayload?.durationSeconds ?? 0;
          console.log(
            `[AutoMuteAds BG] Ad ended on tab ${tabId}, duration: ${duration}s`
          );
          await setTabMuted(tabId, false);
          if (duration > 0) {
            await incrementMutedAds(duration);
          }
          break;
        }

        case 'GET_SETTINGS': {
          sendResponse(settings);
          break;
        }

        case 'UPDATE_SETTINGS': {
          const updated = message.payload as Partial<ExtensionSettings>;
          await saveSettings(updated);
          const newSettings = await loadSettings();
          await broadcastSettingsChange(newSettings);
          sendResponse(newSettings);
          break;
        }

        case 'TOGGLE_EXTENSION': {
          const toggled = { ...settings, enabled: !settings.enabled };
          await saveSettings(toggled);
          const newSettings = await loadSettings();
          await broadcastSettingsChange(newSettings);

          // If turning off, unmute all currently muted tabs
          if (!newSettings.enabled) {
            for (const [id] of mutedTabs) {
              await setTabMuted(id, false);
            }
            mutedTabs.clear();
          }

          sendResponse(newSettings);
          break;
        }

        case 'MANUAL_MUTE_TOGGLE': {
          if (!tabId) break;
          const isMuted = mutedTabs.get(tabId) ?? false;
          await setTabMuted(tabId, !isMuted);
          sendResponse({ muted: !isMuted });
          break;
        }

        case 'GET_STATUS': {
          sendResponse({
            isMuted: tabId ? (mutedTabs.get(tabId) ?? false) : false,
            settings,
          });
          break;
        }

        default:
          break;
      }
    })();

    // Return true to keep the message channel open for async sendResponse
    return true;
  }
);

// ─── Keyboard Commands ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command: string) => {
  if (command === 'toggle-extension') {
    chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION' } as Message);
  }
});

// ─── Tab cleanup ──────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId: number) => {
  mutedTabs.delete(tabId);
});

// ─── Install / Update ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  if (details.reason === 'install') {
    saveSettings(DEFAULT_SETTINGS).then(() => {
      console.log('[AutoMuteAds BG] Extension installed, default settings saved.');
    });
  }
});

console.log('[AutoMuteAds BG] Service worker started.');
