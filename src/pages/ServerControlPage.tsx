import { Lock, LogOut, Power, RefreshCw, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface AuthStatusResponse {
  authenticated: boolean;
  setupRequired: boolean;
}

interface AdminStateResponse {
  online: boolean;
  updatedAt: string | null;
}

export const ServerControlPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toggling, setToggling] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAuthAndState = useCallback(async (activeToken: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      const res = await fetch('/api/server/auth/status', { headers, cache: 'no-store' });
      const data = (await res.json()) as AuthStatusResponse;
      setSetupRequired(Boolean(data.setupRequired));

      if (data.authenticated && activeToken) {
        const stateRes = await fetch('/api/server/admin-state', {
          headers: { Authorization: `Bearer ${activeToken}` },
          cache: 'no-store',
        });
        if (stateRes.ok) {
          const stateData = (await stateRes.json()) as AdminStateResponse;
          setServerOnline(stateData.online);
          setUpdatedAt(stateData.updatedAt);
        } else {
          setToken(null);
          setServerOnline(null);
        }
      } else {
        if (activeToken) {
          setToken(null);
        }
        setServerOnline(null);
      }
    } catch {
      setErrorMsg('خطا در برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthAndState(token);
  }, [fetchAuthAndState, token]);

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('تکرار رمز عبور مطابقت ندارد.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/server/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setErrorMsg(data.error || 'خطا در ثبت رمز عبور مدیر.');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      setSetupRequired(false);
      setToken(data.token);
    } catch {
      setErrorMsg('خطا در ارتباط با سرور.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!password) {
      setErrorMsg('رمز عبور را وارد کنید.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/server/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setErrorMsg(
          res.status === 429
            ? 'تعداد تلاش‌های ناموفق زیاد است. چند دقیقه دیگر امتحان کنید.'
            : 'رمز عبور نامعتبر است.'
        );
        return;
      }
      setPassword('');
      setToken(data.token);
    } catch {
      setErrorMsg('خطا در ارتباط با سرور.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleServer = async () => {
    if (!token || serverOnline === null || toggling) return;
    setErrorMsg(null);
    setToggling(true);
    try {
      const nextOnline = !serverOnline;
      const res = await fetch('/api/server/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ online: nextOnline }),
      });
      if (res.status === 401) {
        setToken(null);
        setServerOnline(null);
        setErrorMsg('نشست مدیر منقضی شد. دوباره وارد شوید.');
        return;
      }
      const data = (await res.json()) as AdminStateResponse & { error?: string };
      if (!res.ok || typeof data.online !== 'boolean') {
        setErrorMsg(data.error || 'تغییر وضعیت سرور ناموفق بود.');
        return;
      }
      setServerOnline(data.online);
      setUpdatedAt(data.updatedAt);
    } catch {
      setErrorMsg('خطا در ارسال درخواست به سرور.');
    } finally {
      setToggling(false);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setServerOnline(null);
    setErrorMsg(null);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-7 shadow-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">کنترل وضعیت سرور</h1>
              <p className="text-xs text-slate-400">Server Administration Console</p>
            </div>
          </div>

          {token && (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-xs font-bold text-rose-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>در حال بررسی وضعیت...</span>
          </div>
        ) : token && serverOnline !== null ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs text-slate-400">وضعیت فعلی سایت اصلی</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      serverOnline
                        ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]'
                        : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                    }`}
                  />
                  <span className="text-base font-extrabold text-white">
                    {serverOnline ? 'آنلاین (روشن)' : 'آفلاین (خاموش)'}
                  </span>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-lg text-xs font-extrabold border ${
                  serverOnline
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {serverOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <p className="text-xs leading-6 text-slate-400">
              {serverOnline
                ? 'در حال حاضر بازی برای همه کاربران باز است. با خاموش کردن سرور، صفحه اصلی عبارت «The server is down» را نمایش می‌دهد.'
                : 'سرور خاموش است. بازدیدکنندگان صفحه اصلی پیام «The server is down» را می‌بینند و امکان اجرای بازی را ندارند.'}
            </p>

            <button
              type="button"
              disabled={toggling}
              onClick={handleToggleServer}
              className={`w-full min-h-[52px] rounded-2xl px-5 py-3 text-sm font-extrabold text-white inline-flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 ${
                serverOnline
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <Power className="w-4 h-4 shrink-0" />
              <span>
                {toggling
                  ? 'در حال اعمال...'
                  : serverOnline
                  ? 'خاموش کردن سرور (Offline)'
                  : 'روشن کردن سرور (Online)'}
              </span>
            </button>

            {updatedAt && (
              <div className="text-[11px] text-slate-500 text-center" dir="ltr">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        ) : setupRequired ? (
          <form onSubmit={handleClaimAdmin} className="space-y-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-3.5 text-xs leading-6 text-amber-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-1 text-amber-400" />
              <span>
                رمز عبور مدیر هنوز تنظیم نشده است. یک رمز عبور اختصاصی (حداقل ۸ کاراکتر) تعیین کنید تا دسترسی کنترل سرور قفل شود.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">رمز عبور جدید مدیر</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
                dir="ltr"
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">تکرار رمز عبور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
                dir="ltr"
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'در حال ثبت...' : 'ثبت رمز عبور و ورود'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-xs leading-6 text-slate-400">
              برای مشاهده وضعیت و روشن یا خاموش کردن سرور، رمز عبور مدیر را وارد کنید.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">رمز عبور مدیر</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
                dir="ltr"
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'در حال بررسی...' : 'ورود به پنل سرور'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
