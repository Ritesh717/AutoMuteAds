# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension called AutoMuteAds that automatically detects ad interruptions during video streaming and mutes browser audio during ads, restoring sound when content resumes.

Based on the architecture document, this is a Manifest V3 Chrome extension built with:
- React
- TypeScript
- Tailwind CSS
- Vite build system with CRXJS plugin
- Zustand for state management

## Repository Structure (Planned)

```
src/
  background/
  content/
  popup/
  hooks/
  services/
  detectors/
  utils/
  storage/
  types/
```

## Key Components

1. **Popup UI** - User interface for controlling the extension
2. **Background Service Worker** - Core extension logic and coordination
3. **Content Script** - Runs in web pages to detect ads
4. **Storage Layer** - Settings and user preferences
5. **Detection Engine** - Identifies ad content using multiple strategies
6. **Audio Controller** - Manages muting/unmuting browser tabs

## Development Setup

Since this is a new project, you'll need to:
1. Initialize the project with npm/yarn
2. Install the recommended tech stack dependencies
3. Set up the Vite build system with CRXJS plugin
4. Create the manifest.json file for Chrome extension

## Chrome Extension APIs to Use

- chrome.tabs
- chrome.storage
- chrome.runtime
- chrome.scripting
- chrome.commands

## Core Detection Strategies

1. DOM selectors (look for ad/sponsor/ytp-ad classes)
2. MutationObserver for DOM changes
3. Video state monitoring
4. URL pattern matching
5. Audio pattern analysis

## MVP Features to Implement

- Core audio automation (detect, mute, restore)
- Extension toggle ON/OFF
- Website whitelisting
- Manual mute override
- Dashboard popup with status and counters
- User preferences for sensitivity and delays

## Performance Targets

- CPU usage under 2%
- Memory under 50MB
- Detection latency under 500ms

## Security Considerations

- No browsing history collection
- No user tracking
- Local processing only
- Minimal permissions (<all_urls>, tabs, storage, scripting, activeTab)