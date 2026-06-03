/**
 * Background Service Worker
 * Central coordinator for the AutoMuteAds extension.
 *
 * Fixes:
 *   #2  - Better fallback when chrome.tabs.update() fails
 *   #6  - Tracks activePlatform per tab for popup display
 *   #12 - Comprehensive error handling throughout
 */

import {
  Message,
  ExtensionSettings,
  AdStatUpdatePayload,
  DEFAULT_SETTINGS,
} from '../types';
import {
  loadSettings,
  saveSettings,
} from '../shared/services/storageService';
import {
  getStats,
  incrementStats,
} from '../shared/services/statsService';


// ─── State ────────────────────────────────────────────────────────────────────

const mutedTabs     = new Map<number, boolean>();
const platformByTab = new Map<number, string>(); // #6: track platform per tab

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fix #2: Attempt tab-level mute with graceful fallback.
 * Tab mute via chrome.tabs.update is secondary — content script DOM mute is primary.
 */
async function setTabMuted(tabId: number, muted: boolean): Promise<void> {
  try {
    // Verify the tab still exists before attempting update (#2)
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      mutedTabs.delete(tabId);
      return;
    }
    await chrome.tabs.update(tabId, { muted });
    mutedTabs.set(tabId, muted);
  } catch (e) {
    // Tab-level mute failed — content script DOM mute is still active, so this is non-fatal (#2, #12)
    console.warn('[AutoMuteAds BG] Tab mute update failed (non-fatal):', e);
    mutedTabs.set(tabId, muted); // track intended state anyway
  }
}

async function broadcastSettingsChange(settings: ExtensionSettings): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_CHANGED',
          payload: settings,
        } as Message).catch(() => {
          // Tabs without content script — expected, ignore
        });
      }
    }
  } catch (err) {
    console.warn('[AutoMuteAds BG] broadcastSettingsChange error:', err);
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    (async () => {
      try {
        let tabId = sender.tab?.id;
        if (!tabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = activeTab?.id;
        }

        const settings = await loadSettings();

        switch (message.type) {
          case 'AD_DETECTED': {
            if (!settings.enabled || !tabId) break;
            const payload = message.payload as { signals?: string[]; platform?: string } | undefined;
            if (payload?.platform) {
              platformByTab.set(tabId, payload.platform); // #6: track platform
            }
            console.log(`[AutoMuteAds BG] Ad detected on tab ${tabId} (${payload?.platform ?? 'unknown'})`);
            await setTabMuted(tabId, true);
            break;
          }

          case 'PLATFORM_DETECTED': {
            if (!tabId) break;
            const payload = message.payload as { platform: string } | undefined;
            if (payload?.platform) {
              platformByTab.set(tabId, payload.platform);
              console.log(`[AutoMuteAds BG] Set platform ${payload.platform} for tab ${tabId}`);
            }
            break;
          }

          case 'AD_ENDED': {
            if (!tabId) break;
            const statPayload = message.payload as AdStatUpdatePayload | undefined;
            const duration = statPayload?.durationSeconds ?? 0;
            console.log(`[AutoMuteAds BG] Ad ended on tab ${tabId}, duration: ${duration}s`);
            await setTabMuted(tabId, false);
            // Always increment count; add time only when duration is known (#stats)
            await incrementStats(Math.max(0, duration)).catch((err) => {
              console.warn('[AutoMuteAds BG] incrementStats failed:', err);
            });
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
            // Forward to the tab's content script which handles actual DOM muting (#9)
            chrome.tabs.sendMessage(tabId, { type: 'MANUAL_MUTE_TOGGLE' } as Message).catch(() => {});
            const isMuted = mutedTabs.get(tabId) ?? false;
            sendResponse({ muted: !isMuted });
            break;
          }

          case 'GET_STATUS': {
            const stats = await getStats();
            sendResponse({
              isMuted:        tabId ? (mutedTabs.get(tabId) ?? false) : false,
              settings,
              activePlatform: tabId ? (platformByTab.get(tabId) ?? null) : null,
              stats, // live stats from local storage
            });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        // #12: Never let unhandled errors in the background worker crash the SW
        console.error('[AutoMuteAds BG] Message handler error:', err);
        sendResponse(null);
      }
    })();

    return true;
  }
);

// ─── Keyboard Commands ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command: string) => {
  if (command === 'toggle-extension') {
    try {
      const settings = await loadSettings();
      const toggled = { ...settings, enabled: !settings.enabled };
      await saveSettings(toggled);
      await broadcastSettingsChange(toggled);
      if (!toggled.enabled) {
        for (const [id] of mutedTabs) await setTabMuted(id, false);
        mutedTabs.clear();
      }
    } catch (err) {
      console.error('[AutoMuteAds BG] Command handler error:', err);
    }
  }
});

// ─── Tab cleanup ──────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId: number) => {
  mutedTabs.delete(tabId);
  platformByTab.delete(tabId); // #6: clean up platform tracking
});

// ─── Install / Update ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
  if (details.reason === 'install') {
    saveSettings(DEFAULT_SETTINGS)
      .then(() => console.log('[AutoMuteAds BG] Installed — default settings saved.'))
      .catch((err) => console.error('[AutoMuteAds BG] Failed to save defaults:', err));
  }
});

console.log('[AutoMuteAds BG] Service worker started.');
