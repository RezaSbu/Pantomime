/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { ActiveGamePage } from './pages/ActiveGamePage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { useGameStore } from './store/useGameStore';

export default function App() {
  const isHydrated = useGameStore((s) => s.isHydrated);
  const route = useGameStore((s) => s.route);
  const hydrate = useGameStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div className="min-h-[100dvh] bg-stone-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ادابازی
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            در حال بارگذاری مسابقه...
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {route === 'home' && <HomePage />}
      {route === 'game' && <ActiveGamePage />}
      {route === 'history' && <HistoryPage />}
    </Layout>
  );
}
