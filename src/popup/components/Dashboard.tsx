import React from 'react';
import { usePopupStore } from '../store/popupStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

const VolumeOffIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const VolumeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Platform emoji map (#6)
const PLATFORM_ICONS: Record<string, string> = {
  YouTube:    '▶️',
  Hotstar:    '🎬',
  Zee5:       '🎥',
  PrimeVideo: '📦',
  Twitch:     '🎮',
  Netflix:    '🎞️',
  'Disney+':  '✨',
  Generic:    '🌐',
};

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { settings, isMuted, activePlatform, stats, toggleExtension, manualMuteToggle } = usePopupStore();
  const { enabled } = settings;
  const { mutedAdsCount, timeSavedSeconds } = stats;

  const platformIcon = activePlatform ? (PLATFORM_ICONS[activePlatform] ?? '🌐') : null;

  return (
    <div className="p-5 space-y-4">

      {/* Hero status */}
      <div className={`glass rounded-2xl p-5 flex items-center justify-between transition-all duration-500 ${enabled ? 'glow-blue border-blue-500/20' : 'border-slate-700/30'}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
            {enabled ? 'Protection Active' : 'Paused'}
          </p>
          <h2 className={`text-2xl font-bold ${enabled ? 'text-gradient' : 'text-slate-500'}`}>
            AutoMuteAds
          </h2>
          {isMuted && (
            <span className="inline-flex items-center gap-1 mt-2 text-xs text-amber-400 font-medium">
              <VolumeOffIcon />
              Muting ad now…
            </span>
          )}
        </div>

        {/* Big toggle */}
        <button
          id="toggle-extension-btn"
          onClick={toggleExtension}
          className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-pointer
            ${enabled
              ? 'bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30 hover:scale-105'
              : 'bg-slate-800 hover:bg-slate-700 hover:scale-105'
            }`}
          aria-label="Toggle extension"
        >
          {enabled ? <VolumeIcon /> : <VolumeOffIcon />}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldIcon />
            <span className="text-xs font-medium uppercase tracking-wider">Ads Muted</span>
          </div>
          <p className="text-3xl font-bold text-white">{mutedAdsCount}</p>
          <p className="text-xs text-slate-500">all-time</p>
        </div>

        <div className="glass rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ClockIcon />
            <span className="text-xs font-medium uppercase tracking-wider">Time Saved</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatTimeSaved(timeSavedSeconds)}</p>
          <p className="text-xs text-slate-500">total</p>
        </div>
      </div>

      {/* Active platform pill (#6) */}
      {activePlatform && (
        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">{platformIcon}</span>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Active Platform</p>
            <p className="text-sm text-white font-semibold">{activePlatform}</p>
          </div>
        </div>
      )}

      {/* Status + manual mute row (#9) */}
      <div className="flex items-center gap-3">
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 flex-1">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <p className="text-sm text-slate-300">
            {enabled ? 'Monitoring for ads…' : 'Extension paused.'}
          </p>
        </div>

        {/* Manual mute toggle button (#9) */}
        {enabled && (
          <button
            id="manual-mute-btn"
            onClick={manualMuteToggle}
            title={isMuted ? 'Unmute now' : 'Mute now'}
            className={`glass rounded-xl px-3 py-3 flex items-center justify-center transition-all duration-200 cursor-pointer
              ${isMuted
                ? 'text-amber-400 border border-amber-400/30 hover:bg-amber-400/10'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            {isMuted
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
            }
          </button>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
