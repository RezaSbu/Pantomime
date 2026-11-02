import { create } from 'zustand';
import { INITIAL_CATEGORIES } from '../data/categories';
import { INITIAL_WORDS } from '../data/initialWordBank';
import {
  beginTurnSlot,
  buildCompletedMatchRecord,
  cancelTurnSelectionBeforeReveal,
  createMatchState,
  expireTurnTimer,
  finishTurnUnsolved,
  hideWordInConcealedPhase,
  isFinalRegularRound,
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
  toggleWordVisibilityDuringPlay,
} from '../engine/gameEngine';
import { createDefaultTeams } from '../engine/roundManager';
import { feedbackEngine } from '../engine/soundEngine';
import {
  clearAllHistory,
  initializeStorage,
  persistActiveMatch,
  persistCompletedMatch,
  persistWord,
  removeHistoryRecord,
} from '../storage/db';
import {
  applyThemeToDocument,
  DEFAULT_SETTINGS,
  loadLastTeamsPreset,
  loadSettings,
  saveLastTeamsPreset,
  saveSettings,
} from '../storage/settingsStorage';
import {
  ActiveMatchState,
  AppRoute,
  AppSettings,
  CategoryItem,
  CompletedMatch,
  Difficulty,
  GameSetupConfig,
  Team,
  WordItem,
} from '../types/game';

interface GameStoreState {
  isHydrated: boolean;
  route: AppRoute;
  isRulesOpen: boolean;
  settings: AppSettings;
  words: WordItem[];
  categories: CategoryItem[];
  activeMatch: ActiveMatchState | null;
  history: CompletedMatch[];
  setupDraftTeams: Team[];
  toastMessage: string | null;

  hydrate: () => Promise<void>;
  navigate: (route: AppRoute) => void;
  setRulesOpen: (open: boolean) => void;
  showToast: (msg: string | null) => void;

  // Quick Preferences (Sound, Tick, Theme, Tilt)
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Game lifecycle
  startNewMatch: (config: GameSetupConfig) => void;
  resumeSavedMatch: () => void;
  abandonActiveMatch: () => Promise<void>;
  replayWithTeams: (teams: Team[]) => void;

  // Turn actions
  prepareTurnCard: (options?: {
    useGolden?: boolean;
    forcedCategoryId?: string;
    forcedDifficulty?: Difficulty;
  }) => {
    ok: boolean;
    error?: string;
  };
  cancelPreRevealSelection: () => void;
  revealSecretWord: () => void;
  concealSecretWord: () => void;
  startTimerForTurn: () => void;
  togglePlayWordMask: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  wrongGuess: () => void;
  correctGuess: () => void;
  swapWord: () => { ok: boolean; error?: string };
  reportInvalidWord: () => Promise<{ ok: boolean; error?: string }>;
  triggerTimeExpired: () => void;
  endTurnManuallyOrTimeout: (outcome: 'timeout' | 'manual_end') => void;
  nextTurnOrSummary: () => Promise<void>;
  beginNextRound: () => Promise<void>;

  // History
  deleteHistoryItem: (matchId: string) => Promise<void>;
  wipeHistory: () => Promise<void>;
}

function getInitialDraftTeams(): Team[] {
  const raw = loadLastTeamsPreset();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Team[];
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 8) {
        return parsed;
      }
    } catch {
      // Fallback
    }
  }
  return createDefaultTeams(2);
}

const initialSettings = {
  ...DEFAULT_SETTINGS,
  ...loadSettings(),
  // Always ensure all categories remain active in player-facing mobile mode
  disabledCategoryIds: [],
  goldenEnabled: true,
};
applyThemeToDocument(initialSettings.theme);

