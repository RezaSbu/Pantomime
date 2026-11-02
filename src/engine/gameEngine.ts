import { INITIAL_CATEGORIES } from '../data/categories';
import {
  ActiveMatchState,
  AppSettings,
  CompletedMatch,
  Difficulty,
  GameSetupConfig,
  ScoreEvent,
  WordItem,
} from '../types/game';
import {
  getRoundTeamOrder,
  getSuddenDeathTeamOrder,
  resolveInitialStartIndex,
} from './roundManager';
import {
  calculateFoulPenalty,
  calculateSwapPenalty,
  calculateWordScore,
  computeTeamStandings,
  detectTopTiedTeams,
} from './scoringEngine';
import {
  createIdleTimer,
  getTimerSnapshot,
  pauseTimerState,
  resumeTimerState,
  startTimerState,
  stopTimerState,
} from './timerEngine';
import {
  selectGoldenChallengeWord,
  selectNextRegularWord,
  selectReplacementWord,
} from './wordSelector';

function uid(prefix: string, now = Date.now()): string {
  return `${prefix}_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeComboKey(categoryId: string, difficulty: Difficulty): string {
  return `${categoryId}:${difficulty}`;
}

export function parseComboKey(key: string): { categoryId: string; difficulty: Difficulty } | null {
  const [categoryId, diff] = key.split(':');
  if (!categoryId || (diff !== 'easy' && diff !== 'medium' && diff !== 'hard')) {
    return null;
  }
  return { categoryId, difficulty: diff };
}

export function isComboUsedByTeam(
  match: ActiveMatchState,
  teamId: string,
  categoryId: string,
  difficulty: Difficulty
): boolean {
  const usedList = match.usedCombosByTeam?.[teamId] ?? [];
  return usedList.includes(makeComboKey(categoryId, difficulty));
}

export function getTeamUsedCombos(
  match: ActiveMatchState,
  teamId: string
): Array<{ key: string; categoryId: string; difficulty: Difficulty }> {
  const usedList = match.usedCombosByTeam?.[teamId] ?? [];
  const parsed: Array<{ key: string; categoryId: string; difficulty: Difficulty }> = [];
  for (const k of usedList) {
    const item = parseComboKey(k);
    if (item) {
      parsed.push({ key: k, ...item });
    }
  }
  return parsed;
}

function recordTeamComboLock(
  usedCombosByTeam: Record<string, string[]> | undefined,
  teamId: string,
  word: WordItem
): Record<string, string[]> {
  const base = usedCombosByTeam ?? {};
  if (word.kind === 'golden') return base;
  const key = makeComboKey(word.categoryId, word.difficulty);
  const current = base[teamId] ?? [];
  if (current.includes(key)) return base;
  return {
    ...base,
    [teamId]: [...current, key],
  };
}

function removeTeamComboLock(
  usedCombosByTeam: Record<string, string[]> | undefined,
  teamId: string,
  word: WordItem
): Record<string, string[]> {
  const base = usedCombosByTeam ?? {};
  if (word.kind === 'golden') return base;
  const key = makeComboKey(word.categoryId, word.difficulty);
  const current = base[teamId] ?? [];
  if (!current.includes(key)) return base;
  return {
    ...base,
    [teamId]: current.filter((item) => item !== key),
  };
}

export function isFinalRegularRound(match: ActiveMatchState): boolean {
  return !match.isSuddenDeath && match.currentRound === match.totalRounds;
}

export function createMatchState(
  config: GameSetupConfig,
  settings: AppSettings,
  now = Date.now(),
  rng: () => number = Math.random
): ActiveMatchState {
  const initialStartIndex = resolveInitialStartIndex(
    config.teams,
    config.startOrderMode,
    config.manualStartTeamId,
    rng
  );
  const roundTeamOrder = getRoundTeamOrder(config.teams, initialStartIndex, 1);

  const goldenUsedByTeam: Record<string, number> = {};
  const extraWrongGuessesByTeam: Record<string, number> = {};
  const usedCombosByTeam: Record<string, string[]> = {};
  for (const t of config.teams) {
    goldenUsedByTeam[t.id] = 0;
    extraWrongGuessesByTeam[t.id] = 0;
    usedCombosByTeam[t.id] = [];
  }

  const allCategoryIds =
    config.selectedCategoryIds && config.selectedCategoryIds.length > 0
      ? config.selectedCategoryIds
      : INITIAL_CATEGORIES.map((c) => c.id);

  const allDifficulties: Difficulty[] =
    config.enabledDifficulties && config.enabledDifficulties.length > 0
      ? config.enabledDifficulties
      : ['easy', 'medium', 'hard'];

  return {
    id: uid('match', now),
    createdAt: now,
    updatedAt: now,
    teams: config.teams,
    totalRounds: Math.max(1, config.totalRounds),
    wordsPerTurn: Math.max(1, config.wordsPerTurn ?? 1),
    initialStartIndex,
    selectedCategoryIds: allCategoryIds,
    enabledDifficulties: allDifficulties,
    goldenEnabled: config.goldenEnabled ?? settings.goldenEnabled,
    goldenOpportunitiesPerTeam: settings.goldenOpportunitiesPerTeam,
    currentRound: 1,
    currentTurnIndexInRound: 0,
    roundTeamOrder,
    isSuddenDeath: false,
    suddenDeathRound: 0,
    suddenDeathTeamIds: [],
    phase: 'PRE_TURN',
    currentSlot: null,
    turnCompletedEvents: [],
    allEvents: [],
    extraWrongGuessesByTeam,
    goldenUsedByTeam,
    usedCombosByTeam,
    usedWordIds: [],
    categoryUsageCount: {},
    lastCategoryId: null,
    lastSimilarityTag: null,
    timer: {
      mode: settings.timerMode,
      status: 'idle',
      durationSec: null,
      startedAtTimestamp: null,
      accumulatedElapsedMs: 0,
    },
  };
}

export function getActiveTeam(match: ActiveMatchState) {
  const activeId = match.roundTeamOrder[match.currentTurnIndexInRound];
  return match.teams.find((t) => t.id === activeId) ?? match.teams[0];
}

/**
 * Golden Challenge is strictly unlocked ONLY on the FINAL regular round (currentRound === totalRounds),
 * and each team can use it at most once (goldenOpportunitiesPerTeam).
 */
export function canActiveTeamUseGolden(match: ActiveMatchState): boolean {
  if (!match.goldenEnabled || match.isSuddenDeath) return false;
  if (!isFinalRegularRound(match)) return false;
  const team = getActiveTeam(match);
  if (!team) return false;
  const used = match.goldenUsedByTeam[team.id] ?? 0;
  return used < match.goldenOpportunitiesPerTeam;
}

export function beginTurnSlot(
  match: ActiveMatchState,
  wordBank: WordItem[],
  settings: AppSettings,
  options: {
    useGolden?: boolean;
    slotIndex?: number;
    forcedCategoryId?: string;
    forcedDifficulty?: Difficulty;
    now?: number;
    rng?: () => number;
  } = {}
): { state: ActiveMatchState; error?: string } {
  const now = options.now ?? Date.now();
  const rng = options.rng ?? Math.random;
  const slotIndex = options.slotIndex ?? 0;
  const team = getActiveTeam(match);
  const usedSet = new Set(match.usedWordIds);

  if (options.useGolden) {
    if (!isFinalRegularRound(match)) {
      return {
        state: match,
        error: 'موضوع طلایی فقط در دور آخر مسابقه قابل انتخاب است.',
      };
    }
    if (!canActiveTeamUseGolden(match)) {
      return { state: match, error: 'فرصت موضوع طلایی برای این تیم در دسترس نیست.' };
    }
    const sel = selectGoldenChallengeWord({
      wordBank,
      usedWordIds: usedSet,
      settings,
      rng,
    });
    if (!sel.word) {
      return { state: match, error: sel.fallbackNotice ?? 'عبارت طلایی یافت نشد.' };
    }
    const nextGoldenUsed = {
      ...match.goldenUsedByTeam,
      [team.id]: (match.goldenUsedByTeam[team.id] ?? 0) + 1,
    };
    const timer = createIdleTimer(sel.word, settings);
    return {
      state: {
        ...match,
        updatedAt: now,
        phase: 'CONCEALED',
        goldenUsedByTeam: nextGoldenUsed,
        usedWordIds: [...match.usedWordIds, sel.word.id],
        currentSlot: {
          slotIndex,
          word: sel.word,
          isWordRevealedToActor: false,
          isWordHiddenDuringPlay: false,
          swapsUsedInSlot: 0,
          wrongGuessesInSlot: 0,
          isScored: false,
          fallbackNotice: sel.fallbackNotice,
        },
        turnCompletedEvents: slotIndex === 0 ? [] : match.turnCompletedEvents,
        timer,
      },
    };
  }

  // Check per-team combo lock (category + difficulty)
  const allPossibleCombos: Array<{ categoryId: string; difficulty: Difficulty }> = [];
  for (const catId of match.selectedCategoryIds) {
    for (const diff of match.enabledDifficulties) {
      allPossibleCombos.push({ categoryId: catId, difficulty: diff });
    }
  }

  let effectiveUsedCombosByTeam = match.usedCombosByTeam ?? {};
  const teamUsedList = effectiveUsedCombosByTeam[team.id] ?? [];
  let boardResetNotice: string | undefined;

  // If a marathon match exceeds all possible (category × difficulty) slots for this team, unlock a new board cycle
  const remainingOpenCombos = allPossibleCombos.filter(
    (c) => !teamUsedList.includes(makeComboKey(c.categoryId, c.difficulty))
  );
  if (allPossibleCombos.length > 0 && remainingOpenCombos.length === 0) {
    effectiveUsedCombosByTeam = {
      ...effectiveUsedCombosByTeam,
      [team.id]: [],
    };
    boardResetNotice = 'تمام موضوعات و سطوح جدول توسط این تیم تکمیل شد؛ جدول انتخاب این تیم بازنشانی گردید.';
  }

  const activeTeamUsedAfterCheck = effectiveUsedCombosByTeam[team.id] ?? [];

  if (options.forcedCategoryId && options.forcedDifficulty) {
    const requestedKey = makeComboKey(options.forcedCategoryId, options.forcedDifficulty);
    if (activeTeamUsedAfterCheck.includes(requestedKey)) {
      return {
        state: match,
        error: `این موضوع و سطح دشواری قبلاً توسط «${team.name}» انتخاب شده و فقط برای این تیم بسته است.`,
      };
    }
  }

  // Determine target category & difficulty
  let targetCategoryId = options.forcedCategoryId;
  let targetDifficulty =
    options.forcedDifficulty ?? (match.isSuddenDeath ? 'hard' : undefined);

  // If neither forcedCategoryId nor forcedDifficulty was explicitly passed, prefer an unused combo for this team
  if (!options.forcedCategoryId && !options.forcedDifficulty) {
    const openForTarget = allPossibleCombos.filter((c) => {
      if (targetDifficulty && c.difficulty !== targetDifficulty) return false;
      return !activeTeamUsedAfterCheck.includes(makeComboKey(c.categoryId, c.difficulty));
    });
    if (openForTarget.length > 0 && targetDifficulty) {
      const pick = openForTarget[Math.floor(rng() * openForTarget.length) % openForTarget.length];
      targetCategoryId = pick.categoryId;
    }
  }

  const sel = selectNextRegularWord({
    wordBank,
    selectedCategoryIds: match.selectedCategoryIds,
    enabledDifficulties: match.enabledDifficulties,
    usedWordIds: usedSet,
    categoryUsageCount: match.categoryUsageCount,
    lastCategoryId: match.lastCategoryId,
    lastSimilarityTag: match.lastSimilarityTag,
    settings,
    forcedDifficulty: targetDifficulty,
    forcedCategoryId: targetCategoryId,
    rng,
  });

  if (!sel.word) {
    return {
      state: match,
      error: sel.fallbackNotice ?? 'کلمه‌ای برای نمایش یافت نشد.',
    };
  }

  const nextCatUsage = {
    ...match.categoryUsageCount,
    [sel.word.categoryId]: (match.categoryUsageCount[sel.word.categoryId] ?? 0) + 1,
  };

  // Lock this (category + difficulty) exclusively for the active team (never affects other teams)
  const lockedCombosForActiveTeam = recordTeamComboLock(
    effectiveUsedCombosByTeam,
    team.id,
    sel.word
  );

  const timer = createIdleTimer(sel.word, settings);

  return {
    state: {
      ...match,
      updatedAt: now,
      phase: 'CONCEALED',
      usedCombosByTeam: lockedCombosForActiveTeam,
      usedWordIds: [...match.usedWordIds, sel.word.id],
      categoryUsageCount: nextCatUsage,
      lastCategoryId: sel.word.categoryId,
      lastSimilarityTag: sel.word.tags[0] ?? null,
      currentSlot: {
        slotIndex,
        word: sel.word,
        isWordRevealedToActor: false,
        isWordHiddenDuringPlay: false,
        swapsUsedInSlot: 0,
        wrongGuessesInSlot: 0,
        isScored: false,
        fallbackNotice: sel.fallbackNotice ?? boardResetNotice,
      },
      turnCompletedEvents: slotIndex === 0 ? [] : match.turnCompletedEvents,
      timer,
    },
  };
}

/**
 * Allows going back to the topic selection board ONLY if the actor has NOT revealed the word yet
 * and no swaps have occurred. Prevents accidental mobile taps without risking word peeking.
 */
export function cancelTurnSelectionBeforeReveal(
  match: ActiveMatchState,
  now = Date.now()
): ActiveMatchState {
  if (
    match.phase !== 'CONCEALED' ||
    !match.currentSlot ||
    match.currentSlot.isWordRevealedToActor ||
    match.currentSlot.swapsUsedInSlot > 0 ||
    match.currentSlot.slotIndex > 0
  ) {
    return match;
  }

  const team = getActiveTeam(match);
  const cancelledWord = match.currentSlot.word;
  const nextUsedWords = match.usedWordIds.filter((id) => id !== cancelledWord.id);

  const nextGoldenUsed = { ...match.goldenUsedByTeam };
  if (cancelledWord.kind === 'golden') {
    nextGoldenUsed[team.id] = Math.max(0, (nextGoldenUsed[team.id] ?? 1) - 1);
  }

  const nextCatUsage = { ...match.categoryUsageCount };
  if (cancelledWord.kind !== 'golden' && nextCatUsage[cancelledWord.categoryId]) {
    nextCatUsage[cancelledWord.categoryId] = Math.max(
      0,
      nextCatUsage[cancelledWord.categoryId] - 1
    );
  }

  const nextUsedCombos = removeTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    cancelledWord
  );

  return {
    ...match,
    updatedAt: now,
    phase: 'PRE_TURN',
    currentSlot: null,
    goldenUsedByTeam: nextGoldenUsed,
    usedCombosByTeam: nextUsedCombos,
    usedWordIds: nextUsedWords,
    categoryUsageCount: nextCatUsage,
    timer: {
      ...match.timer,
      status: 'idle',
      durationSec: null,
      startedAtTimestamp: null,
      accumulatedElapsedMs: 0,
    },
  };
}

export function revealWordToActor(match: ActiveMatchState, now = Date.now()): ActiveMatchState {
  if (match.phase !== 'CONCEALED' || !match.currentSlot) return match;
  const team = getActiveTeam(match);
  const nextUsedCombos = recordTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    match.currentSlot.word
  );

  return {
    ...match,
    updatedAt: now,
    usedCombosByTeam: nextUsedCombos,
    currentSlot: {
      ...match.currentSlot,
      isWordRevealedToActor: true,
    },
  };
}

export function hideWordInConcealedPhase(
  match: ActiveMatchState,
  now = Date.now()
): ActiveMatchState {
  if (match.phase !== 'CONCEALED' || !match.currentSlot) return match;
  return {
    ...match,
    updatedAt: now,
    currentSlot: {
      ...match.currentSlot,
      isWordRevealedToActor: false,
    },
  };
}

export function startTurnPlayTimer(match: ActiveMatchState, now = Date.now()): ActiveMatchState {
  if (match.phase !== 'CONCEALED' || !match.currentSlot || !match.currentSlot.isWordRevealedToActor) {
    return match;
  }
  const team = getActiveTeam(match);
  const nextUsedCombos = recordTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    match.currentSlot.word
  );

  const nextTimer =
    match.timer.status === 'paused'
      ? resumeTimerState(match.timer, now)
      : startTimerState(match.timer, now);

  return {
    ...match,
    updatedAt: now,
    phase: 'PLAYING',
    usedCombosByTeam: nextUsedCombos,
    currentSlot: {
      ...match.currentSlot,
      isWordHiddenDuringPlay: false,
    },
    timer: nextTimer,
  };
}

export function toggleWordVisibilityDuringPlay(
  match: ActiveMatchState,
  now = Date.now()
): ActiveMatchState {
  if (!match.currentSlot) return match;
  return {
    ...match,
    updatedAt: now,
    currentSlot: {
      ...match.currentSlot,
      isWordHiddenDuringPlay: !match.currentSlot.isWordHiddenDuringPlay,
    },
  };
}

export function pauseTurnPlayTimer(match: ActiveMatchState, now = Date.now()): ActiveMatchState {
  if (match.phase !== 'PLAYING') return match;
  return {
    ...match,
    updatedAt: now,
    phase: 'PAUSED',
    timer: pauseTimerState(match.timer, now),
  };
}

export function resumeTurnPlayTimer(match: ActiveMatchState, now = Date.now()): ActiveMatchState {
  if (match.phase !== 'PAUSED') return match;
  return {
    ...match,
    updatedAt: now,
    phase: 'PLAYING',
    timer: resumeTimerState(match.timer, now),
  };
}

export function recordWrongGuessInTurn(
  match: ActiveMatchState,
  now = Date.now()
): ActiveMatchState {
  if (match.phase !== 'PLAYING' || !match.currentSlot || match.currentSlot.isScored) {
    return match;
  }
  return {
    ...match,
    updatedAt: now,
    currentSlot: {
      ...match.currentSlot,
      wrongGuessesInSlot: match.currentSlot.wrongGuessesInSlot + 1,
    },
  };
}

export function swapWordInTurn(
  match: ActiveMatchState,
  wordBank: WordItem[],
  settings: AppSettings,
  now = Date.now(),
  rng: () => number = Math.random
): { state: ActiveMatchState; swapped: boolean; error?: string } {
  if (
    (match.phase !== 'PLAYING' && match.phase !== 'PAUSED' && match.phase !== 'CONCEALED') ||
    !match.currentSlot ||
    match.currentSlot.isScored
  ) {
    return { state: match, swapped: false, error: 'امکان تعویض در این وضعیت وجود ندارد.' };
  }

  if (match.currentSlot.swapsUsedInSlot >= settings.maxSwapsPerCard) {
    return {
      state: match,
      swapped: false,
      error: 'در هر نوبت فقط یک‌بار امکان تعویض کلمه وجود دارد.',
    };
  }

  const usedSet = new Set(match.usedWordIds);
  const replacement = selectReplacementWord({
    currentWord: match.currentSlot.word,
    wordBank,
    selectedCategoryIds: match.selectedCategoryIds,
    usedWordIds: usedSet,
    settings,
    rng,
  });

  if (!replacement.word) {
    return {
      state: match,
      swapped: false,
      error: replacement.fallbackNotice ?? 'کلمه جایگزینی در بانک وجود ندارد.',
    };
  }

  const team = getActiveTeam(match);
  const nextUsedCombos = recordTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    match.currentSlot.word
  );
  const snap = getTimerSnapshot(match.timer, now);
  const penalty = calculateSwapPenalty(settings);
  const foulPenalty = calculateFoulPenalty(match.currentSlot.wrongGuessesInSlot, settings);

  const swapEvent: ScoreEvent = {
    id: uid('ev', now),
    timestamp: now,
    roundNumber: match.currentRound,
    turnIndexInRound: match.currentTurnIndexInRound,
    wordSlotIndex: match.currentSlot.slotIndex,
    isSuddenDeath: match.isSuddenDeath,
    teamId: team.id,
    wordId: match.currentSlot.word.id,
    wordText: match.currentSlot.word.text,
    categoryId: match.currentSlot.word.categoryId,
    difficulty: match.currentSlot.word.difficulty,
    kind: match.currentSlot.word.kind,
    outcome: 'swap',
    elapsedSeconds: snap.elapsedSeconds,
    basePoints: 0,
    speedBonus: 0,
    swapPenalty: penalty,
    foulPenalty,
    netPoints: -(penalty + foulPenalty),
    wrongGuessesInSlot: match.currentSlot.wrongGuessesInSlot,
  };

  // Fresh timer for the new swapped card
  const freshTimer = createIdleTimer(replacement.word, settings);

  return {
    swapped: true,
    state: {
      ...match,
      updatedAt: now,
      phase: 'CONCEALED',
      usedCombosByTeam: nextUsedCombos,
      usedWordIds: [...match.usedWordIds, replacement.word.id],
      turnCompletedEvents: [...match.turnCompletedEvents, swapEvent],
      allEvents: [...match.allEvents, swapEvent],
      currentSlot: {
        slotIndex: match.currentSlot.slotIndex,
        word: replacement.word,
        isWordRevealedToActor: true, // Show replacement immediately to actor so they don't need an extra tap
        isWordHiddenDuringPlay: false,
        swapsUsedInSlot: match.currentSlot.swapsUsedInSlot + 1,
        wrongGuessesInSlot: 0,
        isScored: false,
        fallbackNotice: replacement.fallbackNotice,
      },
      timer: freshTimer,
    },
  };
}

/**
 * Flags the current word as invalid/reported without any penalty,
 * selects a replacement from the same category and difficulty,
 * and strictly preserves the elapsed/remaining time of the current turn!
 */
export function reportInvalidWordAndReplace(
  match: ActiveMatchState,
  wordBank: WordItem[],
  settings: AppSettings,
  now = Date.now(),
  rng: () => number = Math.random
): { state: ActiveMatchState; reportedWordId: string | null; error?: string } {
  if (!match.currentSlot || match.currentSlot.isScored) {
    return { state: match, reportedWordId: null, error: 'کلمه فعالی برای گزارش وجود ندارد.' };
  }

  const reportedWord = match.currentSlot.word;
  const pausedTimer = pauseTimerState(match.timer, now);
  const snap = getTimerSnapshot(pausedTimer, now);

  const usedSet = new Set(match.usedWordIds);
  const updatedBank = wordBank.map((w) =>
    w.id === reportedWord.id ? { ...w, status: 'reported' as const, reportedAt: now } : w
  );

  const replacement = selectReplacementWord({
    currentWord: reportedWord,
    wordBank: updatedBank,
    selectedCategoryIds: match.selectedCategoryIds,
    usedWordIds: usedSet,
    settings,
    rng,
  });

  if (!replacement.word) {
    return {
      state: match,
      reportedWordId: null,
      error: replacement.fallbackNotice ?? 'کلمه جایگزینی برای این دسته یافت نشد.',
    };
  }

  const team = getActiveTeam(match);
  const nextUsedCombos = recordTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    reportedWord
  );
  const reportEvent: ScoreEvent = {
    id: uid('ev', now),
    timestamp: now,
    roundNumber: match.currentRound,
    turnIndexInRound: match.currentTurnIndexInRound,
    wordSlotIndex: match.currentSlot.slotIndex,
    isSuddenDeath: match.isSuddenDeath,
    teamId: team.id,
    wordId: reportedWord.id,
    wordText: reportedWord.text,
    categoryId: reportedWord.categoryId,
    difficulty: reportedWord.difficulty,
    kind: reportedWord.kind,
    outcome: 'invalid_report',
    elapsedSeconds: snap.elapsedSeconds,
    basePoints: 0,
    speedBonus: 0,
    swapPenalty: 0,
    foulPenalty: 0,
    netPoints: 0,
    wrongGuessesInSlot: 0,
  };

  return {
    reportedWordId: reportedWord.id,
    state: {
      ...match,
      updatedAt: now,
      phase: 'CONCEALED',
      usedCombosByTeam: nextUsedCombos,
      usedWordIds: [...match.usedWordIds, replacement.word.id],
      turnCompletedEvents: [...match.turnCompletedEvents, reportEvent],
      allEvents: [...match.allEvents, reportEvent],
      currentSlot: {
        slotIndex: match.currentSlot.slotIndex,
        word: replacement.word,
        isWordRevealedToActor: false,
        isWordHiddenDuringPlay: false,
        swapsUsedInSlot: match.currentSlot.swapsUsedInSlot, // Swap quota NOT consumed!
        wrongGuessesInSlot: match.currentSlot.wrongGuessesInSlot, // Preserve fouls committed so far in turn!
        isScored: false,
        fallbackNotice:
          replacement.fallbackNotice ??
          'کلمه قبلی بدون کسر امتیاز تعویض شد و زمان باقی‌مانده کاملاً حفظ گردید.',
      },
      timer: {
        ...pausedTimer,
        status: pausedTimer.accumulatedElapsedMs > 0 ? 'paused' : 'idle',
      },
    },
  };
}

/**
 * Records a solved word with atomic idempotency guard against rapid double-clicks.
 */
export function markWordSolved(
  match: ActiveMatchState,
  wordBank: WordItem[],
  settings: AppSettings,
  now = Date.now(),
  rng: () => number = Math.random
): ActiveMatchState {
  if (
    (match.phase !== 'PLAYING' && match.phase !== 'PAUSED') ||
    !match.currentSlot ||
    match.currentSlot.isScored
  ) {
    return match;
  }

  const stoppedTimer = stopTimerState(match.timer, now);
  const snap = getTimerSnapshot(stoppedTimer, now);
  const score = calculateWordScore(match.currentSlot.word, snap.elapsedSeconds, settings);
  const foulPenalty = calculateFoulPenalty(match.currentSlot.wrongGuessesInSlot, settings);
  const team = getActiveTeam(match);
  const nextUsedCombos = recordTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    match.currentSlot.word
  );

  const correctEvent: ScoreEvent = {
    id: uid('ev', now),
    timestamp: now,
    roundNumber: match.currentRound,
    turnIndexInRound: match.currentTurnIndexInRound,
    wordSlotIndex: match.currentSlot.slotIndex,
    isSuddenDeath: match.isSuddenDeath,
    teamId: team.id,
    wordId: match.currentSlot.word.id,
    wordText: match.currentSlot.word.text,
    categoryId: match.currentSlot.word.categoryId,
    difficulty: match.currentSlot.word.difficulty,
    kind: match.currentSlot.word.kind,
    outcome: 'correct',
    elapsedSeconds: snap.elapsedSeconds,
    basePoints: score.basePoints,
    speedBonus: score.speedBonus,
    swapPenalty: 0,
    foulPenalty,
    netPoints: score.totalPoints - foulPenalty,
    wrongGuessesInSlot: match.currentSlot.wrongGuessesInSlot,
  };

  const nextMatchBase: ActiveMatchState = {
    ...match,
    updatedAt: now,
    usedCombosByTeam: nextUsedCombos,
    currentSlot: {
      ...match.currentSlot,
      isScored: true,
    },
    turnCompletedEvents: [...match.turnCompletedEvents, correctEvent],
    allEvents: [...match.allEvents, correctEvent],
    timer: stoppedTimer,
  };

  // Multi-word turn support (only for regular non-golden, non-sudden-death turns)
  const hasMoreWordsInTurn =
    !match.isSuddenDeath &&
    match.currentSlot.word.kind !== 'golden' &&
    match.currentSlot.slotIndex + 1 < match.wordsPerTurn;

  if (hasMoreWordsInTurn) {
    const nextSlot = beginTurnSlot(nextMatchBase, wordBank, settings, {
      slotIndex: match.currentSlot.slotIndex + 1,
      now,
      rng,
    });
    if (nextSlot.state !== nextMatchBase) {
      return nextSlot.state;
    }
  }

  return {
    ...nextMatchBase,
    phase: 'TURN_RESULT',
  };
}

export function expireTurnTimer(match: ActiveMatchState, now = Date.now()): ActiveMatchState {
  if (match.phase !== 'PLAYING' || !match.currentSlot || match.currentSlot.isScored) {
    return match;
  }
  const stoppedTimer = stopTimerState(match.timer, now);
  return {
    ...match,
    updatedAt: now,
    phase: 'TIME_UP',
    timer: stoppedTimer,
  };
}

export function finishTurnUnsolved(
  match: ActiveMatchState,
  outcome: 'timeout' | 'manual_end',
  wordBank: WordItem[],
  settings: AppSettings,
  now = Date.now(),
  rng: () => number = Math.random
): ActiveMatchState {
  if (!match.currentSlot || match.currentSlot.isScored) {
    return {
      ...match,
      updatedAt: now,
      phase: 'TURN_RESULT',
    };
  }

  const stoppedTimer = stopTimerState(match.timer, now);
  const snap = getTimerSnapshot(stoppedTimer, now);
  const foulPenalty = calculateFoulPenalty(match.currentSlot.wrongGuessesInSlot, settings);
  const team = getActiveTeam(match);
  const nextUsedCombos = recordTeamComboLock(
    match.usedCombosByTeam,
    team.id,
    match.currentSlot.word
  );

  const endEvent: ScoreEvent = {
    id: uid('ev', now),
    timestamp: now,
    roundNumber: match.currentRound,
    turnIndexInRound: match.currentTurnIndexInRound,
    wordSlotIndex: match.currentSlot.slotIndex,
    isSuddenDeath: match.isSuddenDeath,
    teamId: team.id,
    wordId: match.currentSlot.word.id,
    wordText: match.currentSlot.word.text,
    categoryId: match.currentSlot.word.categoryId,
    difficulty: match.currentSlot.word.difficulty,
    kind: match.currentSlot.word.kind,
    outcome,
    elapsedSeconds: snap.elapsedSeconds,
    basePoints: 0,
    speedBonus: 0,
    swapPenalty: 0,
    foulPenalty,
    netPoints: -foulPenalty,
    wrongGuessesInSlot: match.currentSlot.wrongGuessesInSlot,
  };

  const nextMatchBase: ActiveMatchState = {
    ...match,
    updatedAt: now,
    usedCombosByTeam: nextUsedCombos,
    currentSlot: {
      ...match.currentSlot,
      isScored: true,
    },
    turnCompletedEvents: [...match.turnCompletedEvents, endEvent],
    allEvents: [...match.allEvents, endEvent],
    timer: stoppedTimer,
  };

  if (
    outcome === 'timeout' &&
    !match.isSuddenDeath &&
    match.currentSlot.word.kind !== 'golden' &&
    match.currentSlot.slotIndex + 1 < match.wordsPerTurn
  ) {
    const nextSlot = beginTurnSlot(nextMatchBase, wordBank, settings, {
      slotIndex: match.currentSlot.slotIndex + 1,
      now,
      rng,
    });
    if (nextSlot.state !== nextMatchBase) {
      return nextSlot.state;
    }
  }

  return {
    ...nextMatchBase,
    phase: 'TURN_RESULT',
  };
}

export function proceedFromTurnResult(
  match: ActiveMatchState,
  settings: AppSettings,
  now = Date.now()
): ActiveMatchState {
  if (match.phase !== 'TURN_RESULT') return match;

  if (match.currentTurnIndexInRound + 1 < match.roundTeamOrder.length) {
    return {
      ...match,
      updatedAt: now,
      currentTurnIndexInRound: match.currentTurnIndexInRound + 1,
      phase: 'PRE_TURN',
      currentSlot: null,
      turnCompletedEvents: [],
    };
  }

  // Last team of the round finished!
  const standings = computeTeamStandings(
    match.teams,
    match.allEvents,
    match.extraWrongGuessesByTeam,
    match.goldenUsedByTeam,
    settings.allowNegativeScore
  );

  if (match.isSuddenDeath) {
    const tied = detectTopTiedTeams(standings, match.suddenDeathTeamIds);
    if (tied.length >= 2) {
      return {
        ...match,
        updatedAt: now,
        phase: 'ROUND_SUMMARY',
        currentSlot: null,
      };
    }
    return {
      ...match,
      updatedAt: now,
      phase: 'GAME_OVER',
      currentSlot: null,
    };
  }

  if (match.currentRound < match.totalRounds) {
    return {
      ...match,
      updatedAt: now,
      phase: 'ROUND_SUMMARY',
      currentSlot: null,
    };
  }

  // Final regular round ended -> Check for 1st place tie
  const tiedTop = detectTopTiedTeams(standings);
  if (tiedTop.length >= 2) {
    return {
      ...match,
      updatedAt: now,
      phase: 'ROUND_SUMMARY',
      currentSlot: null,
    };
  }

  return {
    ...match,
    updatedAt: now,
    phase: 'GAME_OVER',
    currentSlot: null,
  };
}

export function startNextRoundInMatch(
  match: ActiveMatchState,
  settings: AppSettings,
  now = Date.now()
): ActiveMatchState {
  if (match.phase !== 'ROUND_SUMMARY') return match;

  if (!match.isSuddenDeath && match.currentRound < match.totalRounds) {
    const nextRound = match.currentRound + 1;
    const nextOrder = getRoundTeamOrder(match.teams, match.initialStartIndex, nextRound);
    return {
      ...match,
      updatedAt: now,
      currentRound: nextRound,
      currentTurnIndexInRound: 0,
      roundTeamOrder: nextOrder,
      phase: 'PRE_TURN',
      currentSlot: null,
      turnCompletedEvents: [],
    };
  }

  // Start or continue Sudden Death tie-breaker
  const standings = computeTeamStandings(
    match.teams,
    match.allEvents,
    match.extraWrongGuessesByTeam,
    match.goldenUsedByTeam,
    settings.allowNegativeScore
  );
  const tiedIds = detectTopTiedTeams(
    standings,
    match.isSuddenDeath ? match.suddenDeathTeamIds : undefined
  );

  if (tiedIds.length < 2) {
    return {
      ...match,
      updatedAt: now,
      phase: 'GAME_OVER',
      currentSlot: null,
    };
  }

  const nextSdRound = match.isSuddenDeath ? match.suddenDeathRound + 1 : 1;
  const sdOrder = getSuddenDeathTeamOrder(tiedIds, nextSdRound, match.teams);

  return {
    ...match,
    updatedAt: now,
    isSuddenDeath: true,
    suddenDeathRound: nextSdRound,
    suddenDeathTeamIds: sdOrder,
    roundTeamOrder: sdOrder,
    currentTurnIndexInRound: 0,
    phase: 'PRE_TURN',
    currentSlot: null,
    turnCompletedEvents: [],
  };
}

export function buildCompletedMatchRecord(
  match: ActiveMatchState,
  settings: AppSettings,
  finishedAt = Date.now()
): CompletedMatch {
  const standings = computeTeamStandings(
    match.teams,
    match.allEvents,
    match.extraWrongGuessesByTeam,
    match.goldenUsedByTeam,
    settings.allowNegativeScore
  );

  return {
    id: match.id,
    startedAt: match.createdAt,
    finishedAt,
    totalRoundsPlayed: match.currentRound + match.suddenDeathRound,
    hadSuddenDeath: match.isSuddenDeath,
    teams: match.teams,
    standings,
    winnerTeamId: standings[0]?.teamId ?? match.teams[0]?.id ?? '',
    events: match.allEvents,
    selectedCategoryIds: match.selectedCategoryIds,
  };
}
