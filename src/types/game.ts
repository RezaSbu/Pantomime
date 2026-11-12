export type Difficulty = 'easy' | 'medium' | 'hard';

export type WordKind = 'regular' | 'proverb' | 'golden';

export type WordStatus = 'valid' | 'reported' | 'invalid';

export type WordOrigin = 'iranian' | 'foreign' | 'neutral';

export type FootballSubType = 'player' | 'other';

export interface WordItem {
  id: string;
  text: string;
  categoryId: string;
  difficulty: Difficulty;
  kind: WordKind;
  basePoints: number;
  defaultTimeSec: number;
  speedBonusThresholdSec: number;
  speedBonusPoints: number;
  status: WordStatus;
  origin?: WordOrigin;
  footballSubType?: FootballSubType;
  tags: string[];
  alternatives: string[];
  isCustom?: boolean;
  reportedAt?: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  isProverb?: boolean;
  isCustom?: boolean;
  enabledByDefault: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type StartOrderMode = 'first' | 'random' | 'manual';

export type TimerMode = 'auto' | 'manual' | 'unlimited';

export interface SpeedBonusRule {
  thresholdSec: number;
  bonus: number;
}

export interface AppSettings {
  timerMode: TimerMode;
  regularTimeSec: Record<Difficulty, number>;
  proverbTimeSec: Record<Difficulty, number>;
  goldenTimeSec: number;
  regularBasePoints: Record<Difficulty, number>;
  proverbBasePoints: Record<Difficulty, number>;
  goldenBasePoints: number;
  regularSpeedBonus: Record<Difficulty, SpeedBonusRule[]>;
  proverbSpeedBonus: Record<Difficulty, SpeedBonusRule[]>;
  goldenSpeedBonusTiers: SpeedBonusRule[];
  swapPenalty: number;
  foulPenalty: number;
  maxSwapsPerCard: number;
  difficultyWeights: Record<Difficulty, number>;
  goldenEnabled: boolean;
  goldenOpportunitiesPerTeam: number;
  disabledCategoryIds: string[];
  footballPlayerRatio: number;
  footballForeignPlayerRatio: number;
  celebrityIranianRatio: number;
  soundEnabled: boolean;
  tickSoundEnabled: boolean;
  vibrationEnabled: boolean;
  tiltControlsEnabled: boolean;
  theme: 'light' | 'dark';
  persianDigits: boolean;
  allowRepeatWords: boolean;
  allowNegativeScore: boolean;
}

export interface GameSetupConfig {
  teams: Team[];
  totalRounds: number;
  wordsPerTurn?: number;
  startOrderMode: StartOrderMode;
  manualStartTeamId?: string;
  selectedCategoryIds?: string[];
  enabledDifficulties?: Difficulty[];
  goldenEnabled?: boolean;
}

export interface TimerState {
  mode: TimerMode;
  status: 'idle' | 'running' | 'paused' | 'finished';
  durationSec: number | null;
  startedAtTimestamp: number | null;
  accumulatedElapsedMs: number;
}

export type TurnPhase =
  | 'PRE_TURN'
  | 'CONCEALED'
  | 'PLAYING'
  | 'PAUSED'
  | 'TIME_UP'
  | 'TURN_RESULT'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export interface ScoreEvent {
  id: string;
  timestamp: number;
  roundNumber: number;
  turnIndexInRound: number;
  wordSlotIndex: number;
  isSuddenDeath: boolean;
  teamId: string;
  wordId: string;
  wordText: string;
  categoryId: string;
  difficulty: Difficulty;
  kind: WordKind;
  outcome: 'correct' | 'swap' | 'timeout' | 'manual_end' | 'invalid_report';
  elapsedSeconds: number;
  basePoints: number;
  speedBonus: number;
  swapPenalty: number;
  foulPenalty: number;
  netPoints: number;
  wrongGuessesInSlot: number;
  isRisk20?: boolean;
}

export interface TeamScoreSummary {
  teamId: string;
  teamName: string;
  color: string;
  icon: string;
  rawTotal: number;
  totalScore: number;
  basePointsTotal: number;
  speedBonusTotal: number;
  swapPenaltyTotal: number;
  foulPenaltyTotal: number;
  correctCount: number;
  wrongGuessesCount: number;
  swapsCount: number;
  goldenUsedCount: number;
}

export interface ActiveTurnSlot {
  slotIndex: number;
  word: WordItem;
  isWordRevealedToActor: boolean;
  isWordHiddenDuringPlay: boolean;
  swapsUsedInSlot: number;
  wrongGuessesInSlot: number;
  isScored: boolean;
  fallbackNotice?: string;
  isRisk20Active?: boolean;
}

export interface ActiveMatchState {
  id: string;
  createdAt: number;
  updatedAt: number;
  teams: Team[];
  totalRounds: number;
  wordsPerTurn: number;
  initialStartIndex: number;
  selectedCategoryIds: string[];
  enabledDifficulties: Difficulty[];
  goldenEnabled: boolean;
  goldenOpportunitiesPerTeam: number;
  currentRound: number;
  currentTurnIndexInRound: number;
  roundTeamOrder: string[];
  isSuddenDeath: boolean;
  suddenDeathRound: number;
  suddenDeathTeamIds: string[];
  phase: TurnPhase;
  currentSlot: ActiveTurnSlot | null;
  turnCompletedEvents: ScoreEvent[];
  allEvents: ScoreEvent[];
  extraWrongGuessesByTeam: Record<string, number>;
  goldenUsedByTeam: Record<string, number>;
  risk20UsedByTeam: Record<string, number>;
  /**
   * Per-team locked (categoryId:difficulty) combinations so a team cannot pick
   * the same category+difficulty twice in the same match.
   */
  usedCombosByTeam: Record<string, string[]>;
  usedWordIds: string[];
  categoryUsageCount: Record<string, number>;
  lastCategoryId: string | null;
  lastSimilarityTag: string | null;
  timer: TimerState;
}

export interface CompletedMatch {
  id: string;
  startedAt: number;
  finishedAt: number;
  totalRoundsPlayed: number;
  hadSuddenDeath: boolean;
  teams: Team[];
  standings: TeamScoreSummary[];
  winnerTeamId: string;
  events: ScoreEvent[];
  selectedCategoryIds: string[];
}

export type AppRoute = 'home' | 'game' | 'history';

export interface CategoryValidationStat {
  categoryId: string;
  categoryName: string;
  easy: number;
  medium: number;
  hard: number;
  total: number;
  validCount: number;
  reportedCount: number;
  iranianCount: number;
  foreignCount: number;
  playerCount: number;
  otherFootballCount: number;
}

export interface ValidationReport {
  totalWords: number;
  regularWordsCount: number;
  goldenWordsCount: number;
  duplicateTexts: Array<{
    normalized: string;
    items: Array<{ id: string; text: string; categoryId: string }>;
  }>;
  duplicateIds: string[];
  orphanCategoryWords: string[];
  invalidDifficultyWords: string[];
  incompleteWords: string[];
  needsHumanReview: Array<{ id: string; text: string; reason: string }>;
  categoryStats: CategoryValidationStat[];
  footballRatios: {
    playerPercent: number;
    otherPercent: number;
    foreignAmongPlayersPercent: number;
    iranianAmongPlayersPercent: number;
  };
  celebrityRatios: {
    overallIranianPercent: number;
    overallForeignPercent: number;
    byDifficulty: Record<Difficulty, { iranianPercent: number; total: number }>;
  };
}
