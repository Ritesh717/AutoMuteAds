# [AutoMuteAds](https://chromewebstore.google.com/detail/automuteads/mifjdjiholhkmemifghhbpcdpafdlkjc)

AutoMuteAds is a lightweight Chrome Extension that silently monitors streaming platforms and automatically mutes your browser tab the instant a video advertisement starts playing. Audio is automatically restored as soon as the ad is over, ensuring a seamless and uninterrupted viewing experience.

## ✨ Features

- **🔇 Instant Mute:** Detects ad starts instantly without relying on delayed DOM mutations.
- **🔊 Automatic Unmute:** Restores audio exactly when the content resumes.
- **🛡️ Platform-Isolated Detection:** Each platform has its own dedicated detector, ensuring zero false positives and high reliability.
- **⚙️ Adjustable Sensitivity:** Choose between Conservative, Balanced, or Aggressive detection modes.
- **⏱️ Configurable Delays:** Fine-tune exactly when the audio mutes or unmutes to perfectly sync with your viewing preferences.
- **📋 Whitelisting:** Disable the extension on specific domains with a single click.
- **⌨️ Keyboard Shortcut:** Quickly toggle the extension on or off using `Ctrl+Shift+M` (`Cmd+Shift+M` on Mac).

## 🎬 Supported Platforms

AutoMuteAds comes with custom-built, highly accurate detectors for the following streaming services:

- **YouTube** (Detects `.ad-showing` overlays and page title changes)
- **JioHotstar / Disney+ Hotstar** (Detects the "Go Ads free" button and internal player SDK events)
- **Zee5** (Monitors the Google IMA SDK countdown timer to pin muting to the exact ad duration)
- **Amazon Prime Video** (Monitors Prime-specific ad badges and timers)
- **Twitch** (Detects banner and countdown overlays)
- **Generic Fallback** (Broad detection for unknown or unsupported platforms using video state heuristics)

## 🔒 Privacy

**AutoMuteAds does not collect, transmit, or store any personal data.** 

The extension operates entirely locally within your browser. It only accesses the active tab to detect ad elements and adjust the volume. No analytics, tracking, or remote network requests are made.

## 🛠️ Installation

### Option 1: Chrome Web Store
*(Link coming soon once published)*

### Option 2: Manual Installation (Developer Mode)
1. Download the latest release `.zip` or clone this repository.
2. If downloaded as a `.zip`, extract the files to a folder.
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **"Developer mode"** in the top right corner.
5. Click **"Load unpacked"** and select the `dist` folder (if building from source) or the extracted folder.

## 💻 Development

AutoMuteAds is built using **TypeScript**, **React** (for the popup UI), **Vite**, and **CRXJS** for modern Chrome Extension bundling.

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Ritesh717/AutoMuteAds.git
   cd AutoMuteAds
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server (with hot-module replacement):
   ```bash
   npm run dev
   ```
   *Note: Load the `dist` folder in Chrome as an unpacked extension. Vite/CRXJS will automatically reload the extension when you save files!*

4. Build for production:
   ```bash
   npm run build
   ```
   This generates the optimized files in the `dist` folder. To create a zip for the Chrome Web Store, you can zip the contents of the `dist` directory.

### Project Structure

- `src/popup/` - React application for the extension's UI.
- `src/background/` - Service worker for managing extension state and keyboard shortcuts.
- `src/content/` - Content scripts injected into web pages.
  - `controllers/` - Handles muting/unmuting the HTML5 `<video>` elements directly.
  - `detectors/platforms/` - Isolated detection logic for specific streaming services.
  - `main.ts` - The entry point that orchestrates platform detection and audio control.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! If you want to add support for a new streaming platform, check out the `src/content/detectors/platforms/` directory for examples on how to implement an isolated detector.

## 📝 License

This project is licensed under the MIT License.
