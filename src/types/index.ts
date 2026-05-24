// Extension settings stored in chrome.storage.sync
export interface ExtensionSettings {
  settingsVersion: number;   // bump when defaults change to force migration
  enabled: boolean;
  sensitivity: 'conservative' | 'balanced' | 'aggressive';
  whitelist: string[];
  muteDelay: number;
  unmuteDelay: number;
  mutedAdsCount: number;
  timeSavedSeconds: number;
  showNotifications: boolean;
}

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  settingsVersion: 2,
  enabled: true,
  sensitivity: 'balanced',
  whitelist: [],
  muteDelay: 300,
  unmuteDelay: 500,
  mutedAdsCount: 0,
  timeSavedSeconds: 0,
  showNotifications: true,
};

// Confidence score thresholds
export const SENSITIVITY_THRESHOLDS: Record<ExtensionSettings['sensitivity'], number> = {
  conservative: 80,
  balanced: 60,
  aggressive: 40,
};

// Message types between content script <-> background worker
export type MessageType =
  | 'AD_DETECTED'
  | 'AD_ENDED'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_STATUS'
  | 'TOGGLE_EXTENSION'
  | 'MANUAL_MUTE_TOGGLE'
  | 'AD_STAT_UPDATE'
  | 'SETTINGS_CHANGED'
  | 'PLATFORM_DETECTED';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface AdDetectedPayload {
  confidence: number;
  signals: string[];
  url: string;
  platform?: string; // #6: active platform name
}

export interface AdStatUpdatePayload {
  durationSeconds: number;
}

export interface TabStatus {
  tabId: number;
  isMuted: boolean;
  isAdActive: boolean;
  url: string;
  activePlatform?: string; // #6: for popup display
}

// Detection confidence breakdown
export interface ConfidenceBreakdown {
  dom: number;
  timing: number;
  videoState: number;
  audio: number;
  total: number;
}
