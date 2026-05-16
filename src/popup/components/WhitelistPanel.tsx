import React, { useState } from 'react';
import { usePopupStore } from '../store/popupStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

const WhitelistPanel: React.FC = () => {
  const { settings, addToWhitelist, removeFromWhitelist } = usePopupStore();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async () => {
    const domain = inputValue.trim().toLowerCase().replace(/^www\./, '');
    if (!domain) return;

    // Basic domain validation
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      setError('Enter a valid domain (e.g. example.com)');
      return;
    }

    if (settings.whitelist.includes(domain)) {
      setError('Already in whitelist');
      return;
    }

    setError('');
    await addToWhitelist(domain);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="p-5 space-y-4">

      <div className="glass rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Add Website</h3>
        <p className="text-xs text-slate-500">
          AutoMuteAds will be disabled on whitelisted sites.
        </p>

        <div className="flex gap-2">
          <input
            id="whitelist-input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. youtube.com"
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button
            id="whitelist-add-btn"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
          >
            <PlusIcon />
            Add
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Whitelist entries */}
      <div className="glass rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
          Whitelisted Sites
          <span className="ml-2 text-xs text-slate-500 normal-case font-normal">({settings.whitelist.length})</span>
        </h3>

        {settings.whitelist.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">No sites whitelisted yet.</p>
        ) : (
          <ul className="space-y-2">
            {settings.whitelist.map((domain) => (
              <li
                key={domain}
                className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2"
              >
                <span className="text-sm text-slate-300">{domain}</span>
                <button
                  id={`remove-${domain}`}
                  onClick={() => removeFromWhitelist(domain)}
                  className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer p-1"
                  aria-label={`Remove ${domain}`}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WhitelistPanel;
