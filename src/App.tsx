/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { SplashScreen } from './components/SplashScreen';
import { ActiveGamePage } from './pages/ActiveGamePage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { useGameStore } from './store/useGameStore';

export default function App() {
  const isHydrated = useGameStore((s) => s.isHydrated);
  const route = useGameStore((s) => s.route);
  const hydrate = useGameStore((s) => s.hydrate);
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    hydrate();
    const timer = window.setTimeout(() => {
      setMinSplashDone(true);
    }, 950);
    return () => window.clearTimeout(timer);
  }, [hydrate]);

  if (!isHydrated || !minSplashDone) {
    return <SplashScreen />;
  }

  return (
    <Layout>
      {route === 'home' && <HomePage />}
      {route === 'game' && <ActiveGamePage />}
      {route === 'history' && <HistoryPage />}
    </Layout>
  );
}
