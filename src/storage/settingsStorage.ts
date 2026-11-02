import { AppSettings, Difficulty, SpeedBonusRule } from '../types/game';

const SETTINGS_STORAGE_KEY = 'adabazi_settings_v2';
const LAST_TEAMS_STORAGE_KEY = 'adabazi_last_teams_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  timerMode: 'auto',
  regularTimeSec: {
    easy: 45,
    medium: 75,
    hard: 120,
  },
  proverbTimeSec: {
    easy: 90,
    medium: 120,
    hard: 150,
  },
  goldenTimeSec: 240,
  regularBasePoints: {
    easy: 2,
    medium: 4,
    hard: 6,
  },
  proverbBasePoints: {
    easy: 5,
    medium: 8,
    hard: 10,
  },
  goldenBasePoints: 30,
  regularSpeedBonus: {
    easy: [
      { thresholdSec: 12, bonus: 2 },
      { thresholdSec: 24, bonus: 1 },
    ],
    medium: [
      { thresholdSec: 15, bonus: 3 },
      { thresholdSec: 28, bonus: 2 },
      { thresholdSec: 40, bonus: 1 },
    ],
    hard: [
      { thresholdSec: 20, bonus: 4 },
      { thresholdSec: 35, bonus: 3 },
      { thresholdSec: 50, bonus: 2 },
      { thresholdSec: 65, bonus: 1 },
    ],
  },
  proverbSpeedBonus: {
    easy: [
      { thresholdSec: 20, bonus: 3 },
      { thresholdSec: 35, bonus: 2 },
      { thresholdSec: 50, bonus: 1 },
    ],
    medium: [
      { thresholdSec: 25, bonus: 4 },
      { thresholdSec: 40, bonus: 3 },
      { thresholdSec: 55, bonus: 2 },
      { thresholdSec: 70, bonus: 1 },
    ],
    hard: [
      { thresholdSec: 30, bonus: 5 },
      { thresholdSec: 45, bonus: 4 },
      { thresholdSec: 60, bonus: 3 },
      { thresholdSec: 80, bonus: 2 },
      { thresholdSec: 95, bonus: 1 },
    ],
  },
  goldenSpeedBonusTiers: [
    { thresholdSec: 45, bonus: 10 },
    { thresholdSec: 80, bonus: 7 },
    { thresholdSec: 115, bonus: 5 },
    { thresholdSec: 150, bonus: 3 },
  ],
  swapPenalty: 1,
  foulPenalty: 1,
  maxSwapsPerCard: 1,
  difficultyWeights: {
    easy: 10,
    medium: 30,
    hard: 60,
  },
  goldenEnabled: true,
  goldenOpportunitiesPerTeam: 1,
  disabledCategoryIds: [],
  footballPlayerRatio: 70,
  footballForeignPlayerRatio: 70,
  celebrityIranianRatio: 85,
  soundEnabled: true,
  tickSoundEnabled: true,
  vibrationEnabled: true,
  tiltControlsEnabled: false,
  theme: 'dark',
  persianDigits: true,
  allowRepeatWords: false,
  allowNegativeScore: true,
};

function normalizeTierRecord(
  fallback: Record<Difficulty, SpeedBonusRule[]>,
  candidate?: Partial<Record<Difficulty, SpeedBonusRule[] | SpeedBonusRule>>
): Record<Difficulty, SpeedBonusRule[]> {
  if (!candidate) return fallback;
  const result: Record<Difficulty, SpeedBonusRule[]> = {
    easy: fallback.easy,
    medium: fallback.medium,
    hard: fallback.hard,
  };
  (['easy', 'medium', 'hard'] as Difficulty[]).forEach((diff) => {
    const val = candidate[diff];
    if (Array.isArray(val) && val.length > 0) {
      result[diff] = val;
    }
  });
  return result;
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      regularTimeSec: { ...DEFAULT_SETTINGS.regularTimeSec, ...parsed.regularTimeSec },
      proverbTimeSec: { ...DEFAULT_SETTINGS.proverbTimeSec, ...parsed.proverbTimeSec },
      regularBasePoints: { ...DEFAULT_SETTINGS.regularBasePoints, ...parsed.regularBasePoints },
      proverbBasePoints: { ...DEFAULT_SETTINGS.proverbBasePoints, ...parsed.proverbBasePoints },
      regularSpeedBonus: normalizeTierRecord(
        DEFAULT_SETTINGS.regularSpeedBonus,
        parsed.regularSpeedBonus
      ),
      proverbSpeedBonus: normalizeTierRecord(
        DEFAULT_SETTINGS.proverbSpeedBonus,
        parsed.proverbSpeedBonus
      ),
      goldenSpeedBonusTiers:
        Array.isArray(parsed.goldenSpeedBonusTiers) && parsed.goldenSpeedBonusTiers.length > 0
          ? parsed.goldenSpeedBonusTiers
          : DEFAULT_SETTINGS.goldenSpeedBonusTiers,
      foulPenalty:
        typeof parsed.foulPenalty === 'number' ? parsed.foulPenalty : DEFAULT_SETTINGS.foulPenalty,
      difficultyWeights: { ...DEFAULT_SETTINGS.difficultyWeights, ...parsed.difficultyWeights },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

export function applyThemeToDocument(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function saveLastTeamsPreset(teamsJson: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_TEAMS_STORAGE_KEY, teamsJson);
  } catch {
    // Ignore
  }
}

export function loadLastTeamsPreset(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LAST_TEAMS_STORAGE_KEY);
  } catch {
    return null;
  }
}
