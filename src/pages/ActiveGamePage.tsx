import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  ChevronLeft,
  Crown,
  Eye,
  EyeOff,
  Flag,
  HelpCircle,
  Home,
  ListOrdered,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DynamicIcon } from '../components/DynamicIcon';
import { ScoreboardTable } from '../components/ScoreboardTable';
import {
  canActiveTeamUseGolden,
  getActiveTeam,
  getTeamUsedCombos,
  isComboUsedByTeam,
  isFinalRegularRound,
} from '../engine/gameEngine';
import { getRoundTeamOrder } from '../engine/roundManager';
import {
  calculateWordScore,
  computeTeamStandings,
  detectTopTiedTeams,
  getActiveSpeedBonusWindow,
} from '../engine/scoringEngine';
import { feedbackEngine } from '../engine/soundEngine';
import { getTimerSnapshot } from '../engine/timerEngine';
import { useTiltControls } from '../hooks/useTiltControls';
import { useGameStore } from '../store/useGameStore';
import { CategoryItem, Difficulty } from '../types/game';
import {
  difficultyLabel,
  formatClock,
  formatNum,
  formatSignedNum,
} from '../utils/format';

const DIFFICULTIES_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export const ActiveGamePage: React.FC = () => {
  const activeMatch = useGameStore((s) => s.activeMatch);
  const categories = useGameStore((s) => s.categories);
  const settings = useGameStore((s) => s.settings);
  const navigate = useGameStore((s) => s.navigate);
  const showToast = useGameStore((s) => s.showToast);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);

  const prepareTurnCard = useGameStore((s) => s.prepareTurnCard);
  const cancelPreRevealSelection = useGameStore((s) => s.cancelPreRevealSelection);
  const revealSecretWord = useGameStore((s) => s.revealSecretWord);
  const concealSecretWord = useGameStore((s) => s.concealSecretWord);
  const startTimerForTurn = useGameStore((s) => s.startTimerForTurn);
  const togglePlayWordMask = useGameStore((s) => s.togglePlayWordMask);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const wrongGuess = useGameStore((s) => s.wrongGuess);
  const correctGuess = useGameStore((s) => s.correctGuess);
  const swapWord = useGameStore((s) => s.swapWord);
  const reportInvalidWord = useGameStore((s) => s.reportInvalidWord);
  const triggerTimeExpired = useGameStore((s) => s.triggerTimeExpired);
  const endTurnManuallyOrTimeout = useGameStore((s) => s.endTurnManuallyOrTimeout);
  const nextTurnOrSummary = useGameStore((s) => s.nextTurnOrSummary);
  const beginNextRound = useGameStore((s) => s.beginNextRound);
  const replayWithTeams = useGameStore((s) => s.replayWithTeams);
  const abandonActiveMatch = useGameStore((s) => s.abandonActiveMatch);
  const updateSettings = useGameStore((s) => s.updateSettings);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [pickerCategory, setPickerCategory] = useState<CategoryItem | null>(null);
  const [showScoreboardDrawer, setShowScoreboardDrawer] = useState(false);
  const [confirmEndTurn, setConfirmEndTurn] = useState(false);
  const [confirmExitGame, setConfirmExitGame] = useState(false);
  const [showFullAudit, setShowFullAudit] = useState(false);

  const lastTickBucketRef = useRef<string | null>(null);
  const lastUiRenderMsRef = useRef<number>(0);

  // Close category picker sheet whenever phase or turn changes
  useEffect(() => {
    setPickerCategory(null);
    setConfirmEndTurn(false);
  }, [activeMatch?.phase, activeMatch?.currentRound, activeMatch?.currentTurnIndexInRound]);

  // High-precision wall-clock ticker + accelerating rapid countdown ticks in the final 10s!
  useEffect(() => {
    if (!activeMatch || activeMatch.phase !== 'PLAYING') {
      lastTickBucketRef.current = null;
      return;
    }

    const updateClock = (forceUi = false) => {
      const currentNow = Date.now();
      const snap = getTimerSnapshot(activeMatch.timer, currentNow);

      if (forceUi || currentNow - lastUiRenderMsRef.current >= 85) {
        lastUiRenderMsRef.current = currentNow;
        setNowTick(currentNow);
      }

      if (snap.isExpired) {
        setNowTick(currentNow);
        triggerTimeExpired();
        return;
      }

      // Compute musical tick stage & bucket key:
      // > 10s (or unlimited): 1 tick/sec (1000ms)
      // 10s .. 5s: 2 ticks/sec (500ms)
      // 5s .. 2.5s: 4 ticks/sec (250ms)
      // 2.5s .. 0.08s: ~7.4 ticks/sec (135ms)
      let bucketKey: string;
      let stage: 'normal' | 'fast10' | 'faster5' | 'frantic2' = 'normal';
      let isDownbeat = true;

      if (snap.remainingMs === null) {
        bucketKey = `ela_1000_${snap.elapsedSeconds}`;
      } else if (snap.remainingMs > 10_000) {
        bucketKey = `rem_1000_${snap.remainingSeconds}`;
      } else if (snap.remainingMs > 5_000) {
        const slot500 = Math.ceil(snap.remainingMs / 500);
        bucketKey = `rem_500_${slot500}`;
        stage = 'fast10';
        isDownbeat = slot500 % 2 === 0;
      } else if (snap.remainingMs > 2_500) {
        const slot250 = Math.ceil(snap.remainingMs / 250);
        bucketKey = `rem_250_${slot250}`;
        stage = 'faster5';
        isDownbeat = slot250 % 4 === 0;
      } else if (snap.remainingMs > 80) {
        const slot135 = Math.ceil(snap.remainingMs / 135);
        bucketKey = `rem_135_${slot135}`;
        stage = 'frantic2';
        isDownbeat = slot135 % 7 === 0;
      } else {
        bucketKey = 'rem_end';
      }

      if (lastTickBucketRef.current === null) {
        // Initialize on turn start without colliding with the start fanfare
        lastTickBucketRef.current = bucketKey;
      } else if (lastTickBucketRef.current !== bucketKey && bucketKey !== 'rem_end') {
        lastTickBucketRef.current = bucketKey;
        feedbackEngine.onTimerSubTick({
          remainingMs: snap.remainingMs,
          remainingSeconds: snap.remainingSeconds,
          elapsedSeconds: snap.elapsedSeconds,
          stage,
          isDownbeat,
          soundEnabled: settings.soundEnabled,
          tickSoundEnabled: settings.tickSoundEnabled,
          vibrationEnabled: settings.vibrationEnabled,
        });
      }
    };

    updateClock(true);
    const id = window.setInterval(() => updateClock(false), 30);

    const handleVisibility = () => updateClock(true);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    activeMatch,
    settings.soundEnabled,
    settings.tickSoundEnabled,
    settings.vibrationEnabled,
    triggerTimeExpired,
  ]);

  const { requestTiltPermission } = useTiltControls({
    enabled: settings.tiltControlsEnabled,
    isActivePlay: Boolean(activeMatch && activeMatch.phase === 'PLAYING'),
    onTiltCorrect: correctGuess,
    onTiltWrong: wrongGuess,
  });

  const categoryNameMap = useMemo(() => {
    const m: Record<string, string> = { golden: 'موضوع طلایی ۳۰ امتیازی' };
    for (const c of categories) {
      m[c.id] = c.name;
    }
    return m;
  }, [categories]);

  if (!activeMatch) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
          مسابقه فعالی در جریان نیست
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          برای شروع یک دورهمی جدید به صفحه شروع بروید.
        </p>
        <button
          type="button"
          onClick={() => navigate('home')}
          className="min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-600 text-white font-extrabold text-sm"
        >
          شروع مسابقه جدید
        </button>
      </div>
    );
  }

  const p = settings.persianDigits;
  const activeTeam = getActiveTeam(activeMatch);
  const standings = computeTeamStandings(
    activeMatch.teams,
    activeMatch.allEvents,
    activeMatch.extraWrongGuessesByTeam,
    activeMatch.goldenUsedByTeam,
    settings.allowNegativeScore
  );
  const activeTeamRank =
    standings.findIndex((s) => s.teamId === activeTeam.id) + 1;
  const activeTeamStanding = standings.find((s) => s.teamId === activeTeam.id);

  const timerSnap = getTimerSnapshot(
    activeMatch.timer,
    activeMatch.phase === 'PLAYING' ? nowTick : Date.now()
  );

  const slot = activeMatch.currentSlot;
  const currentWord = slot?.word ?? null;
  const isGoldenTurn = currentWord?.kind === 'golden';
  const isFinalRound = isFinalRegularRound(activeMatch);
  const canUseGolden = canActiveTeamUseGolden(activeMatch);
  const activeTeamUsedCombos = getTeamUsedCombos(activeMatch, activeTeam.id);

  const swapsRemaining = slot
    ? Math.max(0, settings.maxSwapsPerCard - slot.swapsUsedInSlot)
    : settings.maxSwapsPerCard;

  const activeBonusWindow =
    currentWord && (activeMatch.phase === 'PLAYING' || activeMatch.phase === 'PAUSED')
      ? getActiveSpeedBonusWindow(currentWord, timerSnap.elapsedSeconds, settings)
      : null;

  const baseWordRule = currentWord
    ? calculateWordScore(currentWord, 999999, settings)
    : null;

  // Next team preview for TURN_RESULT button
  const hasMoreTurnsInThisRound =
    activeMatch.currentTurnIndexInRound + 1 < activeMatch.roundTeamOrder.length;
  const nextTeamInRound = hasMoreTurnsInThisRound
    ? activeMatch.teams.find(
        (t) =>
          t.id ===
          activeMatch.roundTeamOrder[activeMatch.currentTurnIndexInRound + 1]
      )
    : null;

  const handleToggleSoundInGame = () => {
    const nextSound = !settings.soundEnabled;
    updateSettings({ soundEnabled: nextSound });
    if (nextSound) {
      feedbackEngine.unlock();
      feedbackEngine.onSelectTopic(true, settings.vibrationEnabled);
    }
  };

  const handleSelectCategoryDifficulty = (
    category: CategoryItem,
    difficulty: Difficulty
  ) => {
    const res = prepareTurnCard({
      useGolden: false,
      forcedCategoryId: category.id,
      forcedDifficulty: difficulty,
    });
    if (!res.ok) {
      if (res.error) showToast(res.error);
      return;
    }
    setPickerCategory(null);
  };

  const handleDrawGolden = () => {
    const res = prepareTurnCard({ useGolden: true });
    if (!res.ok && res.error) {
      showToast(res.error);
    }
  };

  const handleLockedGoldenClick = () => {
    feedbackEngine.onLockedTap(settings.soundEnabled, settings.vibrationEnabled);
    showToast(
      `موضوع طلایی فقط در دور آخر مسابقه (دور ${formatNum(
        activeMatch.totalRounds,
        p
      )}) باز می‌شود!`
    );
  };

  const handleSwapClick = () => {
    const res = swapWord();
    if (!res.ok && res.error) {
      showToast(res.error);
    } else {
      showToast('کلمه با کسر ۱ امتیاز تعویض شد؛ کلمه جدید از همان موضوع آماده است.');
    }
  };

  const handleReportInvalidClick = async () => {
    const res = await reportInvalidWord();
    if (res.ok) {
      showToast('کلمه بدون کسر امتیاز تعویض شد و زمان باقی‌مانده کاملاً حفظ گردید.');
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleToggleTiltInArena = async () => {
    if (!settings.tiltControlsEnabled) {
      const ok = await requestTiltPermission();
      if (!ok) {
        showToast('مرورگر یا گوشی فعلی از حسگر حرکتی پشتیبانی نمی‌کند.');
        return;
      }
      updateSettings({ tiltControlsEnabled: true });
      showToast('کنترل حرکتی فعال شد: خم کردن به پایین = درست · به عقب = خطا');
    } else {
      updateSettings({ tiltControlsEnabled: false });
    }
  };

  const handleFoulClick = () => {
    const nextFoulCount = (slot?.wrongGuessesInSlot ?? 0) + 1;
    wrongGuess();
    showToast(
      `خطا ثبت شد (${formatNum(nextFoulCount, p)} خطا = −${formatNum(
        nextFoulCount * settings.foulPenalty,
        p
      )} امتیاز)`
    );
  };

  const getPointsForCatDiff = (cat: CategoryItem, diff: Difficulty) =>
    cat.isProverb
      ? settings.proverbBasePoints[diff]
      : settings.regularBasePoints[diff];

  const getTimeForCatDiff = (cat: CategoryItem, diff: Difficulty) =>
    cat.isProverb
      ? settings.proverbTimeSec[diff]
      : settings.regularTimeSec[diff];

  const getSpeedBonusTiersForCatDiff = (cat: CategoryItem, diff: Difficulty) => {
    const tiers = cat.isProverb
      ? settings.proverbSpeedBonus[diff]
      : settings.regularSpeedBonus[diff];
    return [...tiers].sort((a, b) => a.thresholdSec - b.thresholdSec);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-stone-50 dark:bg-slate-950">
      {/* Compact Sticky Mobile Game HUD */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5">
        <div className="max-w-5xl mx-auto h-full flex items-center justify-between gap-2">
          {/* Active Team & Round Indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: activeTeam.color }}
            >
              <DynamicIcon name={activeTeam.icon} className="w-4 h-4" />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                <span className="truncate">{activeTeam.name}</span>
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                  ({formatNum(activeTeamStanding?.totalScore ?? 0, p)})
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {activeMatch.isSuddenDeath ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    مرگ ناگهانی {formatNum(activeMatch.suddenDeathRound, p)} · نوبت{' '}
                    {formatNum(activeMatch.currentTurnIndexInRound + 1, p)} از{' '}
                    {formatNum(activeMatch.roundTeamOrder.length, p)}
                  </span>
                ) : isFinalRound ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    دور آخر ({formatNum(activeMatch.currentRound, p)} از{' '}
                    {formatNum(activeMatch.totalRounds, p)}) · نوبت{' '}
                    {formatNum(activeMatch.currentTurnIndexInRound + 1, p)} از{' '}
                    {formatNum(activeMatch.roundTeamOrder.length, p)}
                  </span>
                ) : (
                  <span>
                    دور {formatNum(activeMatch.currentRound, p)} از{' '}
                    {formatNum(activeMatch.totalRounds, p)} · نوبت{' '}
                    {formatNum(activeMatch.currentTurnIndexInRound + 1, p)} از{' '}
                    {formatNum(activeMatch.roundTeamOrder.length, p)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right HUD Quick Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                feedbackEngine.onTap(settings.soundEnabled);
                setShowScoreboardDrawer(true);
              }}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap"
              title="جدول امتیازات و موضوعات رفته‌شده"
            >
              <ListOrdered className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">جدول امتیازات</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSoundInGame}
              className={`min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl transition-colors ${
                settings.soundEnabled
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              aria-label={settings.soundEnabled ? 'قطع صدا' : 'وصل صدا'}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="قوانین بازی"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeMatch.phase === 'PLAYING') {
                  pauseGame();
                }
                navigate('home');
              }}
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="بازگشت به لابی"
              title="ذخیره خودکار و بازگشت"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Arena Body */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col">
        {/* =====================================================================
            PHASE 1: PRE_TURN — PER-TEAM CATEGORY & DIFFICULTY SELECTION BOARD
           ===================================================================== */}
        {activeMatch.phase === 'PRE_TURN' && (
          <div className="space-y-4 sm:space-y-5 pb-6 animate-gentle-pop">
            {/* Active Team Turn Banner */}
            <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: activeTeam.color }}
                  >
                    <DynamicIcon name={activeTeam.icon} className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {activeMatch.isSuddenDeath ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          دوئل مرگ ناگهانی {formatNum(activeMatch.suddenDeathRound, p)} · نوبت{' '}
                          {formatNum(activeMatch.currentTurnIndexInRound + 1, p)} از{' '}
                          {formatNum(activeMatch.roundTeamOrder.length, p)}
                        </span>
                      ) : (
                        <span>
                          دور {formatNum(activeMatch.currentRound, p)} از{' '}
                          {formatNum(activeMatch.totalRounds, p)}
                          {isFinalRound ? ' (دور آخر مسابقه!)' : ''} · نوبت{' '}
                          {formatNum(activeMatch.currentTurnIndexInRound + 1, p)} از{' '}
                          {formatNum(activeMatch.roundTeamOrder.length, p)}
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      نوبت انتخاب و اجرای «{activeTeam.name}»
                    </h1>

                    <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                      <span>
                        امتیاز فعلی:{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {formatNum(activeTeamStanding?.totalScore ?? 0, p)}
                        </strong>
                      </span>
                      <span className="mx-2">·</span>
                      <span>
                        رتبه {formatNum(activeTeamRank, p)} از{' '}
                        {formatNum(activeMatch.teams.length, p)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Round Turn Order Strip */}
                <div className="rounded-2xl bg-stone-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs tabular-nums">
                  <div className="text-slate-400 dark:text-slate-500 mb-1">
                    ترتیب اجرای تیم‌ها در این دور:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 font-bold">
                    {activeMatch.roundTeamOrder.map((tId, idx) => {
                      const tObj = activeMatch.teams.find((x) => x.id === tId);
                      const isDone = idx < activeMatch.currentTurnIndexInRound;
                      const isCurrent = idx === activeMatch.currentTurnIndexInRound;
                      return (
                        <React.Fragment key={tId}>
                          <span
                            className={
                              isCurrent
                                ? 'text-emerald-700 dark:text-emerald-400 underline underline-offset-4'
                                : isDone
                                ? 'text-slate-400 dark:text-slate-600 line-through'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {tObj?.name}
                          </span>
                          {idx < activeMatch.roundTeamOrder.length - 1 && (
                            <span className="text-slate-400">←</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Used Topics History for Active Team */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                {activeTeamUsedCombos.length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400">
                    موضوعات بسته‌شده «{activeTeam.name}»: هنوز موضوعی برای این تیم بسته نشده است (هر انتخاب فقط مخصوص همین تیم بسته می‌شود).
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      موضوعات بسته‌شده اختصاصی «{activeTeam.name}» ({formatNum(activeTeamUsedCombos.length, p)} مورد — فقط برای همین تیم بسته شده):
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {activeTeamUsedCombos
                        .map(
                          (item) =>
                            `${categoryNameMap[item.categoryId] ?? item.categoryId} (${difficultyLabel(
                              item.difficulty
                            )})`
                        )
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Golden 30-Point Challenge Card (Locked until Final Round!) */}
            {!activeMatch.isSuddenDeath && (
              <section>
                {isFinalRound ? (
                  canUseGolden ? (
                    <button
                      type="button"
                      onClick={handleDrawGolden}
                      className="w-full text-right rounded-3xl border-2 border-amber-500 bg-gradient-to-l from-amber-500/15 via-amber-500/5 to-white dark:from-amber-500/20 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 flex items-center justify-between gap-4 hover:border-amber-400 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                          <Crown className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-300">
                            انتخاب موضوع طلایی دور آخر ({formatNum(settings.goldenBasePoints, p)} امتیازی!)
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                            زمان {formatNum(settings.goldenTimeSec, p)} ثانیه · امتیاز تایم پله‌ای تا +{formatNum(settings.goldenSpeedBonusTiers[0]?.bonus ?? 10, p)} امتیاز
                          </div>
                        </div>
                      </div>
                      <span className="min-h-[42px] inline-flex items-center gap-1 rounded-xl bg-amber-500 text-slate-950 px-3.5 py-2 text-xs font-black whitespace-nowrap shrink-0">
                        <span>انتخاب طلایی</span>
                        <ChevronLeft className="w-4 h-4" />
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-100/80 dark:bg-slate-900/50 px-4 py-3 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-2 font-bold">
                        <Crown className="w-4 h-4 text-slate-400" />
                        <span>سهمیه موضوع طلایی این تیم مصرف شده است</span>
                      </span>
                      <Lock className="w-4 h-4" />
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleLockedGoldenClick}
                    className="w-full text-right rounded-2xl border border-amber-500/30 bg-amber-50/40 dark:bg-slate-900/70 px-4 py-3 flex items-center justify-between gap-3 text-xs transition-colors hover:border-amber-500/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 truncate tabular-nums">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          موضوع طلایی {formatNum(settings.goldenBasePoints, p)} امتیازی
                        </span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          فقط در دور آخر (دور {formatNum(activeMatch.totalRounds, p)}) باز می‌شود
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold shrink-0">
                      <Lock className="w-3.5 h-3.5" />
                      <span>قفل</span>
                    </span>
                  </button>
                )}
              </section>
            )}

            {/* 18 Categories Board Grid */}
            <section className="space-y-2.5">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {activeMatch.isSuddenDeath
                    ? 'یک موضوع برای دوئل مرگ ناگهانی (سطح سخت) انتخاب کنید:'
                    : 'موضوع مورد نظر این نوبت را انتخاب کنید:'}
                </h2>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  لمس موضوع = انتخاب سطح سختی
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {categories.map((cat) => {
                  const usedEasy = isComboUsedByTeam(
                    activeMatch,
                    activeTeam.id,
                    cat.id,
                    'easy'
                  );
                  const usedMedium = isComboUsedByTeam(
                    activeMatch,
                    activeTeam.id,
                    cat.id,
                    'medium'
                  );
                  const usedHard = isComboUsedByTeam(
                    activeMatch,
                    activeTeam.id,
                    cat.id,
                    'hard'
                  );

                  const isCategoryFullyUsed = activeMatch.isSuddenDeath
                    ? usedHard
                    : usedEasy && usedMedium && usedHard;

                  const ptsEasy = getPointsForCatDiff(cat, 'easy');
                  const ptsMed = getPointsForCatDiff(cat, 'medium');
                  const ptsHard = getPointsForCatDiff(cat, 'hard');

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={isCategoryFullyUsed}
                      onClick={() => {
                        feedbackEngine.onTap(settings.soundEnabled);
                        setPickerCategory(cat);
                      }}
                      className={`text-right rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                        isCategoryFullyUsed
                          ? 'border-slate-200/70 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-900/35 opacity-50 cursor-not-allowed'
                          : cat.isProverb
                          ? 'border-emerald-500/40 bg-white dark:bg-slate-900 hover:border-emerald-500 active:scale-[0.98]'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 active:scale-[0.98]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isCategoryFullyUsed
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                : cat.isProverb
                                ? 'bg-emerald-600 text-white'
                                : 'bg-stone-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            <DynamicIcon name={cat.icon} className="w-4 h-4" />
                          </div>
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {cat.name}
                          </span>
                        </div>

                        {isCategoryFullyUsed && (
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </div>

                      {/* 3 Difficulty Slots Indicator */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] tabular-nums">
                        <span
                          className={
                            usedEasy
                              ? 'text-slate-400 dark:text-slate-600 line-through'
                              : 'font-bold text-slate-600 dark:text-slate-300'
                          }
                        >
                          آسان {formatNum(ptsEasy, p)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span
                          className={
                            usedMedium
                              ? 'text-slate-400 dark:text-slate-600 line-through'
                              : 'font-bold text-slate-600 dark:text-slate-300'
                          }
                        >
                          متوسط {formatNum(ptsMed, p)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span
                          className={
                            usedHard
                              ? 'text-slate-400 dark:text-slate-600 line-through'
                              : 'font-bold text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          سخت {formatNum(ptsHard, p)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* =====================================================================
            PHASE 2: CONCEALED — ACTOR CONFIDENTIAL REVEAL
           ===================================================================== */}
        {activeMatch.phase === 'CONCEALED' && slot && currentWord && (
          <div className="my-auto py-4">
            <div
              className={`max-w-2xl mx-auto rounded-3xl border p-5 sm:p-8 space-y-6 animate-gentle-pop ${
                isGoldenTurn
                  ? 'border-amber-500/60 bg-gradient-to-b from-amber-50/70 to-white dark:from-amber-950/25 dark:to-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              {slot.fallbackNotice && (
                <div className="rounded-xl bg-amber-100/80 dark:bg-amber-950/50 border border-amber-400/40 px-4 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200 text-center">
                  {slot.fallbackNotice}
                </div>
              )}

              {/* Topic & Score Summary */}
              <div className="text-center space-y-1.5">
                <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  <span>{categoryNameMap[currentWord.categoryId] ?? currentWord.categoryId}</span>
                  <span className="mx-2">·</span>
                  <span>
                    {isGoldenTurn
                      ? 'چالش ویژه طلایی دور آخر'
                      : `سطح ${difficultyLabel(currentWord.difficulty)}`}
                  </span>
                  <span className="mx-2">·</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {formatNum(baseWordRule?.basePoints ?? currentWord.basePoints, p)} امتیاز پایه
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {activeMatch.timer.durationSec !== null ? (
                    <span>
                      زمان اجرای این نوبت:{' '}
                      {formatClock(
                        timerSnap.remainingSeconds ?? activeMatch.timer.durationSec,
                        p
                      )}
                    </span>
                  ) : (
                    <span>بدون محدودیت زمانی</span>
                  )}
                </div>
              </div>

              {!slot.isWordRevealedToActor ? (
                <div className="py-4 text-center space-y-5">
                  <div className="max-w-sm mx-auto rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 p-6 space-y-3">
                    <Eye className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      گوشی را فقط اجراکننده «{activeTeam.name}» ببیند
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      به محض لمس دکمه زیر، کلمه نمایش داده می‌شود و این موضوع و سطح فقط برای تیم «{activeTeam.name}» بسته باقی می‌ماند.
                    </p>
                  </div>

                  <div className="max-w-sm mx-auto space-y-2.5">
                    <button
                      type="button"
                      onClick={revealSecretWord}
                      className="w-full min-h-[56px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-6 py-3.5 text-base font-black transition-all"
                    >
                      <Eye className="w-5 h-5" />
                      <span>مشاهده محرمانه کلمه</span>
                    </button>

                    {slot.swapsUsedInSlot === 0 &&
                      slot.slotIndex === 0 &&
                      activeMatch.timer.accumulatedElapsedMs === 0 && (
                        <button
                          type="button"
                          onClick={cancelPreRevealSelection}
                          className="w-full min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>تغییر موضوع (بازگشت به جدول موضوعات)</span>
                        </button>
                      )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 p-6 sm:p-9 text-center space-y-3">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      کلمه مخفی شما:
                    </div>
                    <div
                      className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-snug"
                      style={{ textWrap: 'balance' }}
                    >
                      {currentWord.text}
                    </div>
                    {currentWord.alternatives.length > 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        معادل‌های قابل قبول: {currentWord.alternatives.join(' ، ')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 max-w-lg mx-auto">
                    <button
                      type="button"
                      onClick={startTimerForTurn}
                      className={`w-full min-h-[58px] inline-flex items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base sm:text-lg font-black text-white active:scale-[0.99] transition-all ${
                        isGoldenTurn
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>
                        {activeMatch.timer.accumulatedElapsedMs > 0
                          ? 'ادامه تایمر با زمان باقی‌مانده'
                          : 'شروع تایمر و اجرای پانتومیم!'}
                      </span>
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={concealSecretWord}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                        <span>پوشاندن</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSwapClick}
                        disabled={swapsRemaining <= 0}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>تعویض (−{formatNum(settings.swapPenalty, p)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReportInvalidClick}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 whitespace-nowrap"
                      >
                        <Flag className="w-3.5 h-3.5 shrink-0" />
                        <span>کلمه خراب</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            PHASE 3: PLAYING & PAUSED — BIG COUNTDOWN TIMER & JUDGE CONTROLS
           ===================================================================== */}
        {(activeMatch.phase === 'PLAYING' || activeMatch.phase === 'PAUSED') &&
          slot &&
          currentWord && (
            <div className="my-auto py-2 space-y-4 max-w-2xl w-full mx-auto animate-gentle-pop">
              <div
                className={`rounded-3xl border p-4 sm:p-7 text-center space-y-4 ${
                  isGoldenTurn
                    ? 'border-amber-500/60 bg-gradient-to-b from-amber-50/70 to-white dark:from-amber-950/25 dark:to-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                {/* Topic & Tick Toggle Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-800 dark:text-slate-200">
                      {categoryNameMap[currentWord.categoryId] ?? currentWord.categoryId}
                    </span>
                    <span>·</span>
                    <span>
                      {isGoldenTurn
                        ? `طلایی (${formatNum(settings.goldenBasePoints, p)} امتیاز)`
                        : `${difficultyLabel(currentWord.difficulty)} (${formatNum(
                            baseWordRule?.basePoints ?? currentWord.basePoints,
                            p
                          )} امتیاز)`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({ tickSoundEnabled: !settings.tickSoundEnabled })
                    }
                    className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      settings.soundEnabled && settings.tickSoundEnabled
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'text-slate-400 bg-stone-100 dark:bg-slate-800'
                    }`}
                  >
                    {settings.soundEnabled && settings.tickSoundEnabled ? (
                      <Bell className="w-3.5 h-3.5" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                    <span>تیک‌تاک ساعت</span>
                  </button>
                </div>

                {/* Giant Countdown Clock */}
                <div className="space-y-2">
                  <div
                    className={`text-6xl sm:text-7xl font-black tracking-tight tabular-nums transition-colors ${
                      timerSnap.remainingSeconds !== null && timerSnap.remainingSeconds <= 10
                        ? `text-rose-600 dark:text-rose-400 ${
                            activeMatch.phase === 'PLAYING' ? 'animate-pulse' : ''
                          }`
                        : timerSnap.remainingSeconds !== null && timerSnap.remainingSeconds <= 15
                        ? 'text-amber-600 dark:text-amber-400'
                        : isGoldenTurn
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {timerSnap.remainingSeconds !== null
                      ? formatClock(timerSnap.remainingSeconds, p)
                      : formatClock(timerSnap.elapsedSeconds, p)}
                  </div>

                  {/* Progress Bar */}
                  {timerSnap.remainingSeconds !== null && (
                    <div className="max-w-md mx-auto h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-transform duration-100 origin-right ${
                          timerSnap.remainingSeconds <= 10
                            ? 'bg-rose-600'
                            : timerSnap.remainingSeconds <= 15
                            ? 'bg-amber-500'
                            : isGoldenTurn
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ transform: `scaleX(${timerSnap.progressRatio})` }}
                      />
                    </div>
                  )}

                  {/* Stepped Speed Bonus & Live Foul Counter Bar */}
                  <div className="text-xs font-bold tabular-nums pt-0.5 space-y-1">
                    {activeBonusWindow ? (
                      <div className="inline-flex flex-wrap items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          امتیاز تایم فعلی: +{formatNum(activeBonusWindow.activeBonus, p)} (تا ثانیه{' '}
                          {formatNum(activeBonusWindow.nextDeadlineSec, p)} · پله بعد:{' '}
                          {activeBonusWindow.nextBonus > 0
                            ? `+${formatNum(activeBonusWindow.nextBonus, p)}`
                            : formatNum(0, p)}
                          )
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400">
                        سپری‌شده: {formatNum(timerSnap.elapsedSeconds, p)} ثانیه · امتیاز تایم: ۰
                      </div>
                    )}

                    {slot.wrongGuessesInSlot > 0 && (
                      <div className="text-rose-600 dark:text-rose-400">
                        خطاهای ثبت‌شده در این نوبت: {formatNum(slot.wrongGuessesInSlot, p)} خطا (−
                        {formatNum(slot.wrongGuessesInSlot * settings.foulPenalty, p)} امتیاز)
                      </div>
                    )}
                  </div>
                </div>

                {/* Secret Word Card (Can be masked so phone can sit on the table!) */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 p-4 sm:p-6 space-y-2.5">
                  {activeMatch.phase === 'PAUSED' ? (
                    <div className="py-2 space-y-1.5">
                      <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                        زمان متوقف شده است (کلمه پنهان شد)
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        برای ادامه مسابقه دکمه «ادامه تایمر» را لمس کنید.
                      </p>
                    </div>
                  ) : slot.isWordHiddenDuringPlay ? (
                    <div className="py-2 space-y-2.5">
                      <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
                        کلمه پنهان است تا جمع بتواند تایمر را ببیند
                      </div>
                      <button
                        type="button"
                        onClick={togglePlayWordMask}
                        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-extrabold"
                      >
                        <Eye className="w-4 h-4" />
                        <span>مشاهده مجدد کلمه</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-snug"
                        style={{ textWrap: 'balance' }}
                      >
                        {currentWord.text}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={togglePlayWordMask}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>مخفی کردن کلمه (گذاشتن گوشی روی میز)</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Primary Thumb-Zone Judge Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={correctGuess}
                    disabled={activeMatch.phase !== 'PLAYING' || slot.isScored}
                    className="min-h-[62px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-40 text-white px-6 py-4 text-lg font-black transition-all"
                  >
                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                    <span>درست گفتند!</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFoulClick}
                    disabled={activeMatch.phase !== 'PLAYING' || slot.isScored}
                    className="min-h-[62px] inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/45 active:scale-[0.98] disabled:opacity-40 text-rose-700 dark:text-rose-300 px-5 py-4 text-lg font-black transition-all whitespace-nowrap tabular-nums"
                  >
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>خطا</span>
                    {slot.wrongGuessesInSlot > 0 && (
                      <span className="text-sm font-extrabold">
                        ({formatNum(slot.wrongGuessesInSlot, p)})
                      </span>
                    )}
                  </button>
                </div>

                {/* Secondary Action Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {activeMatch.phase === 'PLAYING' ? (
                    <button
                      type="button"
                      onClick={pauseGame}
                      className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/70 text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                    >
                      <Pause className="w-4 h-4 shrink-0" />
                      <span>توقف زمان</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resumeGame}
                      className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black whitespace-nowrap"
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      <span>ادامه تایمر</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSwapClick}
                    disabled={swapsRemaining <= 0}
                    className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/70 disabled:opacity-40 text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>تعویض (−{formatNum(settings.swapPenalty, p)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReportInvalidClick}
                    className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/70 text-xs font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap"
                  >
                    <Flag className="w-4 h-4 shrink-0" />
                    <span>کلمه خراب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmEndTurn(true)}
                    className="min-h-[46px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 dark:border-rose-500/35 bg-rose-50/60 dark:bg-rose-950/25 text-xs font-extrabold text-rose-600 dark:text-rose-400 whitespace-nowrap"
                  >
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>غلط</span>
                  </button>
                </div>

                {/* Optional Tilt Sensor Toggle */}
                <div className="pt-1 flex justify-center">
                  <button
                    type="button"
                    onClick={handleToggleTiltInArena}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                      settings.tiltControlsEnabled
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>
                      {settings.tiltControlsEnabled
                        ? 'کنترل حرکتی با خم کردن گوشی فعال است'
                        : 'فعال‌سازی کنترل با خم کردن گوشی'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* =====================================================================
            PHASE 4: TIME_UP
           ===================================================================== */}
        {activeMatch.phase === 'TIME_UP' && slot && currentWord && (
          <div className="my-auto max-w-lg w-full mx-auto rounded-3xl border-2 border-rose-500/50 bg-white dark:bg-slate-900 p-6 sm:p-10 text-center space-y-6 animate-gentle-pop">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-rose-600 dark:text-rose-400">
                وقت تمام شد!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                مهلت اجرای این نوبت به پایان رسید. عبارت این نوبت:
              </p>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white pt-2">
                «{currentWord.text}»
              </div>
            </div>

            <button
              type="button"
              onClick={() => endTurnManuallyOrTimeout('timeout')}
              className="w-full min-h-[54px] inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3.5 text-base font-black"
            >
              <span>ثبت نتیجه و ادامه</span>
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* =====================================================================
            PHASE 5: TURN_RESULT — DETAILED ITEMIZED TURN SCORE BREAKDOWN
           ===================================================================== */}
        {activeMatch.phase === 'TURN_RESULT' && (() => {
          const turnEvents = activeMatch.turnCompletedEvents;
          const finalEv =
            [...turnEvents]
              .reverse()
              .find(
                (e) =>
                  e.outcome === 'correct' ||
                  e.outcome === 'manual_end' ||
                  e.outcome === 'timeout'
              ) ?? turnEvents[turnEvents.length - 1];

          const swappedWords = turnEvents.filter((e) => e.outcome === 'swap');
          const turnBasePoints = turnEvents.reduce((sum, e) => sum + e.basePoints, 0);
          const turnSpeedBonus = turnEvents.reduce((sum, e) => sum + e.speedBonus, 0);
          const turnSwapPenalty = turnEvents.reduce((sum, e) => sum + e.swapPenalty, 0);
          const turnFoulCount = turnEvents.reduce((sum, e) => sum + e.wrongGuessesInSlot, 0);
          const turnFoulPenalty = turnEvents.reduce(
            (sum, e) => sum + (e.foulPenalty ?? 0),
            0
          );
          const turnNetPoints =
            turnBasePoints + turnSpeedBonus - turnSwapPenalty - turnFoulPenalty;
          const isSolved = finalEv?.outcome === 'correct';

          return (
            <div className="my-auto max-w-xl w-full mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-5 animate-gentle-pop">
              {/* Team & Word Summary Header */}
              <div className="text-center space-y-2">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: activeTeam.color }}
                >
                  <DynamicIcon name={activeTeam.icon} className="w-7 h-7" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  جزئیات امتیاز نوبت «{activeTeam.name}»
                </h2>
                {finalEv && (
                  <div className="space-y-1 pt-1">
                    <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      «{finalEv.wordText}»
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{categoryNameMap[finalEv.categoryId] ?? finalEv.categoryId}</span>
                      <span className="mx-1.5">·</span>
                      <span>
                        {finalEv.kind === 'golden'
                          ? 'موضوع طلایی ۳۰ امتیازی'
                          : `سطح ${difficultyLabel(finalEv.difficulty)}`}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span>زمان: {formatNum(finalEv.elapsedSeconds, p)} ثانیه</span>
                      <span className="mx-1.5">·</span>
                      <span
                        className={
                          isSolved
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-bold text-rose-600 dark:text-rose-400'
                        }
                      >
                        {isSolved
                          ? 'پاسخ درست'
                          : finalEv.outcome === 'manual_end'
                          ? 'غلط'
                          : 'اتمام زمان'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Complete Itemized Score Receipt */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50/80 dark:bg-slate-950/70 divide-y divide-slate-200/80 dark:divide-slate-800 text-xs sm:text-sm tabular-nums">
                {/* 1. Base Word Score */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold">امتیاز کلمه</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 text-xs">
                      {isSolved && finalEv
                        ? finalEv.kind === 'golden'
                          ? `(عبارت ${formatNum(turnBasePoints, p)} امتیازی طلایی)`
                          : `(کلمه ${formatNum(turnBasePoints, p)} امتیازی سطح ${difficultyLabel(
                              finalEv.difficulty
                            )})`
                        : finalEv?.outcome === 'manual_end'
                        ? '(ثبت غلط)'
                        : '(اتمام مهلت زمانی)'}
                    </span>
                  </div>
                  <span
                    className={`font-extrabold whitespace-nowrap ${
                      turnBasePoints > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {turnBasePoints > 0
                      ? `+${formatNum(turnBasePoints, p)} امتیاز`
                      : `${formatNum(0, p)} امتیاز`}
                  </span>
                </div>

                {/* 2. Stepped Time Bonus */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold">امتیاز تایم</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 text-xs">
                      {isSolved && finalEv
                        ? turnSpeedBonus > 0
                          ? `(پاداش سرعت در ${formatNum(finalEv.elapsedSeconds, p)} ثانیه)`
                          : `(${formatNum(finalEv.elapsedSeconds, p)} ثانیه — بدون پاداش سرعت)`
                        : '(عدم پاسخ صحیح)'}
                    </span>
                  </div>
                  <span
                    className={`font-extrabold whitespace-nowrap ${
                      turnSpeedBonus > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {turnSpeedBonus > 0
                      ? `+${formatNum(turnSpeedBonus, p)} امتیاز`
                      : `${formatNum(0, p)} امتیاز`}
                  </span>
                </div>

                {/* 3. Word Swap Deduction */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold">کسر بابت تعویض کلمه</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 text-xs">
                      {swappedWords.length > 0
                        ? `(${formatNum(swappedWords.length, p)} مرتبه تعویض)`
                        : '(بدون تعویض)'}
                    </span>
                  </div>
                  <span
                    className={`font-extrabold whitespace-nowrap ${
                      turnSwapPenalty > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {turnSwapPenalty > 0
                      ? `−${formatNum(turnSwapPenalty, p)} امتیاز`
                      : `${formatNum(0, p)} امتیاز`}
                  </span>
                </div>

                {/* 4. Foul Deduction */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold">کسر بابت خطا</span>
                    <span className="text-slate-500 dark:text-slate-400 mr-1.5 text-xs">
                      {turnFoulCount > 0
                        ? `(${formatNum(turnFoulCount, p)} خطا در اجرا)`
                        : '(بدون خطا)'}
                    </span>
                  </div>
                  <span
                    className={`font-extrabold whitespace-nowrap ${
                      turnFoulPenalty > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {turnFoulPenalty > 0
                      ? `−${formatNum(turnFoulPenalty, p)} امتیاز`
                      : `${formatNum(0, p)} امتیاز`}
                  </span>
                </div>

                {/* 5. Final Net Score Earned This Turn */}
                <div className="px-4 py-3.5 bg-white/80 dark:bg-slate-900/80 flex items-center justify-between gap-3">
                  <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    امتیاز نهایی این نوبت
                  </span>
                  <span
                    className={`text-lg sm:text-xl font-black whitespace-nowrap ${
                      turnNetPoints > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : turnNetPoints < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {formatSignedNum(turnNetPoints, p)} امتیاز
                  </span>
                </div>

                {/* 6. Cumulative Team Total */}
                <div className="px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <span className="font-bold text-slate-600 dark:text-slate-400">
                    مجموع کل امتیاز «{activeTeam.name}» در مسابقه
                  </span>
                  <span className="font-black text-base text-slate-900 dark:text-white whitespace-nowrap">
                    {formatNum(activeTeamStanding?.totalScore ?? 0, p)} امتیاز
                  </span>
                </div>
              </div>

              {swappedWords.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  کلمه تعویض‌شده قبلی در این نوبت:{' '}
                  {swappedWords.map((sw) => `«${sw.wordText}»`).join(' ، ')}
                </div>
              )}

              <button
                type="button"
                onClick={nextTurnOrSummary}
                className="w-full min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-6 py-4 text-base font-black transition-all"
              >
                <span>
                  {nextTeamInRound
                    ? `ادامه به نوبت «${nextTeamInRound.name}»`
                    : 'مشاهده جدول پایان این دور'}
                </span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          );
        })()}

        {/* =====================================================================
            PHASE 6: ROUND_SUMMARY
           ===================================================================== */}
        {activeMatch.phase === 'ROUND_SUMMARY' && (() => {
          const isEnteringSuddenDeath =
            activeMatch.isSuddenDeath ||
            activeMatch.currentRound >= activeMatch.totalRounds;
          const tiedIds = isEnteringSuddenDeath
            ? detectTopTiedTeams(
                standings,
                activeMatch.isSuddenDeath ? activeMatch.suddenDeathTeamIds : undefined
              )
            : [];
          const nextRoundNumber = activeMatch.currentRound + 1;
          const isNextRoundFinal =
            !isEnteringSuddenDeath && nextRoundNumber === activeMatch.totalRounds;
          const nextOrderIds = !isEnteringSuddenDeath
            ? getRoundTeamOrder(
                activeMatch.teams,
                0,
                nextRoundNumber
              )
            : activeMatch.teams
                .filter((t) => tiedIds.includes(t.id))
                .map((t) => t.id);

          return (
            <div className="my-auto max-w-3xl w-full mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-6 animate-gentle-pop">
              <div className="text-center space-y-2">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {activeMatch.isSuddenDeath
                    ? `پایان دور ${formatNum(activeMatch.suddenDeathRound, p)} مرگ ناگهانی`
                    : `پایان دور ${formatNum(activeMatch.currentRound, p)} از ${formatNum(
                        activeMatch.totalRounds,
                        p
                      )}`}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {isEnteringSuddenDeath
                    ? 'تساوی در صدر جدول — ورود به مرگ ناگهانی!'
                    : 'جدول رده‌بندی مسابقه'}
                </h2>
              </div>

              {isNextRoundFinal && (
                <div className="rounded-2xl border-2 border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex items-center gap-3 text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                  <Crown className="w-6 h-6 text-amber-500 shrink-0" />
                  <span>
                    دور بعدی <strong>دور آخر مسابقه</strong> است! موضوع طلایی{' '}
                    {formatNum(settings.goldenBasePoints, p)} امتیازی برای همه تیم‌ها باز می‌شود!
                  </span>
                </div>
              )}

              {isEnteringSuddenDeath && tiedIds.length >= 2 && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/25 p-4 text-center text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                  امتیاز تیم‌های صدرنشین مساوی است! هر دو تیم در دور مرگ ناگهانی با فرصت برابر رقابت می‌کنند تا قهرمان مشخص شود.
                </div>
              )}

              <ScoreboardTable
                standings={standings}
                persianDigits={p}
                goldenEnabled={activeMatch.goldenEnabled}
                goldenMaxPerTeam={activeMatch.goldenOpportunitiesPerTeam}
              />

              <div className="rounded-2xl bg-stone-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-400 text-center tabular-nums">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  ترتیب نوبت در دور بعد:
                </span>{' '}
                {nextOrderIds
                  .map((id) => activeMatch.teams.find((t) => t.id === id)?.name ?? '')
                  .join(' ← ')}
              </div>

              <button
                type="button"
                onClick={beginNextRound}
                className="w-full min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-8 py-4 text-base font-black transition-all"
              >
                <span>
                  {isEnteringSuddenDeath
                    ? 'شروع دوئل مرگ ناگهانی'
                    : isNextRoundFinal
                    ? `شروع دور آخر (دور ${formatNum(nextRoundNumber, p)})`
                    : `شروع دور ${formatNum(nextRoundNumber, p)}`}
                </span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          );
        })()}

        {/* =====================================================================
            PHASE 7: GAME_OVER — CHAMPIONSHIP PODIUM
           ===================================================================== */}
        {activeMatch.phase === 'GAME_OVER' && (() => {
          const champion = standings[0];
          return (
            <div className="my-auto max-w-3xl w-full mx-auto space-y-5 pb-6 animate-gentle-pop">
              <div className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-950/30 dark:to-slate-900 p-6 sm:p-10 text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-amber-500 text-slate-950 mx-auto flex items-center justify-center shadow-md">
                  <Trophy className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    پایان مسابقه ادابازی
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                    قهرمان: «{champion?.teamName}»
                  </h1>
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    با کسب {formatNum(champion?.totalScore ?? 0, p)} امتیاز
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => replayWithTeams(activeMatch.teams)}
                    className="min-h-[52px] inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-sm sm:text-base font-black"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>بازی مجدد با همین تیم‌ها</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('home')}
                    className="min-h-[52px] inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-bold text-slate-800 dark:text-slate-200"
                  >
                    <Home className="w-4 h-4" />
                    <span>بازگشت به صفحه اول</span>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>جدول امتیازات نهایی</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowFullAudit(!showFullAudit)}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    {showFullAudit ? 'بستن ریز نوبت‌ها' : 'مشاهده ریز نوبت‌ها'}
                  </button>
                </div>

                <ScoreboardTable
                  standings={standings}
                  persianDigits={p}
                  goldenEnabled={activeMatch.goldenEnabled}
                  goldenMaxPerTeam={activeMatch.goldenOpportunitiesPerTeam}
                />

                {showFullAudit && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto text-xs tabular-nums">
                    {activeMatch.allEvents.map((ev) => {
                      const tObj = activeMatch.teams.find((t) => t.id === ev.teamId);
                      return (
                        <div
                          key={ev.id}
                          className="py-2.5 flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {ev.wordText}
                            </span>
                            <span className="mx-1.5 text-slate-400">·</span>
                            <span className="text-slate-500">{tObj?.name}</span>
                            <span className="mx-1.5 text-slate-400">·</span>
                            <span className="text-slate-500">
                              دور {formatNum(ev.roundNumber, p)}
                            </span>
                          </div>
                          <span
                            className={`font-bold ${
                              ev.netPoints > 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : ev.netPoints < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatSignedNum(ev.netPoints, p)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* =====================================================================
          MOBILE BOTTOM SHEET: CATEGORY DIFFICULTY PICKER
         ===================================================================== */}
      {pickerCategory && activeMatch.phase === 'PRE_TURN' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPickerCategory(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-gentle-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <DynamicIcon name={pickerCategory.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">
                    {pickerCategory.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    انتخاب سطح برای «{activeTeam.name}» (فقط برای همین تیم بسته می‌شود)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPickerCategory(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {DIFFICULTIES_ORDER.map((diff) => {
                const alreadyUsedByTeam = isComboUsedByTeam(
                  activeMatch,
                  activeTeam.id,
                  pickerCategory.id,
                  diff
                );
                const lockedBySuddenDeath =
                  activeMatch.isSuddenDeath && diff !== 'hard';
                const isDisabled = alreadyUsedByTeam || lockedBySuddenDeath;

                const pts = getPointsForCatDiff(pickerCategory, diff);
                const sec = getTimeForCatDiff(pickerCategory, diff);
                const bonusTiers = getSpeedBonusTiersForCatDiff(pickerCategory, diff);
                const topTier = bonusTiers[0];

                return (
                  <button
                    key={diff}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectCategoryDifficulty(pickerCategory, diff)}
                    className={`w-full min-h-[72px] rounded-2xl border p-4 text-right flex items-center justify-between gap-3 transition-all tabular-nums ${
                      isDisabled
                        ? 'border-slate-200 dark:border-slate-800 bg-stone-100/70 dark:bg-slate-950/50 opacity-55 cursor-not-allowed'
                        : diff === 'hard'
                        ? 'border-emerald-600/50 bg-emerald-50/50 dark:bg-emerald-950/25 hover:border-emerald-600 active:scale-[0.98]'
                        : 'border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 hover:border-emerald-600 active:scale-[0.98]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          سطح {difficultyLabel(diff)}
                        </span>
                        {alreadyUsedByTeam && (
                          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            (بسته‌شده برای {activeTeam.name})
                          </span>
                        )}
                        {lockedBySuddenDeath && !alreadyUsedByTeam && (
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            (مرگ ناگهانی فقط سخت)
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        <span>زمان: {formatNum(sec, p)} ثانیه</span>
                        {topTier && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>
                              تایم پله‌ای:{' '}
                              {bonusTiers
                                .map(
                                  (t) =>
                                    `تا ${formatNum(t.thresholdSec, p)}ث (+${formatNum(t.bonus, p)})`
                                )
                                .join(' ، ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isDisabled ? (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                          {alreadyUsedByTeam ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-sm font-black whitespace-nowrap">
                          {formatNum(pts, p)} امتیاز
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          LIVE SCOREBOARD & TEAM USED TOPICS DRAWER
         ===================================================================== */}
      {showScoreboardDrawer && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowScoreboardDrawer(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-gentle-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                جدول امتیازات و وضعیت تیم‌ها
              </h3>
              <button
                type="button"
                onClick={() => setShowScoreboardDrawer(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              <ScoreboardTable
                standings={standings}
                activeTeamId={activeTeam.id}
                persianDigits={p}
                goldenEnabled={activeMatch.goldenEnabled}
                goldenMaxPerTeam={activeMatch.goldenOpportunitiesPerTeam}
              />

              {/* Per-team used topics overview */}
              <div className="space-y-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  موضوعات استفاده‌شده به تفکیک هر تیم:
                </h4>
                <div className="space-y-2">
                  {activeMatch.teams.map((t) => {
                    const used = getTeamUsedCombos(activeMatch, t.id);
                    return (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-950 p-3 text-xs space-y-1"
                      >
                        <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span>{t.name}</span>
                          <span className="text-slate-400 font-normal tabular-nums">
                            ({formatNum(used.length, p)} موضوع)
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {used.length === 0
                            ? 'هنوز موضوعی نرفته است'
                            : used
                                .map(
                                  (u) =>
                                    `${categoryNameMap[u.categoryId] ?? u.categoryId} (${difficultyLabel(
                                      u.difficulty
                                    )})`
                                )
                                .join(' · ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Terminate Current Match Option */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                {!confirmExitGame ? (
                  <button
                    type="button"
                    onClick={() => setConfirmExitGame(true)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-rose-500/40 text-xs font-bold text-rose-600 dark:text-rose-400"
                  >
                    لغو کامل این مسابقه
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setShowScoreboardDrawer(false);
                        setConfirmExitGame(false);
                        await abandonActiveMatch();
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
                    >
                      بله، مسابقه حذف شود
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmExitGame(false)}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                    >
                      انصراف
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowScoreboardDrawer(false)}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-extrabold"
                >
                  بستن جدول
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MANUAL WRONG ("غلط") CONFIRMATION MODAL
         ===================================================================== */}
      {confirmEndTurn && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmEndTurn(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center space-y-5 animate-gentle-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                ثبت «غلط» برای این کلمه؟
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                با ثبت «غلط»، امتیاز پایه و امتیاز تایم برای این کلمه صفر می‌شود و در صورت وجود خطا یا تعویض، کسر امتیاز آن لحاظ خواهد شد.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmEndTurn(false);
                  endTurnManuallyOrTimeout('manual_end');
                }}
                className="min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black"
              >
                بله، ثبت غلط
              </button>
              <button
                type="button"
                onClick={() => setConfirmEndTurn(false)}
                className="min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                ادامه اجرا
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
