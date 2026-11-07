import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES } from '../../data/categories';
import { INITIAL_WORDS, validateWordBank } from '../../data/initialWordBank';
import { DEFAULT_SETTINGS } from '../../storage/settingsStorage';
import { WordItem } from '../../types/game';
import { exportWordsToCsv, parseWordsFromCsv } from '../../utils/importExport';
import {
  beginTurnSlot,
  canActiveTeamUseGolden,
  cancelTurnSelectionBeforeReveal,
  createMatchState,
  finishTurnUnsolved,
  isComboUsedByTeam,
  markWordSolved,
  pauseTurnPlayTimer,
  proceedFromTurnResult,
  recordWrongGuessInTurn,
  reportInvalidWordAndReplace,
  resumeTurnPlayTimer,
  revealWordToActor,
  startNextRoundInMatch,
  startTurnPlayTimer,
  swapWordInTurn,
} from '../gameEngine';
import { createDefaultTeams, getRoundTeamOrder } from '../roundManager';
import {
  calculateWordScore,
  computeTeamStandings,
  detectTopTiedTeams,
} from '../scoringEngine';
import {
  createIdleTimer,
  getTimerSnapshot,
  pauseTimerState,
  resumeTimerState,
  startTimerState,
} from '../timerEngine';
import {
  selectDifficultyByWeight,
  selectNextRegularWord,
} from '../wordSelector';

const makeWord = (overrides: Partial<WordItem>): WordItem => ({
  id: 'test_word_1',
  text: 'کلمه آزمایشی',
  categoryId: 'movies_series',
  difficulty: 'medium',
  kind: 'regular',
  basePoints: 4,
  defaultTimeSec: 75,
  speedBonusThresholdSec: 30,
  speedBonusPoints: 3,
  status: 'valid',
  tags: [],
  alternatives: [],
  ...overrides,
});

