import { AppSettings, Difficulty, SpeedBonusRule } from '../types/game';

const SETTINGS_STORAGE_KEY = 'adabazi_settings_v4';
const LAST_TEAMS_STORAGE_KEY = 'adabazi_last_teams_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  timerMode: 'auto',
  regularTimeSec: {
    easy: 35,
    medium: 70,
    hard: 110,
  },
  proverbTimeSec: {
    easy: 80,
    medium: 100,
    hard: 120,
  },
  goldenTimeSec: 170,
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
      { thresholdSec: 10, bonus: 2 },
      { thresholdSec: 20, bonus: 1 },
    ],
    medium: [
      { thresholdSec: 18, bonus: 3 },
      { thresholdSec: 35, bonus: 2 },
      { thresholdSec: 50, bonus: 1 },
    ],
    hard: [
      { thresholdSec: 25, bonus: 4 },
      { thresholdSec: 50, bonus: 2 },
      { thresholdSec: 75, bonus: 1 },
    ],
  },
  proverbSpeedBonus: {
    easy: [
      { thresholdSec: 25, bonus: 3 },
      { thresholdSec: 50, bonus: 1 },
    ],
    medium: [
      { thresholdSec: 30, bonus: 4 },
      { thresholdSec: 60, bonus: 2 },
    ],
    hard: [
      { thresholdSec: 35, bonus: 5 },
      { thresholdSec: 65, bonus: 3 },
      { thresholdSec: 90, bonus: 1 },
    ],
  },
  goldenSpeedBonusTiers: [
    { thresholdSec: 45, bonus: 10 },
    { thresholdSec: 90, bonus: 6 },
    { thresholdSec: 130, bonus: 3 },
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
    // Check v4 key first, then fallback to v3/v2 for seamless upgrade
    let raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    let isLegacy = false;
    if (!raw) {
      raw = window.localStorage.getItem('adabazi_settings_v3') || window.localStorage.getItem('adabazi_settings_v2');
      isLegacy = true;
    }
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    // If legacy or obsolete timing detected, adopt the new optimized defaults
    const regTimeCandidate = parsed.regularTimeSec ?? DEFAULT_SETTINGS.regularTimeSec;
    const isOldRegularTimes =
      regTimeCandidate.easy === 45 ||
      regTimeCandidate.medium === 75 ||
      regTimeCandidate.hard === 120;

    const prvTimeCandidate = parsed.proverbTimeSec ?? DEFAULT_SETTINGS.proverbTimeSec;
    const isOldProverbTimes =
      prvTimeCandidate.easy === 90 ||
      prvTimeCandidate.medium === 120 ||
      prvTimeCandidate.hard === 135 ||
      prvTimeCandidate.hard === 150;

    const isOldGoldenTime = parsed.goldenTimeSec === 210 || parsed.goldenTimeSec === 240;

    const upgraded: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      regularTimeSec: isOldRegularTimes
        ? DEFAULT_SETTINGS.regularTimeSec
        : { ...DEFAULT_SETTINGS.regularTimeSec, ...parsed.regularTimeSec },
      proverbTimeSec: isOldProverbTimes
        ? DEFAULT_SETTINGS.proverbTimeSec
        : { ...DEFAULT_SETTINGS.proverbTimeSec, ...parsed.proverbTimeSec },
      goldenTimeSec: isOldGoldenTime ? DEFAULT_SETTINGS.goldenTimeSec : (parsed.goldenTimeSec ?? DEFAULT_SETTINGS.goldenTimeSec),
      regularBasePoints: { ...DEFAULT_SETTINGS.regularBasePoints, ...parsed.regularBasePoints },
      proverbBasePoints: { ...DEFAULT_SETTINGS.proverbBasePoints, ...parsed.proverbBasePoints },
      regularSpeedBonus: isOldRegularTimes || isLegacy
        ? DEFAULT_SETTINGS.regularSpeedBonus
        : normalizeTierRecord(DEFAULT_SETTINGS.regularSpeedBonus, parsed.regularSpeedBonus),
      proverbSpeedBonus: isOldProverbTimes || isLegacy
        ? DEFAULT_SETTINGS.proverbSpeedBonus
        : normalizeTierRecord(DEFAULT_SETTINGS.proverbSpeedBonus, parsed.proverbSpeedBonus),
      goldenSpeedBonusTiers: isOldGoldenTime || isLegacy
        ? DEFAULT_SETTINGS.goldenSpeedBonusTiers
        : Array.isArray(parsed.goldenSpeedBonusTiers) && parsed.goldenSpeedBonusTiers.length > 0
        ? parsed.goldenSpeedBonusTiers
        : DEFAULT_SETTINGS.goldenSpeedBonusTiers,
      foulPenalty:
        typeof parsed.foulPenalty === 'number' ? parsed.foulPenalty : DEFAULT_SETTINGS.foulPenalty,
      difficultyWeights: { ...DEFAULT_SETTINGS.difficultyWeights, ...parsed.difficultyWeights },
    };

    if (isLegacy) {
      saveSettings(upgraded);
      try {
        window.localStorage.removeItem('adabazi_settings_v2');
      } catch {}
    }

    return upgraded;
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
