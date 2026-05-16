# AutoMuteAds — Product Requirements + Architecture + Implementation Document

## Product Vision
AutoMuteAds is a Chrome browser extension that automatically detects ad interruptions during video streaming and intelligently mutes browser audio during ads, restoring sound when content resumes.

Goal: eliminate disruptive ad experiences without requiring m`anual intervention.

---

# Problem Statement

Users watching streams and videos frequently encounter:
- Sudden loud advertisements
- Repetitive ad interruptions
- Manual mute/unmute frustration
- Volume spikes compared to content
- Interrupted viewing flow

AutoMuteAds creates a seamless streaming experience.

---

# User Personas

### Casual Streamer
Watches YouTube and OTT content.
Needs a passive solution.

### Heavy Content Consumer
Streams for hours.
Needs reliable automation.

### Work User
Keeps streams running while working.
Needs interruption reduction.

---

# MVP Features

### Core Audio Automation
- Detect ad playback
- Auto mute browser tab
- Restore audio after ad
- Toggle extension ON/OFF
- Whitelist websites
- Manual mute override

### Dashboard Popup
- Current extension status
- Ads muted counter
- Active site display
- Enable/disable switch

### User Preferences
- Site specific rules
- Sensitivity settings
- Delay before mute
- Delay before restore

---

# Advanced Features (V2)

### AI Detection
Use multiple signals:
- DOM changes
- Ad labels
- Video metadata
- CSS classes
- Timing patterns

### Smart Audio Detection
Detect:
- sudden volume spikes
- abrupt content transitions
- repetitive signatures

### Analytics
- ads muted today
- time saved
- websites with most ads

### Profiles
- Aggressive mode
- Balanced mode
- Conservative mode

### Keyboard shortcuts
- Toggle mute
- Pause extension

---

# UX Flow

User opens video → Extension watches page → Ad detected → Audio muted → Ad ends → Audio restored

Failure flow:
If confidence low → ask user whether detected content was an ad

---

# Browser Architecture

Chrome Extension Manifest V3

Components:

1. Popup UI
2. Background Service Worker
3. Content Script
4. Storage Layer
5. Detection Engine
6. Audio Controller

Architecture:

Browser Tab
↓
Content Script
↓
Ad Detection Engine
↓
Background Worker
↓
Mute Controller
↓
Chrome Tab APIs

---

# Recommended Tech Stack

Frontend
- React
- TypeScript
- Tailwind
- Vite

Chrome APIs
- chrome.tabs
- chrome.storage
- chrome.runtime
- chrome.scripting
- chrome.commands

State Management
- Zustand

Build System
- Vite
- CRXJS plugin

Testing
- Jest
- Playwright

Analytics
- PostHog (optional)

CI/CD
- GitHub Actions

---

# Extension Structure

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

---

# Detection Strategies

Strategy 1:
DOM selectors
Examples:
- ad
- sponsor
- ytp-ad

Strategy 2:
Observe MutationObserver changes

Strategy 3:
Video state changes

Strategy 4:
URL patterns

Strategy 5:
Audio pattern analysis

Confidence scoring:

DOM signal=40
Timing=20
Video state=20
Audio=20

Mute if score >70

---

# Core Implementation Pseudocode

Mutation observer starts

If ad indicators detected:
    confidence += score

If confidence threshold met:
    mute tab

Monitor content state

If ad ends:
    unmute tab

---

# Manifest Permissions

permissions:
- storage
- tabs
- scripting
- activeTab

host_permissions:
- <all_urls>

---

# Storage Model

settings:
{
 enabled:true,
 sensitivity:'balanced',
 whitelist:[],
 mutedAds:0
}

---

# Performance Constraints

CPU usage under 2%
Memory under 50MB
Detection latency under 500ms

---

# Security

No browsing history collection
No user tracking
Local processing only
Minimal permissions

---

# Roadmap

V1
- YouTube support
- mute/unmute automation
- popup UI

V2
- Netflix
- Twitch
- Prime Video

V3
- AI ad detection
- community rules

---

# Chrome Store Positioning

Tagline:
"Silence interruptions. Keep the content."

Store category:
Productivity

Keywords:
mute ads
youtube mute
auto ad mute
streaming helper
browser audio control