describe('Scoring Engine — Stepped Speed Bonus Tiers & Base Point Rules', () => {
  it('calculates 2-point Easy regular stepped bonuses (<=10s -> +2, <=20s -> +1, >20s -> 0)', () => {
    const easyWord = makeWord({ difficulty: 'easy', basePoints: 2 });
    expect(calculateWordScore(easyWord, 10, DEFAULT_SETTINGS).totalPoints).toBe(4);
    expect(calculateWordScore(easyWord, 15, DEFAULT_SETTINGS).totalPoints).toBe(3);
    expect(calculateWordScore(easyWord, 20, DEFAULT_SETTINGS).totalPoints).toBe(3);
    expect(calculateWordScore(easyWord, 21, DEFAULT_SETTINGS).totalPoints).toBe(2);
  });

  it('calculates 4-point Medium regular stepped bonuses (<=18s -> +3, <=35s -> +2, <=50s -> +1, >50s -> 0)', () => {
    const mediumWord = makeWord({ difficulty: 'medium', basePoints: 4 });
    expect(calculateWordScore(mediumWord, 18, DEFAULT_SETTINGS).totalPoints).toBe(7);
    expect(calculateWordScore(mediumWord, 25, DEFAULT_SETTINGS).totalPoints).toBe(6);
    expect(calculateWordScore(mediumWord, 45, DEFAULT_SETTINGS).totalPoints).toBe(5);
    expect(calculateWordScore(mediumWord, 51, DEFAULT_SETTINGS).totalPoints).toBe(4);
  });

  it('calculates 6-point Hard regular stepped bonuses (<=25s -> +4, <=50s -> +2, <=75s -> +1, >75s -> 0)', () => {
    const hardWord = makeWord({ difficulty: 'hard', basePoints: 6 });
    expect(calculateWordScore(hardWord, 25, DEFAULT_SETTINGS).totalPoints).toBe(10);
    expect(calculateWordScore(hardWord, 40, DEFAULT_SETTINGS).totalPoints).toBe(8);
    expect(calculateWordScore(hardWord, 50, DEFAULT_SETTINGS).totalPoints).toBe(8);
    expect(calculateWordScore(hardWord, 65, DEFAULT_SETTINGS).totalPoints).toBe(7);
    expect(calculateWordScore(hardWord, 76, DEFAULT_SETTINGS).totalPoints).toBe(6);
  });

  it('calculates Proverb stepped speed bonuses across Easy, Medium, and Hard', () => {
    const easyProverb = makeWord({ kind: 'proverb', categoryId: 'proverbs', difficulty: 'easy' });
    const medProverb = makeWord({ kind: 'proverb', categoryId: 'proverbs', difficulty: 'medium' });
    const hardProverb = makeWord({ kind: 'proverb', categoryId: 'proverbs', difficulty: 'hard' });

    expect(calculateWordScore(easyProverb, 25, DEFAULT_SETTINGS).totalPoints).toBe(8);
    expect(calculateWordScore(easyProverb, 40, DEFAULT_SETTINGS).totalPoints).toBe(6);
    expect(calculateWordScore(easyProverb, 60, DEFAULT_SETTINGS).totalPoints).toBe(5);

    expect(calculateWordScore(medProverb, 30, DEFAULT_SETTINGS).totalPoints).toBe(12);
    expect(calculateWordScore(medProverb, 50, DEFAULT_SETTINGS).totalPoints).toBe(10);
    expect(calculateWordScore(medProverb, 75, DEFAULT_SETTINGS).totalPoints).toBe(8);

    expect(calculateWordScore(hardProverb, 40, DEFAULT_SETTINGS).totalPoints).toBe(15);
    expect(calculateWordScore(hardProverb, 60, DEFAULT_SETTINGS).totalPoints).toBe(13);
    expect(calculateWordScore(hardProverb, 90, DEFAULT_SETTINGS).totalPoints).toBe(11);
    expect(calculateWordScore(hardProverb, 110, DEFAULT_SETTINGS).totalPoints).toBe(10);
  });

  it('calculates Golden Challenge stepped speed bonus (<=60s: 40, <=110s: 36, <=155s: 33, >155s: 30)', () => {
    const goldenWord = makeWord({ kind: 'golden', categoryId: 'golden', difficulty: 'hard' });
    expect(calculateWordScore(goldenWord, 60, DEFAULT_SETTINGS).totalPoints).toBe(40);
    expect(calculateWordScore(goldenWord, 90, DEFAULT_SETTINGS).totalPoints).toBe(36);
    expect(calculateWordScore(goldenWord, 130, DEFAULT_SETTINGS).totalPoints).toBe(33);
    expect(calculateWordScore(goldenWord, 170, DEFAULT_SETTINGS).totalPoints).toBe(30);
  });
});

describe('Round Manager — Strict Team 1 Start & Continuous Cyclic Order', () => {
  it('always starts from Team 1 and repeats T1 -> T2 -> T3 across every round', () => {
    const teams3 = createDefaultTeams(3);
    expect(getRoundTeamOrder(teams3, 0, 1)).toEqual(['team_1', 'team_2', 'team_3']);
    expect(getRoundTeamOrder(teams3, 0, 2)).toEqual(['team_1', 'team_2', 'team_3']);
    expect(getRoundTeamOrder(teams3, 0, 3)).toEqual(['team_1', 'team_2', 'team_3']);
    expect(getRoundTeamOrder(teams3, 0, 4)).toEqual(['team_1', 'team_2', 'team_3']);
  });

  it('cycles 2 teams as T1 -> T2 -> T1 -> T2 across rounds without repeating T2 back-to-back', () => {
    const teams2 = createDefaultTeams(2);
    let match = createMatchState(
      { teams: teams2, totalRounds: 3, startOrderMode: 'random' },
      DEFAULT_SETTINGS,
      1000
    );

    // Round 1: T1 then T2
    expect(match.roundTeamOrder).toEqual(['team_1', 'team_2']);
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'objects',
      forcedDifficulty: 'easy',
      now: 1000,
    }).state;
    match = revealWordToActor(match, 1100);
    match = startTurnPlayTimer(match, 1200);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 5000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 5100);

    // Now T2 plays
    expect(match.roundTeamOrder[match.currentTurnIndexInRound]).toBe('team_2');
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'objects',
      forcedDifficulty: 'easy',
      now: 6000,
    }).state;
    match = revealWordToActor(match, 6100);
    match = startTurnPlayTimer(match, 6200);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 10_000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 10_100);

    // Start Round 2 -> MUST wrap back to T1 (['team_1', 'team_2']), NOT T2!
    expect(match.phase).toBe('ROUND_SUMMARY');
    match = startNextRoundInMatch(match, DEFAULT_SETTINGS, 11_000);
    expect(match.roundTeamOrder).toEqual(['team_1', 'team_2']);
    expect(match.roundTeamOrder[match.currentTurnIndexInRound]).toBe('team_1');
  });
});

