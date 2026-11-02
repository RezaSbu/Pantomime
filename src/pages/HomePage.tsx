import {
  Check,
  ChevronLeft,
  Crown,
  HelpCircle,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { AdabaziLogo } from '../components/AdabaziLogo';
import { DynamicIcon } from '../components/DynamicIcon';
import { PWAInstallControl } from '../components/PWAInstallControl';
import { getActiveTeam } from '../engine/gameEngine';
import { feedbackEngine } from '../engine/soundEngine';
import { getRoundTeamOrder } from '../engine/roundManager';
import { computeTeamStandings } from '../engine/scoringEngine';
import { useGameStore } from '../store/useGameStore';
import { Team } from '../types/game';
import {
  DEFAULT_TEAM_NAMES,
  formatNum,
  TEAM_COLOR_PALETTE,
  TEAM_ICONS,
} from '../utils/format';

const ROUND_PRESETS = [3, 5, 7, 10];

export const HomePage: React.FC = () => {
  const activeMatch = useGameStore((s) => s.activeMatch);
  const settings = useGameStore((s) => s.settings);
  const setupDraftTeams = useGameStore((s) => s.setupDraftTeams);
  const startNewMatch = useGameStore((s) => s.startNewMatch);
  const resumeSavedMatch = useGameStore((s) => s.resumeSavedMatch);
  const abandonActiveMatch = useGameStore((s) => s.abandonActiveMatch);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);
  const showToast = useGameStore((s) => s.showToast);

  const p = settings.persianDigits;
  const hasSavedGame = Boolean(activeMatch && activeMatch.phase !== 'GAME_OVER');

  const [teams, setTeams] = useState<Team[]>(() =>
    setupDraftTeams.map((t) => ({ ...t }))
  );
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [isCustomRounds, setIsCustomRounds] = useState<boolean>(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const activeTeamInSaved =
    hasSavedGame && activeMatch ? getActiveTeam(activeMatch) : null;
  const liveStandings =
    hasSavedGame && activeMatch
      ? computeTeamStandings(
          activeMatch.teams,
          activeMatch.allEvents,
          activeMatch.extraWrongGuessesByTeam,
          activeMatch.goldenUsedByTeam,
          settings.allowNegativeScore
        )
      : [];

  const addTeam = () => {
    if (teams.length >= 8) return;
    feedbackEngine.onTap(settings.soundEnabled);
    const idx = teams.length;
    const newTeam: Team = {
      id: `team_${Date.now()}_${idx}`,
      name: DEFAULT_TEAM_NAMES[idx] ?? `تیم ${idx + 1}`,
      color: TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length].hex,
      icon: TEAM_ICONS[idx % TEAM_ICONS.length],
    };
    setTeams([...teams, newTeam]);
  };

  const removeTeam = (id: string) => {
    if (teams.length <= 2) {
      showToast('حداقل ۲ تیم برای شروع مسابقه لازم است.');
      return;
    }
    feedbackEngine.onTap(settings.soundEnabled);
    const filtered = teams.filter((t) => t.id !== id);
    setTeams(filtered);
  };

  const updateTeam = (id: string, patch: Partial<Team>) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleLaunchGame = () => {
    const sanitizedTeams = teams.map((t, i) => ({
      ...t,
      name: t.name.trim() || DEFAULT_TEAM_NAMES[i] || `تیم ${i + 1}`,
    }));
    startNewMatch({
      teams: sanitizedTeams,
      totalRounds: Math.max(1, Math.min(30, totalRounds)),
      wordsPerTurn: 1,
      startOrderMode: 'first',
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Saved Active Match Banner (if a match is in progress) */}
      {hasSavedGame && activeMatch && activeTeamInSaved && (
        <section className="rounded-3xl border-2 border-emerald-600/40 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/25 p-4 sm:p-5 space-y-4 animate-gentle-pop">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: activeTeamInSaved.color }}
              >
                <DynamicIcon name={activeTeamInSaved.icon} className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  مسابقه نیمه‌تمام آماده ادامه است
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums truncate">
                  <span>
                    {activeMatch.isSuddenDeath
                      ? `مرگ ناگهانی ${formatNum(activeMatch.suddenDeathRound, p)}`
                      : `دور ${formatNum(activeMatch.currentRound, p)} از ${formatNum(
                          activeMatch.totalRounds,
                          p
                        )}`}
                  </span>
                  <span className="mx-1.5">·</span>
                  <span>نوبت: {activeTeamInSaved.name}</span>
                  {liveStandings[0] && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span>
                        پیشتاز: {liveStandings[0].teamName} ({formatNum(liveStandings[0].totalScore, p)})
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={resumeSavedMatch}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-5 py-2.5 text-sm font-extrabold transition-all whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>ادامه مسابقه قبلی</span>
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>

            {!confirmAbandon ? (
              <button
                type="button"
                onClick={() => setConfirmAbandon(true)}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                پایان دادن به قبلی
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await abandonActiveMatch();
                  setConfirmAbandon(false);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold whitespace-nowrap"
              >
                تأیید حذف بازی قبلی
              </button>
            )}
          </div>
        </section>
      )}

      {/* Clean Mobile-First Game Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <AdabaziLogo className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-sm" />
          <div className="space-y-1 min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white"
              style={{ textWrap: 'balance' }}
            >
              شروع مسابقه جدید ادابازی
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              تیم‌ها و تعداد دور را مشخص کنید؛ در طول بازی هر تیم موضوع و سطح دشواری خودش را انتخاب می‌کند.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="hidden sm:inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>مشاهده قوانین</span>
        </button>
      </div>

      {/* Main Responsive Grid: Teams (Right/Top) + Rounds & Launch (Left/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Teams Setup */}
        <section className="lg:col-span-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                تیم‌های بازی ({formatNum(teams.length, p)} تیم)
              </h2>
            </div>

            <button
              type="button"
              onClick={addTeam}
              disabled={teams.length >= 8}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3.5 py-2 text-xs font-extrabold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>افزودن تیم</span>
            </button>
          </div>

          <div className="space-y-3">
            {teams.map((team, idx) => {
              const isExpanded = editingTeamId === team.id;
              return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50/80 dark:bg-slate-950/60 p-3 sm:p-3.5 space-y-3"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        feedbackEngine.onTap(settings.soundEnabled);
                        setEditingTeamId(isExpanded ? null : team.id);
                      }}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 active:scale-95 transition-transform"
                      style={{ backgroundColor: team.color }}
                      title="انتخاب رنگ و نماد"
                      aria-label={`تغییر رنگ و نماد ${team.name}`}
                    >
                      <DynamicIcon name={team.icon} className="w-5 h-5" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <label className="sr-only" htmlFor={`team-input-${team.id}`}>
                        نام تیم {idx + 1}
                      </label>
                      <input
                        id={`team-input-${team.id}`}
                        type="text"
                        value={team.name}
                        maxLength={24}
                        onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                        placeholder={DEFAULT_TEAM_NAMES[idx]}
                        className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        feedbackEngine.onTap(settings.soundEnabled);
                        setEditingTeamId(isExpanded ? null : team.id);
                      }}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      {isExpanded ? 'بستن' : 'رنگ'}
                    </button>

                    {teams.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeTeam(team.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                        aria-label={`حذف ${team.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {TEAM_COLOR_PALETTE.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              feedbackEngine.onTap(settings.soundEnabled);
                              updateTeam(team.id, { color: c.hex });
                            }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white active:scale-95 transition-transform"
                            style={{ backgroundColor: c.hex }}
                            aria-label={c.label}
                          >
                            {team.color === c.hex && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {TEAM_ICONS.map((iconName) => {
                          const selected = team.icon === iconName;
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => {
                                feedbackEngine.onTap(settings.soundEnabled);
                                updateTeam(team.id, { icon: iconName });
                              }}
                              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                                selected
                                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              <DynamicIcon name={iconName} className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Column 2: Rounds, Starting Order & Start Button */}
        <section className="lg:col-span-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-6">
          {/* Number of Rounds */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                تعداد دورهای بازی
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                مجموعاً {formatNum(totalRounds * teams.length, p)} نوبت
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {ROUND_PRESETS.map((r) => {
                const active = !isCustomRounds && totalRounds === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      feedbackEngine.onTap(settings.soundEnabled);
                      setIsCustomRounds(false);
                      setTotalRounds(r);
                    }}
                    className={`min-h-[46px] rounded-xl border text-xs sm:text-sm font-extrabold tabular-nums transition-colors whitespace-nowrap ${
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {formatNum(r, p)} دور
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  feedbackEngine.onTap(settings.soundEnabled);
                  setIsCustomRounds(true);
                }}
                className={`min-h-[46px] rounded-xl border text-xs font-extrabold transition-colors whitespace-nowrap ${
                  isCustomRounds
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                }`}
              >
                دلخواه
              </button>
            </div>

            {isCustomRounds && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <label
                  htmlFor="custom-rounds-input"
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  تعداد دور دلخواه (۱ تا ۳۰):
                </label>
                <input
                  id="custom-rounds-input"
                  type="number"
                  min={1}
                  max={30}
                  value={totalRounds}
                  onChange={(e) =>
                    setTotalRounds(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                  }
                  className="w-24 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 px-3 text-center font-extrabold tabular-nums"
                />
              </div>
            )}
          </div>

          {/* Turn Cycle & Final Round Summary Box */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              ترتیب چرخشی اجرای نوبت‌ها
            </h2>

            <div className="rounded-2xl bg-stone-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <div className="leading-relaxed">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  ترتیب ثابت هر دور:
                </span>{' '}
                {getRoundTeamOrder(teams, 0, 1)
                  .map((id) => teams.find((t) => t.id === id)?.name ?? '')
                  .join(' ← ')}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  در تمام دورها بازی از «{teams[0]?.name ?? 'تیم ۱'}» شروع می‌شود و پس از آخرین تیم، دوباره نوبت به «{teams[0]?.name ?? 'تیم ۱'}» برمی‌گردد.
                </div>
              </div>
              <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300 font-semibold pt-1 border-t border-slate-200/70 dark:border-slate-800">
                <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  موضوع طلایی {formatNum(30, p)} امتیازی فقط در دور آخر (دور{' '}
                  {formatNum(totalRounds, p)}) باز می‌شود!
                </span>
              </div>
            </div>
          </div>

          {/* Primary Launch CTA */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleLaunchGame}
              className="w-full min-h-[56px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-6 py-4 text-base sm:text-lg font-black shadow-sm transition-all whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current shrink-0" />
              <span>شروع مسابقه!</span>
            </button>

            <div className="flex justify-center">
              <PWAInstallControl />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
