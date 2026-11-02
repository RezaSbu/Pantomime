import {
  Difficulty,
  FootballSubType,
  WordItem,
  WordKind,
  WordOrigin,
} from '../types/game';

export interface RawWordSeed {
  text: string;
  origin?: WordOrigin;
  footballSubType?: FootballSubType;
  tags?: string[];
  alt?: string[];
}

export type CompactWordInput = string | RawWordSeed;

const REGULAR_META: Record<
  Difficulty,
  { basePoints: number; defaultTimeSec: number; speedBonusThresholdSec: number; speedBonusPoints: number }
> = {
  easy: { basePoints: 2, defaultTimeSec: 45, speedBonusThresholdSec: 15, speedBonusPoints: 2 },
  medium: { basePoints: 4, defaultTimeSec: 75, speedBonusThresholdSec: 30, speedBonusPoints: 3 },
  hard: { basePoints: 6, defaultTimeSec: 120, speedBonusThresholdSec: 45, speedBonusPoints: 4 },
};

const PROVERB_META: Record<
  Difficulty,
  { basePoints: number; defaultTimeSec: number; speedBonusThresholdSec: number; speedBonusPoints: number }
> = {
  easy: { basePoints: 5, defaultTimeSec: 90, speedBonusThresholdSec: 20, speedBonusPoints: 2 },
  medium: { basePoints: 8, defaultTimeSec: 120, speedBonusThresholdSec: 40, speedBonusPoints: 3 },
  hard: { basePoints: 10, defaultTimeSec: 150, speedBonusThresholdSec: 60, speedBonusPoints: 5 },
};

export function buildCategoryWords(
  categoryId: string,
  kind: Exclude<WordKind, 'golden'>,
  seeds: Record<Difficulty, CompactWordInput[]>
): WordItem[] {
  const result: WordItem[] = [];
  const metaTable = kind === 'proverb' ? PROVERB_META : REGULAR_META;
  const levels: Difficulty[] = ['easy', 'medium', 'hard'];

  for (const difficulty of levels) {
    const list = seeds[difficulty];
    const meta = metaTable[difficulty];
    list.forEach((entry, idx) => {
      const normalizedEntry: RawWordSeed =
        typeof entry === 'string' ? { text: entry } : entry;
      const id = `${categoryId}_${difficulty}_${String(idx + 1).padStart(3, '0')}`;
      result.push({
        id,
        text: normalizedEntry.text.trim(),
        categoryId,
        difficulty,
        kind,
        basePoints: meta.basePoints,
        defaultTimeSec: meta.defaultTimeSec,
        speedBonusThresholdSec: meta.speedBonusThresholdSec,
        speedBonusPoints: meta.speedBonusPoints,
        status: 'valid',
        origin: normalizedEntry.origin ?? 'neutral',
        footballSubType: normalizedEntry.footballSubType,
        tags: normalizedEntry.tags ?? [],
        alternatives: normalizedEntry.alt ?? [],
      });
    });
  }

  return result;
}

export function buildGoldenWords(entries: CompactWordInput[]): WordItem[] {
  return entries.map((entry, idx) => {
    const normalizedEntry: RawWordSeed =
      typeof entry === 'string' ? { text: entry } : entry;
    return {
      id: `golden_hard_${String(idx + 1).padStart(3, '0')}`,
      text: normalizedEntry.text.trim(),
      categoryId: 'golden',
      difficulty: 'hard',
      kind: 'golden',
      basePoints: 30,
      defaultTimeSec: 240,
      speedBonusThresholdSec: 60,
      speedBonusPoints: 10,
      status: 'valid',
      origin: normalizedEntry.origin ?? 'neutral',
      tags: normalizedEntry.tags ?? ['چالش طلایی'],
      alternatives: normalizedEntry.alt ?? [],
    };
  });
}
