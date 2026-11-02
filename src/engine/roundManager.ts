import { StartOrderMode, Team } from '../types/game';
import { DEFAULT_TEAM_NAMES, TEAM_COLOR_PALETTE, TEAM_ICONS } from '../utils/format';

export function createDefaultTeams(count = 2): Team[] {
  const clamped = Math.max(2, Math.min(8, count));
  return Array.from({ length: clamped }, (_, idx) => ({
    id: `team_${idx + 1}`,
    name: DEFAULT_TEAM_NAMES[idx] ?? `تیم ${idx + 1}`,
    color: TEAM_COLOR_PALETTE[idx % TEAM_COLOR_PALETTE.length].hex,
    icon: TEAM_ICONS[idx % TEAM_ICONS.length],
  }));
}

export function resolveInitialStartIndex(
  _teams: Team[],
  _mode: StartOrderMode = 'first',
  _manualTeamId?: string,
  _rng: () => number = Math.random
): number {
  return 0;
}

/**
 * Generates consistent cyclic turn order for every round, always starting from Team 1.
 * Example for 2 teams [T1, T2]:
 * Round 1 -> [T1, T2], Round 2 -> [T1, T2], Round 3 -> [T1, T2]
 * (Turn sequence: T1 -> T2 -> T1 -> T2 -> T1 -> T2)
 * Example for 3 teams [T1, T2, T3]:
 * Round 1 -> [T1, T2, T3], Round 2 -> [T1, T2, T3], Round 3 -> [T1, T2, T3]
 */
export function getRoundTeamOrder(
  teams: Team[],
  _initialStartIndex = 0,
  _roundNumber = 1
): string[] {
  return teams.map((team) => team.id);
}

/**
 * Generates consistent turn order for Sudden Death tie-breaker rounds,
 * preserving the original Team 1 -> Team 2 -> ... order without consecutive repeats.
 */
export function getSuddenDeathTeamOrder(
  tiedTeamIds: string[],
  _suddenDeathRound = 1,
  allTeams?: Team[]
): string[] {
  if (tiedTeamIds.length === 0) return [];
  if (allTeams && allTeams.length > 0) {
    const tiedSet = new Set(tiedTeamIds);
    return allTeams.filter((t) => tiedSet.has(t.id)).map((t) => t.id);
  }
  return [...tiedTeamIds];
}
