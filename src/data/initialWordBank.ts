import {
  CategoryItem,
  CategoryValidationStat,
  Difficulty,
  ValidationReport,
  WordItem,
} from '../types/game';
import { normalizePersianText } from '../utils/format';
import { GOLDEN_CATEGORY_META, INITIAL_CATEGORIES } from './categories';
import { RegularCategoryId, WORD_DB } from './wordDB';
import { buildCategoryWords, buildGoldenWords } from './wordFactory';

export const INITIAL_WORDS: WordItem[] = [
  ...INITIAL_CATEGORIES.flatMap((cat) =>
    buildCategoryWords(
      cat.id,
      cat.isProverb ? 'proverb' : 'regular',
      WORD_DB[cat.id as RegularCategoryId]
    )
  ),
  ...buildGoldenWords(WORD_DB.golden),
];

/**
 * Automatic deterministic fingerprint of INITIAL_WORDS.
 * Whenever any word is added, edited, or removed in `wordDB.ts`, this signature
 * updates automatically so IndexedDB syncs on reload without touching any other file.
 */
function computeWordBankSignature(words: WordItem[]): string {
  let hash = 2166136261;
  for (const w of words) {
    const str = `${w.id}|${w.text}|${w.basePoints}`;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `v2_${words.length}_${(hash >>> 0).toString(16)}`;
}

export const WORD_BANK_SIGNATURE = computeWordBankSignature(INITIAL_WORDS);

const VALID_DIFFICULTIES = new Set<Difficulty>(['easy', 'medium', 'hard']);

export function validateWordBank(
  words: WordItem[],
  categories: CategoryItem[] = INITIAL_CATEGORIES
): ValidationReport {
  const allCategories = [...categories, GOLDEN_CATEGORY_META];
  const validCatIds = new Set(allCategories.map((c) => c.id));

  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];

  const textMap = new Map<string, Array<{ id: string; text: string; categoryId: string }>>();
  const orphanCategoryWords: string[] = [];
  const invalidDifficultyWords: string[] = [];
  const incompleteWords: string[] = [];
  const needsHumanReview: Array<{ id: string; text: string; reason: string }> = [];

  for (const w of words) {
    if (seenIds.has(w.id)) {
      duplicateIds.push(w.id);
    }
    seenIds.add(w.id);

    if (!validCatIds.has(w.categoryId)) {
      orphanCategoryWords.push(w.id);
    }

    if (!VALID_DIFFICULTIES.has(w.difficulty)) {
      invalidDifficultyWords.push(w.id);
    }

    if (
      !w.text ||
      !w.text.trim() ||
      typeof w.basePoints !== 'number' ||
      w.basePoints <= 0 ||
      typeof w.defaultTimeSec !== 'number' ||
      w.defaultTimeSec <= 0
    ) {
      incompleteWords.push(w.id || '(بدون شناسه)');
    }

    const norm = normalizePersianText(w.text);
    const list = textMap.get(norm) ?? [];
    list.push({ id: w.id, text: w.text, categoryId: w.categoryId });
    textMap.set(norm, list);

    if (w.status === 'reported' || w.status === 'invalid') {
      needsHumanReview.push({
        id: w.id,
        text: w.text,
        reason: w.status === 'reported' ? 'گزارش‌شده توسط بازیکنان در حین بازی' : 'علامت‌گذاری نامعتبر',
      });
    } else if (w.text.trim().length < 2) {
      needsHumanReview.push({
        id: w.id,
        text: w.text,
        reason: 'طول عبارت کوتاه‌تر از حد استاندارد است',
      });
    }
  }

  const duplicateTexts = Array.from(textMap.entries())
    .filter(([, arr]) => arr.length > 1)
    .map(([normalized, items]) => ({ normalized, items }));

  const categoryStats: CategoryValidationStat[] = allCategories.map((cat) => {
    const catWords = words.filter((w) => w.categoryId === cat.id);
    const easy = catWords.filter((w) => w.difficulty === 'easy').length;
    const medium = catWords.filter((w) => w.difficulty === 'medium').length;
    const hard = catWords.filter((w) => w.difficulty === 'hard').length;
    const validCount = catWords.filter((w) => w.status === 'valid').length;
    const reportedCount = catWords.filter((w) => w.status !== 'valid').length;
    const iranianCount = catWords.filter((w) => w.origin === 'iranian').length;
    const foreignCount = catWords.filter((w) => w.origin === 'foreign').length;
    const playerCount = catWords.filter((w) => w.footballSubType === 'player').length;
    const otherFootballCount = catWords.filter((w) => w.footballSubType === 'other').length;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      easy,
      medium,
      hard,
      total: catWords.length,
      validCount,
      reportedCount,
      iranianCount,
      foreignCount,
      playerCount,
      otherFootballCount,
    };
  });

  // Football ratio calculation
  const fbWords = words.filter((w) => w.categoryId === 'football');
  const fbPlayers = fbWords.filter((w) => w.footballSubType === 'player');
  const fbOther = fbWords.filter((w) => w.footballSubType === 'other');
  const fbForeignPlayers = fbPlayers.filter((w) => w.origin === 'foreign');
  const fbIranianPlayers = fbPlayers.filter((w) => w.origin === 'iranian');

  const footballRatios = {
    playerPercent: fbWords.length ? Math.round((fbPlayers.length / fbWords.length) * 1000) / 10 : 0,
    otherPercent: fbWords.length ? Math.round((fbOther.length / fbWords.length) * 1000) / 10 : 0,
    foreignAmongPlayersPercent: fbPlayers.length
      ? Math.round((fbForeignPlayers.length / fbPlayers.length) * 1000) / 10
      : 0,
    iranianAmongPlayersPercent: fbPlayers.length
      ? Math.round((fbIranianPlayers.length / fbPlayers.length) * 1000) / 10
      : 0,
  };

  // Celebrity ratio calculation
  const celebWords = words.filter((w) => w.categoryId === 'celebrities');
  const celebIranian = celebWords.filter((w) => w.origin === 'iranian');
  const celebForeign = celebWords.filter((w) => w.origin === 'foreign');

  const calcLevelIranian = (diff: Difficulty) => {
    const subset = celebWords.filter((w) => w.difficulty === diff);
    const ir = subset.filter((w) => w.origin === 'iranian').length;
    return {
      iranianPercent: subset.length ? Math.round((ir / subset.length) * 1000) / 10 : 0,
      total: subset.length,
    };
  };

  const celebrityRatios = {
    overallIranianPercent: celebWords.length
      ? Math.round((celebIranian.length / celebWords.length) * 1000) / 10
      : 0,
    overallForeignPercent: celebWords.length
      ? Math.round((celebForeign.length / celebWords.length) * 1000) / 10
      : 0,
    byDifficulty: {
      easy: calcLevelIranian('easy'),
      medium: calcLevelIranian('medium'),
      hard: calcLevelIranian('hard'),
    },
  };

  const goldenWordsCount = words.filter((w) => w.categoryId === 'golden').length;

  return {
    totalWords: words.length,
    regularWordsCount: words.length - goldenWordsCount,
    goldenWordsCount,
    duplicateTexts,
    duplicateIds,
    orphanCategoryWords,
    invalidDifficultyWords,
    incompleteWords,
    needsHumanReview,
    categoryStats,
    footballRatios,
    celebrityRatios,
  };
}
