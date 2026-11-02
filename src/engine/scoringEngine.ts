import {
  AppSettings,
  ScoreEvent,
  SpeedBonusRule,
  Team,
  TeamScoreSummary,
  WordItem,
} from '../types/game';

export interface WordScoreResult {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  speedBonusThresholdSec: number | null;
}

export interface ActiveSpeedBonusWindow {
  activeBonus: number;
  nextDeadlineSec: number;
  nextBonus: number;
}

export function getSpeedBonusTiersForWord(
  word: WordItem,
  settings: AppSettings
): SpeedBonusRule[] {
  if (word.kind === 'golden') {
    return [...settings.goldenSpeedBonusTiers].sort((a, b) => a.thresholdSec - b.thresholdSec);
  }
  const raw =
    word.kind === 'proverb'
      ? settings.proverbSpeedBonus[word.difficulty]
      : settings.regularSpeedBonus[word.difficulty];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...list].sort((a, b) => a.thresholdSec - b.thresholdSec);
}

/**
 * Pure scoring function for a solved word.
 * Evaluates base points and the highest eligible stepped speed bonus tier
 * based on real elapsed seconds from the start of that word's timer.
 */
export function calculateWordScore(
  word: WordItem,
  elapsedSeconds: number,
  settings: AppSettings
): WordScoreResult {
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const basePoints =
    word.kind === 'golden'
      ? settings.goldenBasePoints
      : word.kind === 'proverb'
      ? settings.proverbBasePoints[word.difficulty]
      : settings.regularBasePoints[word.difficulty];

  const sortedTiers = getSpeedBonusTiersForWord(word, settings);
  let bestBonus = 0;
  let matchedThreshold: number | null = null;

  for (const tier of sortedTiers) {
    if (safeElapsed <= tier.thresholdSec && tier.bonus > bestBonus) {
      bestBonus = tier.bonus;
      matchedThreshold = tier.thresholdSec;
    }
  }

  return {
    basePoints,
    speedBonus: bestBonus,
    totalPoints: basePoints + bestBonus,
    speedBonusThresholdSec: matchedThreshold,
  };
}

/**
 * Returns information about the currently active stepped speed bonus window while playing,
 * including what the bonus drops to after the current step deadline!
 */
export function getActiveSpeedBonusWindow(
  word: WordItem,
  elapsedSeconds: number,
  settings: AppSettings
): ActiveSpeedBonusWindow | null {
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const sorted = getSpeedBonusTiersForWord(word, settings).filter((t) => t.bonus > 0);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    if (safeElapsed <= tier.thresholdSec) {
      const nextBonus = sorted[i + 1]?.bonus ?? 0;
      return {
        activeBonus: tier.bonus,
        nextDeadlineSec: tier.thresholdSec,
        nextBonus,
      };
    }
  }
  return null;
}

export function calculateSwapPenalty(settings: AppSettings): number {
  return Math.max(0, settings.swapPenalty);
}

export function calculateFoulPenalty(foulCount: number, settings: AppSettings): number {
  const safeCount = Math.max(0, Math.floor(foulCount));
  const perFoul = Math.max(0, settings.foulPenalty ?? 1);
  return safeCount * perFoul;
}

/**
 * Computes complete, auditable standings for all teams from immutable ScoreEvents.
 */
export function computeTeamStandings(
  teams: Team[],
  events: ScoreEvent[],
  extraWrongGuessesByTeam: Record<string, number> = {},
  goldenUsedByTeam: Record<string, number> = {},
  allowNegativeScore = true
): TeamScoreSummary[] {
  const map = new Map<string, TeamScoreSummary>();

  teams.forEach((team) => {
    map.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      color: team.color,
      icon: team.icon,
      rawTotal: 0,
      totalScore: 0,
      basePointsTotal: 0,
      speedBonusTotal: 0,
      swapPenaltyTotal: 0,
      foulPenaltyTotal: 0,
      correctCount: 0,
      wrongGuessesCount: extraWrongGuessesByTeam[team.id] ?? 0,
      swapsCount: 0,
      goldenUsedCount: goldenUsedByTeam[team.id] ?? 0,
    });
  });

  for (const ev of events) {
    const item = map.get(ev.teamId);
    if (!item) continue;

    item.basePointsTotal += ev.basePoints;
    item.speedBonusTotal += ev.speedBonus;
    item.swapPenaltyTotal += ev.swapPenalty;
    item.foulPenaltyTotal += ev.foulPenalty ?? 0;
    item.wrongGuessesCount += ev.wrongGuessesInSlot;

    if (ev.outcome === 'correct') {
      item.correctCount += 1;
    } else if (ev.outcome === 'swap') {
      item.swapsCount += 1;
    }
  }

  const originalIndex = new Map<string, number>();
  teams.forEach((t, idx) => originalIndex.set(t.id, idx));

  const list = Array.from(map.values()).map((summary) => {
    const rawTotal =
      summary.basePointsTotal +
      summary.speedBonusTotal -
      summary.swapPenaltyTotal -
      summary.foulPenaltyTotal;
    const totalScore = allowNegativeScore ? rawTotal : Math.max(0, rawTotal);
    return {
      ...summary,
      rawTotal,
      totalScore,
    };
  });

  list.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.speedBonusTotal !== a.speedBonusTotal) return b.speedBonusTotal - a.speedBonusTotal;
    const aPenalties = a.swapPenaltyTotal + a.foulPenaltyTotal;
    const bPenalties = b.swapPenaltyTotal + b.foulPenaltyTotal;
    if (aPenalties !== bPenalties) return aPenalties - bPenalties;
    return (originalIndex.get(a.teamId) ?? 0) - (originalIndex.get(b.teamId) ?? 0);
  });

  return list;
}

/**
 * Detects whether two or more teams are tied for first place by totalScore.
 * In case of a tie at the end of the match (or sudden-death mini-round),
 * returns the IDs of all teams sharing the highest score.
 */
export function detectTopTiedTeams(
  standings: TeamScoreSummary[],
  candidateTeamIds?: string[]
): string[] {
  const filtered =
    candidateTeamIds && candidateTeamIds.length > 0
      ? standings.filter((s) => candidateTeamIds.includes(s.teamId))
      : standings;

  if (filtered.length < 2) return [];
  const maxScore = Math.max(...filtered.map((s) => s.totalScore));
  const leaders = filtered.filter((s) => s.totalScore === maxScore);
  return leaders.length >= 2 ? leaders.map((l) => l.teamId) : [];
}
