import React, { useEffect } from 'react';
import { usePopupStore } from './store/popupStore';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import WhitelistPanel from './components/WhitelistPanel';

// ─── Nav icons ────────────────────────────────────────────────────────────────

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SettingsIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ShieldCheckIcon = ({ active }: { active: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'settings' | 'whitelist';

const TABS: Array<{ id: Tab; label: string; Icon: React.FC<{ active: boolean }> }> = [
  { id: 'dashboard', label: 'Home', Icon: HomeIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
  { id: 'whitelist', label: 'Whitelist', Icon: ShieldCheckIcon },
];

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const { activeTab, setActiveTab, loadFromBackground, isLoading } = usePopupStore();

  useEffect(() => {
    loadFromBackground();
  }, []);

  return (
    <div className="flex flex-col min-h-[480px] bg-[#0a0f1e] relative overflow-hidden">

      {/* Background glow orbs */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/20">
          🔇
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">AutoMuteAds</h1>
          <p className="text-[10px] text-slate-500">Silence interruptions. Keep the content.</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'settings' && <SettingsPanel />}
            {activeTab === 'whitelist' && <WhitelistPanel />}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="flex border-t border-white/5 bg-[#080c18]">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`nav-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-all duration-200 cursor-pointer
                ${isActive
                  ? 'text-blue-400'
                  : 'text-slate-600 hover:text-slate-400'
                }`}
            >
              <Icon active={isActive} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default App;
