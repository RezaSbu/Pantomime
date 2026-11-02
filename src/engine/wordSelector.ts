import { AppSettings, Difficulty, WordItem } from '../types/game';
import { difficultyLabel } from '../utils/format';

export interface WordSelectionResult {
  word: WordItem | null;
  fallbackNotice?: string;
  exhaustedAll?: boolean;
}

function weightedPick<T>(
  items: T[],
  getWeight: (item: T) => number,
  rng: () => number = Math.random
): T | null {
  if (items.length === 0) return null;
  const weights = items.map((it) => Math.max(0, getWeight(it)));
  const total = weights.reduce((acc, w) => acc + w, 0);
  if (total <= 0) {
    return items[Math.floor(rng() * items.length) % items.length];
  }
  let threshold = rng() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

/**
 * Selects difficulty strictly according to configured percentages (default: 60% Hard, 30% Medium, 10% Easy),
 * completely independent of the number of words stored in each level of the database.
 */
export function selectDifficultyByWeight(
  enabledDifficulties: Difficulty[],
  weights: Record<Difficulty, number>,
  rng: () => number = Math.random
): Difficulty {
  const valid: Difficulty[] =
    enabledDifficulties.length > 0 ? enabledDifficulties : ['easy', 'medium', 'hard'];
  return weightedPick(valid, (d) => Math.max(0, weights[d] ?? 0), rng) ?? valid[0];
}

function computeContentCandidateWeight(
  word: WordItem,
  settings: AppSettings,
  lastSimilarityTag: string | null
): number {
  let weight = 1;

  // Anti-similarity penalty for consecutive similar tags
  if (lastSimilarityTag && word.tags.includes(lastSimilarityTag)) {
    weight *= 0.2;
  }

  // Football target ratio weighting (player vs other, foreign vs Iranian player)
  if (word.categoryId === 'football') {
    const pRatio = Math.max(5, Math.min(95, settings.footballPlayerRatio)) / 100;
    const fRatio = Math.max(5, Math.min(95, settings.footballForeignPlayerRatio)) / 100;
    if (word.footballSubType === 'player') {
      weight *= pRatio;
      if (word.origin === 'foreign') {
        weight *= fRatio;
      } else if (word.origin === 'iranian') {
        weight *= 1 - fRatio;
      }
    } else {
      weight *= 1 - pRatio;
    }
  }

  // Celebrity target ratio weighting (Iranian vs foreign)
  if (word.categoryId === 'celebrities') {
    const irRatio = Math.max(5, Math.min(95, settings.celebrityIranianRatio)) / 100;
    if (word.origin === 'iranian') {
      weight *= irRatio;
    } else if (word.origin === 'foreign') {
      weight *= 1 - irRatio;
    }
  }

  return weight;
}

export interface SelectRegularWordParams {
  wordBank: WordItem[];
  selectedCategoryIds: string[];
  enabledDifficulties: Difficulty[];
  usedWordIds: Set<string>;
  categoryUsageCount: Record<string, number>;
  lastCategoryId: string | null;
  lastSimilarityTag: string | null;
  settings: AppSettings;
  forcedDifficulty?: Difficulty;
  forcedCategoryId?: string;
  rng?: () => number;
}

/**
 * Selects the next regular/proverb word while respecting:
 * 1. Exact difficulty weights (60/30/10)
 * 2. Balanced category usage (independent of category bank size)
 * 3. Category content ratios (Football & Celebrities)
 * 4. Zero repetition in match (unless allowRepeatWords is enabled after exhaustion)
 * 5. Explicit fallback notice if a difficulty level runs out of words
 */
export function selectNextRegularWord(params: SelectRegularWordParams): WordSelectionResult {
  const {
    wordBank,
    selectedCategoryIds,
    enabledDifficulties,
    usedWordIds,
    categoryUsageCount,
    lastCategoryId,
    lastSimilarityTag,
    settings,
    forcedDifficulty,
    forcedCategoryId,
    rng = Math.random,
  } = params;

  const activeCatSet = new Set(
    forcedCategoryId ? [forcedCategoryId] : selectedCategoryIds
  );

  const isEligible = (w: WordItem, ignoreUsed: boolean) =>
    w.kind !== 'golden' &&
    w.status === 'valid' &&
    activeCatSet.has(w.categoryId) &&
    (ignoreUsed || !usedWordIds.has(w.id));

  let usablePool = wordBank.filter((w) => isEligible(w, false));
  let usedRepeatFallback = false;

  if (usablePool.length === 0 && settings.allowRepeatWords) {
    usablePool = wordBank.filter((w) => isEligible(w, true));
    usedRepeatFallback = usablePool.length > 0;
  }

  if (usablePool.length === 0) {
    return {
      word: null,
      exhaustedAll: true,
      fallbackNotice: 'تمام کلمات قابل استفاده در دسته‌ها و سطوح انتخابی این مسابقه به پایان رسیده‌اند.',
    };
  }

  const targetDifficulty =
    forcedDifficulty ??
    selectDifficultyByWeight(enabledDifficulties, settings.difficultyWeights, rng);

  let chosenDifficulty = targetDifficulty;
  let fallbackNotice: string | undefined = usedRepeatFallback
    ? 'بانک کلمات جدید به پایان رسید؛ طبق تنظیمات از کلمات قبلی استفاده شد.'
    : undefined;

  let diffPool = usablePool.filter((w) => w.difficulty === chosenDifficulty);

  if (diffPool.length === 0) {
    // Try remaining enabled difficulties first, then any available difficulty, with explicit notice!
    const fallbackOrder: Difficulty[] = ['hard', 'medium', 'easy'].filter(
      (d): d is Difficulty => d !== targetDifficulty
    );
    const preferredFallbacks = fallbackOrder.filter((d) => enabledDifficulties.includes(d));
    const orderedFallbacks = [...preferredFallbacks, ...fallbackOrder];

    for (const altDiff of orderedFallbacks) {
      const candidate = usablePool.filter((w) => w.difficulty === altDiff);
      if (candidate.length > 0) {
        chosenDifficulty = altDiff;
        diffPool = candidate;
        fallbackNotice = `کلمات سطح «${difficultyLabel(
          targetDifficulty
        )}» در دسته‌های انتخابی تمام شده بود؛ با اطلاع‌رسانی از سطح «${difficultyLabel(
          chosenDifficulty
        )}» استفاده شد.`;
        break;
      }
    }
  }

  // Group available words at chosenDifficulty by category so category bank size NEVER skews category chance
  const availableCategories = Array.from(new Set(diffPool.map((w) => w.categoryId)));
  const pickedCategory = weightedPick(
    availableCategories,
    (catId) => {
      const usedCount = categoryUsageCount[catId] ?? 0;
      let w = 1 / (1 + usedCount * 1.5);
      if (availableCategories.length > 1 && lastCategoryId === catId) {
        w *= 0.15;
      }
      return w;
    },
    rng
  );

  const catCandidates = diffPool.filter((w) => w.categoryId === pickedCategory);
  const pickedWord = weightedPick(
    catCandidates,
    (w) => computeContentCandidateWeight(w, settings, lastSimilarityTag),
    rng
  );

  return {
    word: pickedWord,
    fallbackNotice,
  };
}

/**
 * Selects a replacement word for Swap or Invalid Report:
 * Strictly prefers SAME category and SAME difficulty.
 * If exhausted, falls back to another selected category at the SAME difficulty (preserving point fairness)
 * with an explicit notification.
 */
export function selectReplacementWord(params: {
  currentWord: WordItem;
  wordBank: WordItem[];
  selectedCategoryIds: string[];
  usedWordIds: Set<string>;
  settings: AppSettings;
  rng?: () => number;
}): WordSelectionResult {
  const { currentWord, wordBank, selectedCategoryIds, usedWordIds, settings, rng = Math.random } =
    params;

  if (currentWord.kind === 'golden') {
    return selectGoldenChallengeWord({
      wordBank,
      usedWordIds,
      settings,
      excludeWordId: currentWord.id,
      rng,
    });
  }

  const sameCatSameDiff = wordBank.filter(
    (w) =>
      w.id !== currentWord.id &&
      w.status === 'valid' &&
      w.categoryId === currentWord.categoryId &&
      w.difficulty === currentWord.difficulty &&
      !usedWordIds.has(w.id)
  );

  if (sameCatSameDiff.length > 0) {
    const word = weightedPick(
      sameCatSameDiff,
      (w) => computeContentCandidateWeight(w, settings, null),
      rng
    );
    return { word };
  }

  // Fallback 1: Same difficulty in another selected category (keeps exact same point value!)
  const otherCatSameDiff = wordBank.filter(
    (w) =>
      w.id !== currentWord.id &&
      w.kind === currentWord.kind &&
      w.status === 'valid' &&
      selectedCategoryIds.includes(w.categoryId) &&
      w.difficulty === currentWord.difficulty &&
      !usedWordIds.has(w.id)
  );

  if (otherCatSameDiff.length > 0) {
    const word = weightedPick(otherCatSameDiff, () => 1, rng);
    return {
      word,
      fallbackNotice:
        'کلمه دیگری در همان دسته و سطح باقی نمانده بود؛ کلمه هم‌سطح از دسته فعال دیگر جایگزین شد.',
    };
  }

  // Fallback 2: Same category, nearest difficulty
  const sameCatAnyDiff = wordBank.filter(
    (w) =>
      w.id !== currentWord.id &&
      w.status === 'valid' &&
      w.categoryId === currentWord.categoryId &&
      !usedWordIds.has(w.id)
  );

  if (sameCatAnyDiff.length > 0) {
    const word = weightedPick(sameCatAnyDiff, () => 1, rng);
    return {
      word,
      fallbackNotice: word
        ? `کلمات هم‌سطح در این دسته تمام شده بود؛ کلمه جایگزین از سطح «${difficultyLabel(
            word.difficulty
          )}» انتخاب شد.`
        : undefined,
    };
  }

  return {
    word: null,
    exhaustedAll: true,
    fallbackNotice: 'کلمه جایگزین دیگری در بانک کلمات باقی نمانده است.',
  };
}

export function selectGoldenChallengeWord(params: {
  wordBank: WordItem[];
  usedWordIds: Set<string>;
  settings: AppSettings;
  excludeWordId?: string;
  rng?: () => number;
}): WordSelectionResult {
  const { wordBank, usedWordIds, settings, excludeWordId, rng = Math.random } = params;

  let pool = wordBank.filter(
    (w) =>
      w.kind === 'golden' &&
      w.status === 'valid' &&
      w.id !== excludeWordId &&
      !usedWordIds.has(w.id)
  );

  let fallbackNotice: string | undefined;
  if (pool.length === 0 && settings.allowRepeatWords) {
    pool = wordBank.filter(
      (w) => w.kind === 'golden' && w.status === 'valid' && w.id !== excludeWordId
    );
    if (pool.length > 0) {
      fallbackNotice = 'عبارات جدید موضوع طلایی تمام شده بود؛ از بانک موضوع طلایی مجدداً انتخاب شد.';
    }
  }

  if (pool.length === 0) {
    return {
      word: null,
      exhaustedAll: true,
      fallbackNotice: 'تمام عبارات موضوع طلایی در این مسابقه استفاده شده‌اند.',
    };
  }

  const word = weightedPick(pool, () => 1, rng);
  return { word, fallbackNotice };
}
