import { HelpCircle, History, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect } from 'react';
import { feedbackEngine } from '../engine/soundEngine';
import { useGameStore } from '../store/useGameStore';
import { OfflineToastIndicator } from './PWAInstallControl';
import { RulesSheet } from './RulesSheet';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const route = useGameStore((s) => s.route);
  const navigate = useGameStore((s) => s.navigate);
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);
  const toastMessage = useGameStore((s) => s.toastMessage);
  const showToast = useGameStore((s) => s.showToast);

  // Unlock mobile Web Audio API on first user touch/click anywhere
  useEffect(() => {
    const unlock = () => feedbackEngine.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => showToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage, showToast]);

  const handleToggleSound = () => {
    const nextSound = !settings.soundEnabled;
    updateSettings({ soundEnabled: nextSound });
    if (nextSound) {
      feedbackEngine.unlock();
      feedbackEngine.onSelectTopic(true, settings.vibrationEnabled);
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    feedbackEngine.onTap(settings.soundEnabled);
    updateSettings({ theme: nextTheme });
  };

  if (route === 'game') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-stone-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
        <footer className="shrink-0 py-1.5 sm:py-2 px-4 text-center border-t border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe">
          <a
            href="https://github.com/RezaSbu"
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="inline-flex items-center justify-center gap-1.5 py-0.5 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <span>Created By Reza , Ariana</span>
            <span role="img" aria-label="heart" className="text-sm leading-none">
              {'\u2764\uFE0F'}
            </span>
          </a>
        </footer>
        <RulesSheet />
        <OfflineToastIndicator />
        {toastMessage && (
          <div className="fixed top-14 inset-x-4 max-w-md mx-auto z-50 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-xs sm:text-sm font-bold shadow-lg text-center animate-gentle-pop">
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-stone-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Compact 3-Zone Mobile-First App Header */}
      <header className="shrink-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-xl font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            ادابازی
          </button>

          {/* Zone 2: Minimal Game Links */}
          <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => navigate('home')}
              className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                route === 'home'
                  ? 'text-emerald-700 dark:text-emerald-400 border-emerald-600 dark:border-emerald-400 font-bold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              شروع مسابقه
            </button>
            <button
              type="button"
              onClick={() => navigate('history')}
              className={`py-1 inline-flex items-center gap-1 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                route === 'history'
                  ? 'text-emerald-700 dark:text-emerald-400 border-emerald-600 dark:border-emerald-400 font-bold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:hidden" />
              <span>نتایج قبلی</span>
            </button>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="py-1 inline-flex items-center gap-1 whitespace-nowrap shrink-0 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 sm:hidden" />
              <span>قوانین</span>
            </button>
          </nav>

          {/* Zone 3: Quick Audio & Theme Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                settings.soundEnabled
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              aria-label={settings.soundEnabled ? 'قطع صدای بازی' : 'وصل صدای بازی'}
              title={settings.soundEnabled ? 'صدای بازی روشن است' : 'صدای بازی خاموش است'}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="تغییر تم روشن و تاریک"
              title="تغییر تم"
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8">
          {children}
        </div>
      </main>

      <footer className="shrink-0 z-30 py-2.5 px-4 text-center border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe">
        <a
          href="https://github.com/RezaSbu"
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="inline-flex items-center justify-center gap-1.5 py-0.5 text-xs sm:text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <span>Created By Reza , Ariana</span>
          <span role="img" aria-label="heart" className="text-sm sm:text-base leading-none">
            {'\u2764\uFE0F'}
          </span>
        </a>
      </footer>

      <RulesSheet />
      <OfflineToastIndicator />

      {toastMessage && (
        <div className="fixed top-16 inset-x-4 max-w-md mx-auto z-50 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 text-xs sm:text-sm font-bold shadow-lg text-center animate-gentle-pop">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
