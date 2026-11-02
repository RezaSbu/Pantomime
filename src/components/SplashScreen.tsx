import React from 'react';
import { AdabaziLogo } from './AdabaziLogo';

export const SplashScreen: React.FC = () => {
  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-stone-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between px-6 py-6 sm:py-8 relative overflow-hidden">
      {/* Subtle Ambient Stage Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-70 dark:opacity-45"
      >
        <div className="w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-radial from-emerald-500/20 via-amber-400/10 to-transparent blur-2xl" />
      </div>

      {/* Top Spacer for Optical Centering */}
      <div aria-hidden="true" className="h-6" />

      {/* Center Brand & Loading Lockup */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm mx-auto space-y-6 animate-gentle-pop">
        <div className="relative">
          <AdabaziLogo className="w-28 h-28 sm:w-32 sm:h-32 drop-shadow-xl animate-logo-float" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            ادابازی
          </h1>
          <p className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">
            مسابقه گروهی پانتومیم و حدس کلمه
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5 whitespace-nowrap">
            <span>۱۹ موضوع جذاب</span>
            <span aria-hidden="true">·</span>
            <span>چالش طلایی</span>
            <span aria-hidden="true">·</span>
            <span>کاملاً آفلاین</span>
          </div>
        </div>

        {/* Smooth GPU-Composited Loading Bar */}
        <div className="w-52 sm:w-60 space-y-2.5 pt-1">
          <div
            dir="ltr"
            className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
          >
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-500 animate-loading-slide" />
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            در حال بارگذاری مسابقه...
          </div>
        </div>
      </div>

      {/* Bottom Creator Signature */}
      <footer className="relative z-10 text-center pb-safe">
        <a
          href="https://github.com/RezaSbu"
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="inline-flex items-center justify-center gap-1.5 py-1.5 text-xs sm:text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <span>Created By Reza , Ariana</span>
          <span role="img" aria-label="heart" className="text-sm sm:text-base leading-none">
            {'\u2764\uFE0F'}
          </span>
        </a>
      </footer>
    </div>
  );
};