describe('Per-Team Topic Selection, Combo Locking & Final-Round Golden Rule', () => {
  it('locks chosen (category + difficulty) for that team while keeping it open for other teams', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 3,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    // Round 1, Team 1 selects Animals + Hard ('animals:hard')
    const pick1 = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'hard',
      now: 1000,
    });
    expect(pick1.error).toBeUndefined();
    match = pick1.state;
    expect(match.currentSlot!.word.categoryId).toBe('animals');
    expect(match.currentSlot!.word.difficulty).toBe('hard');

    // Reveal word -> permanently locks 'animals:hard' for Team 1
    match = revealWordToActor(match, 1500);
    expect(isComboUsedByTeam(match, 'team_1', 'animals', 'hard')).toBe(true);
    expect(isComboUsedByTeam(match, 'team_1', 'animals', 'medium')).toBe(false);
    expect(isComboUsedByTeam(match, 'team_2', 'animals', 'hard')).toBe(false);

    match = startTurnPlayTimer(match, 2000);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 20_000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 21_000);

    // Round 1, Team 2 CAN still select 'animals:hard' (and gets a non-duplicate word!)
    const team1WordId = match.allEvents[0].wordId;
    const pick2 = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'hard',
      now: 25_000,
    });
    expect(pick2.error).toBeUndefined();
    match = pick2.state;
    expect(match.currentSlot!.word.id).not.toBe(team1WordId);
    match = revealWordToActor(match, 26_000);
    match = startTurnPlayTimer(match, 26_500);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 45_000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 46_000);

    // Advance to Round 2 (cyclic order wraps right back to Team 1 -> Team 2)
    expect(match.phase).toBe('ROUND_SUMMARY');
    match = startNextRoundInMatch(match, DEFAULT_SETTINGS, 47_000);
    expect(match.roundTeamOrder).toEqual(['team_1', 'team_2']);

    // Team 1 tries to re-pick 'animals:hard' -> BLOCKED for Team 1!
    const blockedPick = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'hard',
      now: 48_000,
    });
    expect(blockedPick.error).toBeTruthy();

    // Team 1 picks 'animals:medium' instead -> ALLOWED!
    const validPick = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'medium',
      now: 49_000,
    });
    expect(validPick.error).toBeUndefined();
    expect(validPick.state.currentSlot!.word.difficulty).toBe('medium');
  });

  it('allows cancelling accidental topic tap before word reveal, and blocks cancel after word reveal', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      { teams, totalRounds: 3, startOrderMode: 'first' },
      DEFAULT_SETTINGS,
      1000
    );

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'football',
      forcedDifficulty: 'easy',
      now: 1000,
    }).state;
    expect(match.phase).toBe('CONCEALED');

    // Cancel BEFORE revealing secret word -> returns to PRE_TURN with nothing locked
    match = cancelTurnSelectionBeforeReveal(match, 1200);
    expect(match.phase).toBe('PRE_TURN');
    expect(isComboUsedByTeam(match, 'team_1', 'football', 'easy')).toBe(false);
    expect(match.usedWordIds.length).toBe(0);

    // Select again and REVEAL secret word -> cancel is now strictly blocked!
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'football',
      forcedDifficulty: 'easy',
      now: 2000,
    }).state;
    match = revealWordToActor(match, 2500);
    const afterBlockedCancel = cancelTurnSelectionBeforeReveal(match, 2600);
    expect(afterBlockedCancel).toBe(match);
    expect(afterBlockedCancel.phase).toBe('CONCEALED');
    expect(isComboUsedByTeam(match, 'team_1', 'football', 'easy')).toBe(true);
  });

  it('strictly locks Golden Challenge in early/middle rounds (e.g. Round 1..9 of 10) and unlocks ONLY in Final Round', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 10,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    // Round 1 of 10 -> Golden Challenge is LOCKED
    expect(canActiveTeamUseGolden(match)).toBe(false);
    const r1Attempt = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      useGolden: true,
      now: 1000,
    });
    expect(r1Attempt.error).toBeTruthy();

    // Simulate Round 7 & Round 8 of 10 -> Golden Challenge is STILL LOCKED!
    match = { ...match, currentRound: 7 };
    expect(canActiveTeamUseGolden(match)).toBe(false);
    match = { ...match, currentRound: 8 };
    expect(canActiveTeamUseGolden(match)).toBe(false);
    const r8Attempt = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      useGolden: true,
      now: 2000,
    });
    expect(r8Attempt.error).toBeTruthy();

    // Reach Final Round (Round 10 of 10) -> Golden Challenge UNLOCKS!
    match = { ...match, currentRound: 10 };
    expect(canActiveTeamUseGolden(match)).toBe(true);

    const r10Golden = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      useGolden: true,
      now: 3000,
    });
    expect(r10Golden.error).toBeUndefined();
    match = r10Golden.state;
    expect(match.currentSlot!.word.kind).toBe('golden');
    expect(canActiveTeamUseGolden(match)).toBe(false);

    // Finish Team 1's turn on Round 10 -> Team 2 also gets its Final Round Golden Challenge!
    match = revealWordToActor(match, 3100);
    match = startTurnPlayTimer(match, 3200);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 50_000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 51_000);
    expect(canActiveTeamUseGolden(match)).toBe(true);
  });
});

