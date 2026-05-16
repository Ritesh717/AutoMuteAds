import React, { useState } from 'react';
import { usePopupStore } from '../store/popupStore';
import { ExtensionSettings } from '../../types';

// ─── Sensitivity Slider ───────────────────────────────────────────────────────

const SENSITIVITY_OPTIONS: Array<{
  value: ExtensionSettings['sensitivity'];
  label: string;
  description: string;
}> = [
  { value: 'conservative', label: 'Conservative', description: 'Fewer false positives, may miss some ads' },
  { value: 'balanced', label: 'Balanced', description: 'Recommended — good accuracy' },
  { value: 'aggressive', label: 'Aggressive', description: 'Catches more ads, higher false-positive risk' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const SettingsPanel: React.FC = () => {
  const { settings, updateSettings } = usePopupStore();
  const [saved, setSaved] = useState(false);

  const handleSensitivityChange = async (value: ExtensionSettings['sensitivity']) => {
    await updateSettings({ sensitivity: value });
    showSaved();
  };

  const handleDelayChange = async (
    key: 'muteDelay' | 'unmuteDelay',
    value: number
  ) => {
    await updateSettings({ [key]: value });
    showSaved();
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="p-5 space-y-5">

      {/* Sensitivity */}
      <section className="glass rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Detection Sensitivity</h3>
        <div className="space-y-2">
          {SENSITIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              id={`sensitivity-${opt.value}`}
              onClick={() => handleSensitivityChange(opt.value)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-all duration-200 cursor-pointer
                ${settings.sensitivity === opt.value
                  ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                  : 'bg-slate-800/40 border border-transparent text-slate-400 hover:border-slate-600'
                }`}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Delays */}
      <section className="glass rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Timing</h3>

        <div className="space-y-2">
          <label className="flex justify-between text-xs text-slate-400">
            <span>Mute delay</span>
            <span className="text-blue-400 font-medium">{settings.muteDelay}ms</span>
          </label>
          <input
            id="mute-delay-slider"
            type="range"
            min={0}
            max={2000}
            step={100}
            value={settings.muteDelay}
            onChange={(e) => handleDelayChange('muteDelay', Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <label className="flex justify-between text-xs text-slate-400">
            <span>Unmute delay</span>
            <span className="text-blue-400 font-medium">{settings.unmuteDelay}ms</span>
          </label>
          <input
            id="unmute-delay-slider"
            type="range"
            min={0}
            max={3000}
            step={100}
            value={settings.unmuteDelay}
            onChange={(e) => handleDelayChange('unmuteDelay', Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </section>

      {/* Save feedback */}
      {saved && (
        <div className="text-center text-xs text-emerald-400 font-medium animate-pulse">
          ✓ Settings saved
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
