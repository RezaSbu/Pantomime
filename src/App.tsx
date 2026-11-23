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
import { ServerControlPage } from './pages/ServerControlPage';
import { useGameStore } from './store/useGameStore';

function isServerConsolePath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname.replace(/\/+$/, '') || '/';
  return p === '/server';
}

const ServerDownView: React.FC = () => (
  <div
    dir="ltr"
    className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"
  >
    <main className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-9 text-center space-y-4">
      <div
        aria-hidden="true"
        className="w-3 h-3 rounded-full bg-rose-500 mx-auto shadow-[0_0_18px_rgba(244,63,94,0.6)]"
      />
      <h1 className="text-2xl font-extrabold tracking-tight text-white">
        The server is down
      </h1>
    </main>
  </div>
);

export default function App() {
  const isAdminRoute = isServerConsolePath();
  const isHydrated = useGameStore((s) => s.isHydrated);
  const route = useGameStore((s) => s.route);
  const hydrate = useGameStore((s) => s.hydrate);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(isAdminRoute ? true : null);

  useEffect(() => {
    if (isAdminRoute) return;

    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/server/status', { cache: 'no-store' });
        if (!active) return;
        if (!res.ok) {
          setServerOnline(false);
          return;
        }
        const data = (await res.json()) as { online?: boolean };
        setServerOnline(data.online !== false);
      } catch {
        if (!active) return;
        // Allow genuine offline PWA use only when browser itself reports offline
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setServerOnline(true);
        } else {
          setServerOnline(false);
        }
      }
    };

    checkStatus();
    const intervalId = window.setInterval(checkStatus, 5000);
    const onFocus = () => checkStatus();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute) return;
    hydrate();
    const timer = window.setTimeout(() => {
      setMinSplashDone(true);
    }, 950);
    return () => window.clearTimeout(timer);
  }, [hydrate, isAdminRoute]);

  if (isAdminRoute) {
    return <ServerControlPage />;
  }

  if (serverOnline === false) {
    return <ServerDownView />;
  }

  if (serverOnline === null || !isHydrated || !minSplashDone) {
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