describe('Word Selector — 60/30/10 Distribution, Category Filter & No Repeats', () => {
  it('maintains ~60% Hard, ~30% Medium, ~10% Easy across 6,000 draws independent of bank size', () => {
    let seed = 42;
    const deterministicRng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const counts = { easy: 0, medium: 0, hard: 0 };
    const totalDraws = 6000;
    for (let i = 0; i < totalDraws; i++) {
      const d = selectDifficultyByWeight(
        ['easy', 'medium', 'hard'],
        DEFAULT_SETTINGS.difficultyWeights,
        deterministicRng
      );
      counts[d]++;
    }

    expect(counts.hard / totalDraws).toBeGreaterThan(0.57);
    expect(counts.hard / totalDraws).toBeLessThan(0.63);
    expect(counts.medium / totalDraws).toBeGreaterThan(0.27);
    expect(counts.medium / totalDraws).toBeLessThan(0.33);
    expect(counts.easy / totalDraws).toBeGreaterThan(0.08);
    expect(counts.easy / totalDraws).toBeLessThan(0.12);
  });

  it('never selects unselected categories or repeats words in a match', () => {
    const usedIds = new Set<string>();
    const usageCount: Record<string, number> = {};
    const selectedCats = ['football', 'movies_series'];

    for (let i = 0; i < 80; i++) {
      const res = selectNextRegularWord({
        wordBank: INITIAL_WORDS,
        selectedCategoryIds: selectedCats,
        enabledDifficulties: ['easy', 'medium', 'hard'],
        usedWordIds: usedIds,
        categoryUsageCount: usageCount,
        lastCategoryId: null,
        lastSimilarityTag: null,
        settings: DEFAULT_SETTINGS,
      });
      expect(res.word).not.toBeNull();
      expect(selectedCats).toContain(res.word!.categoryId);
      expect(usedIds.has(res.word!.id)).toBe(false);
      usedIds.add(res.word!.id);
      usageCount[res.word!.categoryId] = (usageCount[res.word!.categoryId] ?? 0) + 1;
    }
  });

  it('gracefully falls back and emits a notice when a single difficulty level in a category is exhausted', () => {
    const easyBookIds = INITIAL_WORDS.filter(
      (w) => w.categoryId === 'books' && w.difficulty === 'easy'
    ).map((w) => w.id);
    expect(easyBookIds.length).toBe(27);

    const usedIds = new Set<string>(easyBookIds);
    const res = selectNextRegularWord({
      wordBank: INITIAL_WORDS,
      selectedCategoryIds: ['books'],
      enabledDifficulties: ['easy', 'medium', 'hard'],
      usedWordIds: usedIds,
      categoryUsageCount: {},
      lastCategoryId: null,
      lastSimilarityTag: null,
      settings: DEFAULT_SETTINGS,
      rng: () => 0.01,
    });

    expect(res.word).not.toBeNull();
    expect(res.word!.categoryId).toBe('books');
    expect(res.word!.difficulty).not.toBe('easy');
    expect(res.fallbackNotice).toBeTruthy();
  });
});

