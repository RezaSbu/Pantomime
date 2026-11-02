import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import React, { useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallControl: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>نصب اپلیکیشن (آفلاین)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>نصب در آیفون</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  نصب ادابازی روی آیفون و آیپد
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed list-decimal list-inside">
                <li>در مرورگر Safari دکمه اشتراک‌گذاری (Share) را بزنید.</li>
                <li>گزینه Add to Home Screen را انتخاب کنید.</li>
                <li>دکمه Add را بزنید تا برنامه کاملاً آفلاین نصب شود.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineToastIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>حالت آفلاین فعال است — اجرای کامل از حافظه محلی</span>
    </div>
  );
};
