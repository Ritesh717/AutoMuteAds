import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'AutoMuteAds',
  version: '1.0.0',
  description: 'Automatically mutes browser audio during ads and restores sound when content resumes.',
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: [
        '*://*.youtube.com/*',
        '*://*.hotstar.com/*',
        '*://*.hotstar.in/*',
        '*://*.zee5.com/*',
        '*://*.primevideo.com/*',
        '*://*.amazon.com/*',
        '*://*.twitch.tv/*',
        '*://*.netflix.com/*',
        '*://*.disneyplus.com/*',
      ],
      js: ['src/content/main.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'activeTab'],
  host_permissions: [
    '*://*.youtube.com/*',
    '*://*.hotstar.com/*',
    '*://*.hotstar.in/*',
    '*://*.zee5.com/*',
    '*://*.primevideo.com/*',
    '*://*.amazon.com/*',
    '*://*.twitch.tv/*',
    '*://*.netflix.com/*',
    '*://*.disneyplus.com/*',
  ],
  commands: {
    'toggle-extension': {
      suggested_key: {
        default: 'Ctrl+Shift+M',
        mac: 'Command+Shift+M',
      },
      description: 'Toggle AutoMuteAds on/off',
    },
  },
});