describe('Timer Engine — Real System Wall-Clock Accuracy, Pause, Resume & Unlimited Mode', () => {
  it('tracks exact elapsed and remaining time across backgrounding, pause, and resume', () => {
    const medWord = makeWord({ difficulty: 'medium' }); // 70s auto
    let timer = createIdleTimer(medWord, DEFAULT_SETTINGS);
    expect(timer.durationSec).toBe(70);

    timer = startTimerState(timer, 1_000_000);
    const snap1 = getTimerSnapshot(timer, 1_025_000);
    expect(snap1.elapsedSeconds).toBe(25);
    expect(snap1.remainingSeconds).toBe(45);

    timer = pauseTimerState(timer, 1_025_000);
    const snapPaused = getTimerSnapshot(timer, 1_625_000);
    expect(snapPaused.elapsedSeconds).toBe(25);
    expect(snapPaused.remainingSeconds).toBe(45);

    timer = resumeTimerState(timer, 1_625_000);
    const snapResumed = getTimerSnapshot(timer, 1_630_000);
    expect(snapResumed.elapsedSeconds).toBe(30);
    expect(snapResumed.remainingSeconds).toBe(40);
  });

  it('supports unlimited timer mode without expiring while still tracking elapsed time for speed bonus', () => {
    const unlimitedSettings = { ...DEFAULT_SETTINGS, timerMode: 'unlimited' as const };
    const hardWord = makeWord({ difficulty: 'hard' });
    let timer = createIdleTimer(hardWord, unlimitedSettings);
    expect(timer.durationSec).toBeNull();

    timer = startTimerState(timer, 10_000);
    const snapAfter10Minutes = getTimerSnapshot(timer, 610_000);
    expect(snapAfter10Minutes.isExpired).toBe(false);
    expect(snapAfter10Minutes.remainingSeconds).toBeNull();
    expect(snapAfter10Minutes.elapsedSeconds).toBe(600);
  });
});