export const useGameStore = create<GameStoreState>((set, get) => ({
  isHydrated: false,
  route: 'home',
  isRulesOpen: false,
  settings: initialSettings,
  words: INITIAL_WORDS,
  categories: INITIAL_CATEGORIES,
  activeMatch: null,
  history: [],
  setupDraftTeams: getInitialDraftTeams(),
  toastMessage: null,

  hydrate: async () => {
    try {
      const data = await initializeStorage();
      // Ensure backwards compatibility and enforce Team 1 -> Team 2 -> ... cyclic order on saved matches
      const normalizedMatch = data.activeMatch
        ? {
            ...data.activeMatch,
            initialStartIndex: 0,
            roundTeamOrder:
              !data.activeMatch.isSuddenDeath &&
              data.activeMatch.currentTurnIndexInRound === 0 &&
              data.activeMatch.phase === 'PRE_TURN'
                ? data.activeMatch.teams.map((t) => t.id)
                : data.activeMatch.roundTeamOrder,
            usedCombosByTeam: data.activeMatch.usedCombosByTeam ?? {},
            selectedCategoryIds: INITIAL_CATEGORIES.map((c) => c.id),
            enabledDifficulties: ['easy', 'medium', 'hard'] as Difficulty[],
          }
        : null;

      set({
        isHydrated: true,
        words: data.words,
        categories: INITIAL_CATEGORIES,
        activeMatch: normalizedMatch,
        history: data.history,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  navigate: (route) => {
    const current = get();
    feedbackEngine.onTap(current.settings.soundEnabled);
    if (
      current.route === 'game' &&
      route !== 'game' &&
      current.activeMatch &&
      current.activeMatch.phase === 'PLAYING'
    ) {
      const paused = pauseTurnPlayTimer(current.activeMatch);
      set({ activeMatch: paused, route });
      persistActiveMatch(paused).catch(() => {});
      return;
    }
    set({ route });
  },

  setRulesOpen: (open) => {
    feedbackEngine.onTap(get().settings.soundEnabled);
    set({ isRulesOpen: open });
  },

  showToast: (msg) => {
    set({ toastMessage: msg });
  },

  updateSettings: (patch) => {
    const next: AppSettings = {
      ...get().settings,
      ...patch,
      disabledCategoryIds: [],
      goldenEnabled: true,
    };
    saveSettings(next);
    applyThemeToDocument(next.theme);
    set({ settings: next });
  },

  startNewMatch: (config) => {
    const { settings } = get();
    saveLastTeamsPreset(JSON.stringify(config.teams));
    const match = createMatchState(
      {
        ...config,
        selectedCategoryIds: INITIAL_CATEGORIES.map((c) => c.id),
        enabledDifficulties: ['easy', 'medium', 'hard'],
        goldenEnabled: true,
      },
      settings
    );
    if (isFinalRegularRound(match)) {
      feedbackEngine.onFinalRound(settings.soundEnabled, settings.vibrationEnabled);
    } else {
      feedbackEngine.onMatchLaunch(settings.soundEnabled, settings.vibrationEnabled);
    }
    set({
      activeMatch: match,
      setupDraftTeams: config.teams,
      route: 'game',
    });
    persistActiveMatch(match).catch(() => {});
  },

  resumeSavedMatch: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    feedbackEngine.onSelectTopic(settings.soundEnabled, settings.vibrationEnabled);
    set({ route: 'game' });
  },

  abandonActiveMatch: async () => {
    feedbackEngine.onTap(get().settings.soundEnabled);
    set({ activeMatch: null, route: 'home' });
    await persistActiveMatch(null);
  },

  replayWithTeams: (teams) => {
    saveLastTeamsPreset(JSON.stringify(teams));
    feedbackEngine.onTap(get().settings.soundEnabled);
    set({
      setupDraftTeams: teams.map((t) => ({ ...t })),
      route: 'home',
    });
  },

  prepareTurnCard: (options) => {
    const { activeMatch, words, settings } = get();
    if (!activeMatch) return { ok: false, error: 'مسابقه فعالی یافت نشد.' };
    const res = beginTurnSlot(activeMatch, words, settings, options);
    if (res.error) {
      feedbackEngine.onLockedTap(settings.soundEnabled, settings.vibrationEnabled);
      return { ok: false, error: res.error };
    }
    feedbackEngine.onSelectTopic(settings.soundEnabled, settings.vibrationEnabled);
    set({ activeMatch: res.state });
    persistActiveMatch(res.state).catch(() => {});
    return { ok: true };
  },

  cancelPreRevealSelection: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    const next = cancelTurnSelectionBeforeReveal(activeMatch);
    if (next !== activeMatch) {
      feedbackEngine.onTap(settings.soundEnabled);
      set({ activeMatch: next });
      persistActiveMatch(next).catch(() => {});
    }
  },

  revealSecretWord: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    const next = revealWordToActor(activeMatch);
    feedbackEngine.onRevealWord(settings.soundEnabled, settings.vibrationEnabled);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  concealSecretWord: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    feedbackEngine.onTap(settings.soundEnabled);
    const next = hideWordInConcealedPhase(activeMatch);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  startTimerForTurn: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    const next = startTurnPlayTimer(activeMatch);
    feedbackEngine.onTimerStart(settings.soundEnabled, settings.vibrationEnabled);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  togglePlayWordMask: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    feedbackEngine.onTap(settings.soundEnabled);
    const next = toggleWordVisibilityDuringPlay(activeMatch);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  pauseGame: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    feedbackEngine.onTap(settings.soundEnabled);
    const next = pauseTurnPlayTimer(activeMatch);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  resumeGame: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    const next = resumeTurnPlayTimer(activeMatch);
    feedbackEngine.onTimerStart(settings.soundEnabled, settings.vibrationEnabled);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  wrongGuess: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch) return;
    const next = recordWrongGuessInTurn(activeMatch);
    if (next !== activeMatch) {
      feedbackEngine.onWrongGuess(settings.soundEnabled, settings.vibrationEnabled);
      set({ activeMatch: next });
      persistActiveMatch(next).catch(() => {});
    }
  },

  correctGuess: () => {
    const { activeMatch, words, settings } = get();
    if (!activeMatch || !activeMatch.currentSlot || activeMatch.currentSlot.isScored) {
      return;
    }
    const wasGolden = activeMatch.currentSlot.word.kind === 'golden';
    const prevEventsLen = activeMatch.allEvents.length;
    const next = markWordSolved(activeMatch, words, settings);
    if (next !== activeMatch) {
      const addedEv = next.allEvents[prevEventsLen];
      const hasSpeedBonus = Boolean(addedEv && addedEv.speedBonus > 0);
      feedbackEngine.onCorrect(settings.soundEnabled, settings.vibrationEnabled, {
        isGolden: wasGolden,
        hasSpeedBonus,
      });
      set({ activeMatch: next });
      persistActiveMatch(next).catch(() => {});
    }
  },

  swapWord: () => {
    const { activeMatch, words, settings } = get();
    if (!activeMatch) return { ok: false, error: 'مسابقه فعال نیست.' };
    const res = swapWordInTurn(activeMatch, words, settings);
    if (!res.swapped) {
      feedbackEngine.onLockedTap(settings.soundEnabled, settings.vibrationEnabled);
      return { ok: false, error: res.error };
    }
    feedbackEngine.onSwap(settings.soundEnabled, settings.vibrationEnabled);
    set({ activeMatch: res.state });
    persistActiveMatch(res.state).catch(() => {});
    return { ok: true };
  },

  reportInvalidWord: async () => {
    const { activeMatch, words, settings } = get();
    if (!activeMatch) return { ok: false, error: 'مسابقه فعال نیست.' };
    const res = reportInvalidWordAndReplace(activeMatch, words, settings);
    if (!res.reportedWordId) {
      return { ok: false, error: res.error };
    }

    feedbackEngine.onSelectTopic(settings.soundEnabled, settings.vibrationEnabled);
    const updatedWords = words.map((w) =>
      w.id === res.reportedWordId
        ? { ...w, status: 'reported' as const, reportedAt: Date.now() }
        : w
    );
    const flagged = updatedWords.find((w) => w.id === res.reportedWordId);
    set({
      words: updatedWords,
      activeMatch: res.state,
    });

    if (flagged) {
      await persistWord(flagged);
    }
    await persistActiveMatch(res.state);
    return { ok: true };
  },

  triggerTimeExpired: () => {
    const { activeMatch, settings } = get();
    if (!activeMatch || activeMatch.phase !== 'PLAYING') return;
    const next = expireTurnTimer(activeMatch);
    if (next !== activeMatch) {
      feedbackEngine.onTimeUp(settings.soundEnabled, settings.vibrationEnabled);
      set({ activeMatch: next });
      persistActiveMatch(next).catch(() => {});
    }
  },

  endTurnManuallyOrTimeout: (outcome) => {
    const { activeMatch, words, settings } = get();
    if (!activeMatch) return;
    if (outcome === 'manual_end') {
      feedbackEngine.onWrongGuess(settings.soundEnabled, settings.vibrationEnabled);
    } else {
      feedbackEngine.onTap(settings.soundEnabled);
    }
    const next = finishTurnUnsolved(activeMatch, outcome, words, settings);
    set({ activeMatch: next });
    persistActiveMatch(next).catch(() => {});
  },

  nextTurnOrSummary: async () => {
    const { activeMatch, settings, history } = get();
    if (!activeMatch) return;
    const next = proceedFromTurnResult(activeMatch, settings);

    if (next.phase === 'GAME_OVER') {
      feedbackEngine.onVictory(settings.soundEnabled, settings.vibrationEnabled);
      const record = buildCompletedMatchRecord(next, settings);
      const alreadySaved = history.some((h) => h.id === record.id);
      const nextHistory = alreadySaved ? history : [record, ...history];
      set({ activeMatch: next, history: nextHistory });
      await persistCompletedMatch(record);
      await persistActiveMatch(null);
      return;
    }

    feedbackEngine.onSelectTopic(settings.soundEnabled, settings.vibrationEnabled);
    set({ activeMatch: next });
    await persistActiveMatch(next);
  },

  beginNextRound: async () => {
    const { activeMatch, settings, history } = get();
    if (!activeMatch) return;
    const next = startNextRoundInMatch(activeMatch, settings);

    if (next.phase === 'GAME_OVER') {
      feedbackEngine.onVictory(settings.soundEnabled, settings.vibrationEnabled);
      const record = buildCompletedMatchRecord(next, settings);
      const alreadySaved = history.some((h) => h.id === record.id);
      const nextHistory = alreadySaved ? history : [record, ...history];
      set({ activeMatch: next, history: nextHistory });
      await persistCompletedMatch(record);
      await persistActiveMatch(null);
      return;
    }

    if (isFinalRegularRound(next) || next.isSuddenDeath) {
      feedbackEngine.onFinalRound(settings.soundEnabled, settings.vibrationEnabled);
    } else {
      feedbackEngine.onSelectTopic(settings.soundEnabled, settings.vibrationEnabled);
    }
    set({ activeMatch: next });
    await persistActiveMatch(next);
  },

  deleteHistoryItem: async (matchId) => {
    feedbackEngine.onTap(get().settings.soundEnabled);
    set({ history: get().history.filter((h) => h.id !== matchId) });
    await removeHistoryRecord(matchId);
  },

  wipeHistory: async () => {
    feedbackEngine.onTap(get().settings.soundEnabled);
    set({ history: [] });
    await clearAllHistory();
  },
}));
