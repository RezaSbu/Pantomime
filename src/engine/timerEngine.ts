import { AppSettings, TimerState, WordItem } from '../types/game';

export interface TimerSnapshot {
  elapsedMs: number;
  elapsedSeconds: number;
  remainingMs: number | null;
  remainingSeconds: number | null;
  progressRatio: number;
  isExpired: boolean;
}

export function getWordDurationSec(word: WordItem, settings: AppSettings): number | null {
  if (settings.timerMode === 'unlimited') {
    return null;
  }
  if (word.kind === 'golden') {
    return settings.goldenTimeSec;
  }
  if (word.kind === 'proverb') {
    return settings.proverbTimeSec[word.difficulty];
  }
  return settings.regularTimeSec[word.difficulty];
}

export function createIdleTimer(word: WordItem, settings: AppSettings): TimerState {
  return {
    mode: settings.timerMode,
    status: 'idle',
    durationSec: getWordDurationSec(word, settings),
    startedAtTimestamp: null,
    accumulatedElapsedMs: 0,
  };
}

export function startTimerState(timer: TimerState, now = Date.now()): TimerState {
  if (timer.status === 'running') return timer;
  return {
    ...timer,
    status: 'running',
    startedAtTimestamp: now,
  };
}

export function pauseTimerState(timer: TimerState, now = Date.now()): TimerState {
  if (timer.status !== 'running' || timer.startedAtTimestamp === null) {
    return timer;
  }
  const delta = Math.max(0, now - timer.startedAtTimestamp);
  return {
    ...timer,
    status: 'paused',
    startedAtTimestamp: null,
    accumulatedElapsedMs: timer.accumulatedElapsedMs + delta,
  };
}

export function resumeTimerState(timer: TimerState, now = Date.now()): TimerState {
  if (timer.status !== 'paused' && timer.status !== 'idle') {
    return timer;
  }
  return {
    ...timer,
    status: 'running',
    startedAtTimestamp: now,
  };
}

export function stopTimerState(timer: TimerState, now = Date.now()): TimerState {
  const paused = pauseTimerState(timer, now);
  return {
    ...paused,
    status: 'finished',
  };
}

/**
 * Computes exact wall-clock timer snapshot at timestamp `now`.
 * Immune to tab backgrounding, screen lock, or React re-renders.
 */
export function getTimerSnapshot(timer: TimerState, now = Date.now()): TimerSnapshot {
  const activeDelta =
    timer.status === 'running' && timer.startedAtTimestamp !== null
      ? Math.max(0, now - timer.startedAtTimestamp)
      : 0;
  const elapsedMs = timer.accumulatedElapsedMs + activeDelta;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (timer.durationSec === null) {
    return {
      elapsedMs,
      elapsedSeconds,
      remainingMs: null,
      remainingSeconds: null,
      progressRatio: 1,
      isExpired: false,
    };
  }

  const totalMs = timer.durationSec * 1000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progressRatio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const isExpired = elapsedMs >= totalMs;

  return {
    elapsedMs,
    elapsedSeconds,
    remainingMs,
    remainingSeconds,
    progressRatio,
    isExpired,
  };
}