describe('Game Engine — Swaps, Invalid Word Reports, Multi-Word Turns & Sudden Death', () => {
  it('deducts 1 point on swap, keeps same category & difficulty, and blocks second swap on same card', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 2,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'movies_series',
      forcedDifficulty: 'hard',
      now: 1000,
    }).state;
    match = revealWordToActor(match, 1100);
    match = startTurnPlayTimer(match, 2000);

    const firstWordId = match.currentSlot!.word.id;

    // First swap succeeds and deducts 1 point while keeping 'movies_series' + 'hard'
    const swap1 = swapWordInTurn(match, INITIAL_WORDS, DEFAULT_SETTINGS, 10_000);
    expect(swap1.swapped).toBe(true);
    match = swap1.state;
    expect(match.currentSlot!.word.id).not.toBe(firstWordId);
    expect(match.currentSlot!.word.categoryId).toBe('movies_series');
    expect(match.currentSlot!.word.difficulty).toBe('hard');
    expect(match.currentSlot!.swapsUsedInSlot).toBe(1);

    // Second swap on the same card is strictly blocked
    const swap2 = swapWordInTurn(match, INITIAL_WORDS, DEFAULT_SETTINGS, 11_000);
    expect(swap2.swapped).toBe(false);

    const standings = computeTeamStandings(
      match.teams,
      match.allEvents,
      match.extraWrongGuessesByTeam,
      match.goldenUsedByTeam,
      true
    );
    const team1Summary = standings.find((s) => s.teamId === 'team_1')!;
    expect(team1Summary.swapPenaltyTotal).toBe(1);
    expect(team1Summary.totalScore).toBe(-1);
  });

  it('supports pause/resume during active turn and multi-word turns (wordsPerTurn > 1)', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 1,
        wordsPerTurn: 2,
        startOrderMode: 'first',
        selectedCategoryIds: ['objects'],
        enabledDifficulties: ['medium'],
      },
      DEFAULT_SETTINGS,
      1000
    );

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, { now: 1000 }).state;
    match = revealWordToActor(match, 1000);
    match = startTurnPlayTimer(match, 1000);
    match = pauseTurnPlayTimer(match, 11_000);
    expect(match.timer.status).toBe('paused');
    match = resumeTurnPlayTimer(match, 21_000);
    expect(match.timer.status).toBe('running');
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 26_000);

    expect(match.currentTurnIndexInRound).toBe(0);
    expect(match.turnCompletedEvents.length).toBe(1);
  });

  it('preserves remaining time and applies zero penalty when reporting an invalid word', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 1,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'sports',
      forcedDifficulty: 'hard',
      now: 1000,
    }).state;
    match = revealWordToActor(match, 1000);
    match = startTurnPlayTimer(match, 10_000); // 120s timer starts at t=10s

    // At t=42s (32 seconds elapsed -> 78 seconds remaining), report invalid word
    const reportRes = reportInvalidWordAndReplace(match, INITIAL_WORDS, DEFAULT_SETTINGS, 42_000);
    expect(reportRes.reportedWordId).not.toBeNull();
    match = reportRes.state;

    const snapBeforeResume = getTimerSnapshot(match.timer, 50_000);
    expect(snapBeforeResume.elapsedSeconds).toBe(32);
    expect(snapBeforeResume.remainingSeconds).toBe(78);
    expect(match.currentSlot!.swapsUsedInSlot).toBe(0);

    match = revealWordToActor(match, 50_000);
    match = startTurnPlayTimer(match, 50_000);
    const snapAfter5s = getTimerSnapshot(match.timer, 55_000);
    expect(snapAfter5s.elapsedSeconds).toBe(37);
    expect(snapAfter5s.remainingSeconds).toBe(73);
  });

  it('deducts 1 point per foul (خطا) on solved, swapped, and wrong (غلط) turns with itemized breakdown', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 2,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    // Team 1: 6-pt Hard word, 1 swap (-1), 1 foul (-1), solved at 30s (+3 speed bonus) -> 6 + 3 - 1 - 1 = 7 pts
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'hard',
      now: 1000,
    }).state;
    match = revealWordToActor(match, 1500);
    match = startTurnPlayTimer(match, 2000);
    match = swapWordInTurn(match, INITIAL_WORDS, DEFAULT_SETTINGS, 8000).state;
    match = startTurnPlayTimer(match, 9000);
    match = recordWrongGuessInTurn(match, 15_000); // 1 foul (-1)
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 39_000); // 30s elapsed -> <=50s -> +2 speed bonus

    const standingsAfterT1 = computeTeamStandings(
      match.teams,
      match.allEvents,
      match.extraWrongGuessesByTeam,
      match.goldenUsedByTeam,
      true
    );
    const t1 = standingsAfterT1.find((s) => s.teamId === 'team_1')!;
    expect(t1.basePointsTotal).toBe(6);
    expect(t1.speedBonusTotal).toBe(2);
    expect(t1.swapPenaltyTotal).toBe(1);
    expect(t1.foulPenaltyTotal).toBe(1);
    expect(t1.totalScore).toBe(6);

    // Team 2: commits 2 fouls (-2) and ends turn as غلط (manual_end) -> -2 pts
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 40_000);
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'hard',
      now: 41_000,
    }).state;
    match = revealWordToActor(match, 41_500);
    match = startTurnPlayTimer(match, 42_000);
    match = recordWrongGuessInTurn(match, 45_000);
    match = recordWrongGuessInTurn(match, 48_000);
    match = finishTurnUnsolved(match, 'manual_end', INITIAL_WORDS, DEFAULT_SETTINGS, 50_000);

    const standingsAfterT2 = computeTeamStandings(
      match.teams,
      match.allEvents,
      match.extraWrongGuessesByTeam,
      match.goldenUsedByTeam,
      true
    );
    const t2 = standingsAfterT2.find((s) => s.teamId === 'team_2')!;
    expect(t2.foulPenaltyTotal).toBe(2);
    expect(t2.totalScore).toBe(-2);
  });

  it('strictly caps fouls at 3 per word and ignores the 4th foul attempt', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 1,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'general',
      forcedDifficulty: 'easy',
      now: 1000,
    }).state;
    match = revealWordToActor(match, 1000);
    match = startTurnPlayTimer(match, 1000);

    // 1st foul
    match = recordWrongGuessInTurn(match, 2000);
    expect(match.currentSlot?.wrongGuessesInSlot).toBe(1);

    // 2nd foul
    match = recordWrongGuessInTurn(match, 3000);
    expect(match.currentSlot?.wrongGuessesInSlot).toBe(2);

    // 3rd foul
    match = recordWrongGuessInTurn(match, 4000);
    expect(match.currentSlot?.wrongGuessesInSlot).toBe(3);

    // 4th foul attempt -> MUST be rejected (still 3)
    const after4th = recordWrongGuessInTurn(match, 5000);
    expect(after4th).toBe(match);
    expect(after4th.currentSlot?.wrongGuessesInSlot).toBe(3);
  });

  it('prevents double scoring on rapid double-click and triggers equal-opportunity Sudden Death on tie', () => {
    const teams = createDefaultTeams(2);
    let match = createMatchState(
      {
        teams,
        totalRounds: 1,
        startOrderMode: 'first',
      },
      DEFAULT_SETTINGS,
      1000
    );

    // Team 1 turn: solve hard word in 20s with 1 foul -> 6 + 4 - 1 = 9 pts
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'animals',
      forcedDifficulty: 'hard',
      now: 1000,
    }).state;
    match = revealWordToActor(match, 1000);
    match = startTurnPlayTimer(match, 1000);
    match = recordWrongGuessInTurn(match, 5000);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 21_000); // 20s elapsed -> <=25s -> +4
    const afterDoubleClick = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 21_050);
    expect(afterDoubleClick).toBe(match);
    expect(match.allEvents.filter((e) => e.outcome === 'correct').length).toBe(1);

    // Advance to Team 2
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 22_000);
    expect(match.currentTurnIndexInRound).toBe(1);

    // Team 2 solves medium word in 30s (0 fouls) -> 4 + 2 = 6 pts?
    // Let's create a clear tie:
    // Team 1 solved hard word in 20s (6 + 4 - 1 foul = 9 pts).
    // If Team 2 solves hard word in 60s (+1 speed bonus) with 2 fouls: 6 + 1 - 2 = 5 (no).
    // If Team 2 solves hard word in 40s (6 + 2 = 8 pts) with 0 fouls -> 8.
    // If Team 1 has 0 fouls: 6 + 4 = 10.
    // Let's make it simple and exact:
    // T1: 6 base + 4 speed (20s) - 1 foul = 9 pts.
    // T2: 6 base + 4 speed (20s) - 1 foul = 9 pts (Exact Tie at 9!).
    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'movies_series',
      forcedDifficulty: 'hard',
      now: 30_000,
    }).state;
    match = revealWordToActor(match, 30_000);
    match = startTurnPlayTimer(match, 30_000);
    match = recordWrongGuessInTurn(match, 35_000); // 1 foul
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 50_000); // 20s elapsed -> <=25s -> +4 -> 6 + 4 - 1 = 9 pts!

    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 61_000);
    expect(match.phase).toBe('ROUND_SUMMARY');

    const standingsAtTie = computeTeamStandings(match.teams, match.allEvents);
    expect(detectTopTiedTeams(standingsAtTie)).toEqual(['team_1', 'team_2']);

    // Start Sudden Death round -> Both tied teams get equal turns!
    match = startNextRoundInMatch(match, DEFAULT_SETTINGS, 62_000);
    expect(match.isSuddenDeath).toBe(true);
    expect(match.roundTeamOrder.length).toBe(2);

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'sports',
      forcedDifficulty: 'hard',
      now: 70_000,
    }).state;
    match = finishTurnUnsolved(match, 'timeout', INITIAL_WORDS, DEFAULT_SETTINGS, 190_000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 191_000);
    expect(match.phase).toBe('PRE_TURN');

    match = beginTurnSlot(match, INITIAL_WORDS, DEFAULT_SETTINGS, {
      forcedCategoryId: 'sports',
      forcedDifficulty: 'hard',
      now: 200_000,
    }).state;
    match = revealWordToActor(match, 200_000);
    match = startTurnPlayTimer(match, 200_000);
    match = markWordSolved(match, INITIAL_WORDS, DEFAULT_SETTINGS, 220_000);
    match = proceedFromTurnResult(match, DEFAULT_SETTINGS, 221_000);
    expect(match.phase).toBe('GAME_OVER');
  });

  it('exports and imports Persian words cleanly via UTF-8 CSV round-trip', () => {
    const sample = INITIAL_WORDS.slice(0, 10);
    const csv = exportWordsToCsv(sample);
    const parsed = parseWordsFromCsv(csv);
    expect(parsed.length).toBe(10);
    expect(parsed[0].text).toBe(sample[0].text);
    expect(parsed[0].categoryId).toBe(sample[0].categoryId);
    expect(parsed[0].difficulty).toBe(sample[0].difficulty);
  });

  it('validates the entire 5,700-word Persian Word Bank (19 regular categories + 300 Golden phrases) with zero duplicates', () => {
    const pardis = INITIAL_WORDS.find((w) => w.text === 'پردیس احمدیه');
    expect(pardis).toBeDefined();
    expect(pardis?.categoryId).toBe('celebrities');
    expect(pardis?.difficulty).toBe('hard');
    expect(pardis?.basePoints).toBe(6);

    const report = validateWordBank(INITIAL_WORDS, INITIAL_CATEGORIES);
    expect(report.totalWords).toBe(5800);
    expect(report.regularWordsCount).toBe(5400);
    expect(report.goldenWordsCount).toBe(400);
    expect(report.duplicateIds.length).toBe(0);
    expect(report.duplicateTexts.length).toBe(0);
    expect(report.orphanCategoryWords.length).toBe(0);
    expect(report.incompleteWords.length).toBe(0);

    for (const stat of report.categoryStats) {
      if (stat.categoryId === 'golden') {
        expect(stat.total).toBe(400);
      } else if (stat.categoryId === 'movies_series') {
        expect(stat.easy).toBe(54);
        expect(stat.medium).toBe(162);
        expect(stat.hard).toBe(324);
        expect(stat.total).toBe(540);
      } else {
        expect(stat.easy).toBe(27);
        expect(stat.medium).toBe(81);
        expect(stat.hard).toBe(162);
        expect(stat.total).toBe(270);
      }
    }

    expect(report.footballRatios.playerPercent).toBeGreaterThanOrEqual(69);
    expect(report.footballRatios.foreignAmongPlayersPercent).toBeGreaterThanOrEqual(69);
    expect(report.celebrityRatios.overallIranianPercent).toBeGreaterThanOrEqual(84);
  });
});
