import {
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react';
import React, { useState } from 'react';
import { ScoreboardTable } from '../components/ScoreboardTable';
import { useGameStore } from '../store/useGameStore';
import {
  difficultyLabel,
  formatJalaliDate,
  formatNum,
  formatSignedNum,
} from '../utils/format';

export const HistoryPage: React.FC = () => {
  const history = useGameStore((s) => s.history);
  const categories = useGameStore((s) => s.categories);
  const settings = useGameStore((s) => s.settings);
  const replayWithTeams = useGameStore((s) => s.replayWithTeams);
  const deleteHistoryItem = useGameStore((s) => s.deleteHistoryItem);
  const wipeHistory = useGameStore((s) => s.wipeHistory);
  const navigate = useGameStore((s) => s.navigate);

  const p = settings.persianDigits;
  const [expandedId, setExpandedId] = useState<string | null>(history[0]?.id ?? null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const catMap: Record<string, string> = { golden: 'موضوع طلایی' };
  for (const c of categories) {
    catMap[c.id] = c.name;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            نتایج مسابقات قبلی
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            جدول امتیازات نهایی و قهرمانان دورهمی‌های گذشته
          </p>
        </div>

        {history.length > 0 && (
          <div>
            {!confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                <span>پاک کردن تاریخچه</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await wipeHistory();
                    setConfirmClearAll(false);
                  }}
                  className="min-h-[42px] px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
                >
                  تأیید حذف همه
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  انصراف
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
          <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            هنوز مسابقه‌ای به پایان نرسیده است
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            پس از اتمام هر بازی، قهرمان و امتیاز تمام تیم‌ها در این قسمت ثبت می‌شود.
          </p>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="min-h-[48px] inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 text-sm font-extrabold"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>شروع اولین مسابقه</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((match) => {
            const winner = match.standings[0];
            const isOpen = expandedId === match.id;
            return (
              <section
                key={match.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
              >
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{formatJalaliDate(match.finishedAt, p)}</span>
                      <span className="mx-2">·</span>
                      <span>{formatNum(match.teams.length, p)} تیم</span>
                      <span className="mx-2">·</span>
                      <span>{formatNum(match.totalRoundsPlayed, p)} دور</span>
                      {match.hadSuddenDeath && (
                        <>
                          <span className="mx-2">·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            مرگ ناگهانی
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tabular-nums">
                      <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                      <span>
                        قهرمان: {winner?.teamName} ({formatNum(winner?.totalScore ?? 0, p)} امتیاز)
                      </span>
                    </h2>

                    <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {match.standings
                        .map(
                          (s, idx) =>
                            `${formatNum(idx + 1, p)}. ${s.teamName}: ${formatNum(s.totalScore, p)}`
                        )
                        .join(' · ')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => replayWithTeams(match.teams)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازی مجدد با همین تیم‌ها</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : match.id)}
                      className="min-h-[44px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-semibold"
                    >
                      <span>{isOpen ? 'بستن جدول' : 'جدول کامل'}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteHistoryItem(match.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      aria-label="حذف این مسابقه از تاریخچه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    <ScoreboardTable
                      standings={match.standings}
                      persianDigits={p}
                      goldenEnabled={true}
                      goldenMaxPerTeam={settings.goldenOpportunitiesPerTeam}
                    />

                    <div className="space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        نوبت‌های اجراشده در این مسابقه ({formatNum(match.events.length, p)} مورد)
                      </h3>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-950/50 px-4">
                        {match.events.map((ev) => {
                          const tName =
                            match.teams.find((t) => t.id === ev.teamId)?.name ?? ev.teamId;
                          const catTitle = catMap[ev.categoryId] ?? ev.categoryId;
                          return (
                            <div
                              key={ev.id}
                              className="py-2.5 flex items-center justify-between gap-2 text-xs tabular-nums"
                            >
                              <div className="min-w-0 truncate">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {tName}
                                </span>
                                <span className="mx-1.5 text-slate-400">·</span>
                                <span className="text-slate-600 dark:text-slate-300">
                                  {catTitle} ({ev.kind === 'golden' ? 'طلایی' : difficultyLabel(ev.difficulty)})
                                </span>
                                <span className="mx-1.5 text-slate-400">·</span>
                                <span className="text-slate-500">
                                  {formatNum(ev.elapsedSeconds, p)} ثانیه
                                </span>
                              </div>
                              <div className="font-bold shrink-0">
                                {ev.netPoints > 0 ? (
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    +{formatNum(ev.netPoints, p)}
                                  </span>
                                ) : ev.netPoints < 0 ? (
                                  <span className="text-rose-600 dark:text-rose-400">
                                    {formatSignedNum(ev.netPoints, p)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">{formatNum(0, p)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
