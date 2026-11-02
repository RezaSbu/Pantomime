/**
 * Studio-Grade Synthesized Game-Show Audio & Haptic Engine (Web Audio API)
 *
 * Features:
 * - Master DynamicsCompressorNode + Warm Studio Slapback Ambience Bus
 * - Multi-harmonic Celesta / Vibraphone Bell Chimes
 * - Filtered Unison Brass Stingers (no harsh raw sawtooth buzz)
 * - Punchy Stadium Kick & Multi-Burst Handclap Percussion
 * - Mechanical Stopwatch Escapement Ticks with 4-Stage Final-10s Acceleration:
 *   * > 10s: Clean 1x tick-tock (every 1000ms)
 *   * 10s .. 5s: Urgent 2x rapid ticks (every 500ms) + stadium heartbeat
 *   * 5s .. 2.5s: Intense 4x rapid ticks (every 250ms) + rising tension bell
 *   * 2.5s .. 0s: Thrilling ~7.4x rapid countdown roll (every 135ms) up to 00:00!
 */

export type TimerTickStage = 'normal' | 'fast10' | 'faster5' | 'frantic2';

interface MasterBus {
  dryInput: GainNode;
  reverbSend: GainNode;
}

class FeedbackEngine {
  private ctx: AudioContext | null = null;
  private bus: MasterBus | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.bus = this.createMasterBus(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getBus(): { ctx: AudioContext; bus: MasterBus } | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    if (!this.bus) {
      this.bus = this.createMasterBus(ctx);
    }
    return { ctx, bus: this.bus };
  }

  private createMasterBus(ctx: AudioContext): MasterBus {
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.94;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4.2;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;

    const dryInput = ctx.createGain();
    dryInput.gain.value = 1.0;

    // Warm studio room / slapback ambience network
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 1.0;

    const delayA = ctx.createDelay(0.5);
    delayA.delayTime.value = 0.082;
    const filterA = ctx.createBiquadFilter();
    filterA.type = 'lowpass';
    filterA.frequency.value = 2600;
    const fbA = ctx.createGain();
    fbA.gain.value = 0.26;
    const wetA = ctx.createGain();
    wetA.gain.value = 0.24;

    const delayB = ctx.createDelay(0.5);
    delayB.delayTime.value = 0.155;
    const filterB = ctx.createBiquadFilter();
    filterB.type = 'lowpass';
    filterB.frequency.value = 1750;
    const wetB = ctx.createGain();
    wetB.gain.value = 0.14;

    reverbSend.connect(delayA);
    delayA.connect(filterA);
    filterA.connect(fbA);
    fbA.connect(delayA);
    filterA.connect(wetA);

    reverbSend.connect(delayB);
    delayB.connect(filterB);
    filterB.connect(wetB);

    dryInput.connect(masterGain);
    wetA.connect(masterGain);
    wetB.connect(masterGain);

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    return { dryInput, reverbSend };
  }

  /**
   * Call on first pointerdown/touchstart to unlock Web Audio on iOS & Android.
   */
  unlock() {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const bufferSize = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Crystal Celesta / Vibraphone Chime (Fundamental + Warm Octave + Shimmering Bell Harmonic)
   */
  private playBellChime(options: {
    freq: number;
    durationSec: number;
    delaySec?: number;
    gainPeak?: number;
    sendReverb?: boolean;
  }) {
    const audio = this.getBus();
    if (!audio) return;
    const { ctx, bus } = audio;
    const {
      freq,
      durationSec,
      delaySec = 0,
      gainPeak = 0.24,
      sendReverb = true,
    } = options;

    const now = ctx.currentTime + delaySec;

    // 1. Warm fundamental sine
    const osc1 = ctx.createOscillator();
    const env1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    env1.gain.setValueAtTime(0.0001, now);
    env1.gain.linearRampToValueAtTime(gainPeak, now + 0.006);
    env1.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc1.connect(env1);
    env1.connect(bus.dryInput);
    if (sendReverb) env1.connect(bus.reverbSend);
    osc1.start(now);
    osc1.stop(now + durationSec + 0.02);

    // 2. Octave harmonic body
    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    const dur2 = Math.max(0.06, durationSec * 0.55);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);
    env2.gain.setValueAtTime(0.0001, now);
    env2.gain.linearRampToValueAtTime(gainPeak * 0.3, now + 0.004);
    env2.gain.exponentialRampToValueAtTime(0.0001, now + dur2);
    osc2.connect(env2);
    env2.connect(bus.dryInput);
    if (sendReverb) env2.connect(bus.reverbSend);
    osc2.start(now);
    osc2.stop(now + dur2 + 0.02);

    // 3. Crisp metallic mallet strike (3x harmonic, ultra-short sparkle)
    if (freq * 3 < 9500) {
      const osc3 = ctx.createOscillator();
      const env3 = ctx.createGain();
      const dur3 = Math.min(0.08, durationSec * 0.35);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(freq * 3, now);
      env3.gain.setValueAtTime(0.0001, now);
      env3.gain.linearRampToValueAtTime(gainPeak * 0.16, now + 0.002);
      env3.gain.exponentialRampToValueAtTime(0.0001, now + dur3);
      osc3.connect(env3);
      env3.connect(bus.dryInput);
      osc3.start(now);
      osc3.stop(now + dur3 + 0.015);
    }
  }

  /**
   * Warm Filtered Unison Game-Show Brass Voice (rich & triumphant, never buzzy)
   */
  private playWarmBrass(options: {
    freq: number;
    endFreq?: number;
    durationSec: number;
    delaySec?: number;
    gainPeak?: number;
    brightnessHz?: number;
    sendReverb?: boolean;
  }) {
    const audio = this.getBus();
    if (!audio) return;
    const { ctx, bus } = audio;
    const {
      freq,
      endFreq,
      durationSec,
      delaySec = 0,
      gainPeak = 0.2,
      brightnessHz = 2600,
      sendReverb = true,
    } = options;

    const now = ctx.currentTime + delaySec;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const subOsc = ctx.createOscillator();

    oscA.type = 'sawtooth';
    oscB.type = 'sawtooth';
    subOsc.type = 'triangle';

    oscA.detune.setValueAtTime(-7, now);
    oscB.detune.setValueAtTime(7, now);

    oscA.frequency.setValueAtTime(freq, now);
    oscB.frequency.setValueAtTime(freq, now);
    subOsc.frequency.setValueAtTime(freq, now);

    if (endFreq !== undefined && endFreq !== freq) {
      const safeEnd = Math.max(25, endFreq);
      oscA.frequency.exponentialRampToValueAtTime(safeEnd, now + durationSec);
      oscB.frequency.exponentialRampToValueAtTime(safeEnd, now + durationSec);
      subOsc.frequency.exponentialRampToValueAtTime(safeEnd, now + durationSec);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(1.8, now);
    filter.frequency.setValueAtTime(Math.max(300, freq * 1.3), now);
    filter.frequency.exponentialRampToValueAtTime(brightnessHz, now + Math.min(0.045, durationSec * 0.35));
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(420, brightnessHz * 0.48),
      now + durationSec
    );

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gainPeak, now + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    const mixA = ctx.createGain();
    mixA.gain.value = 0.42;
    const mixB = ctx.createGain();
    mixB.gain.value = 0.42;
    const mixSub = ctx.createGain();
    mixSub.gain.value = 0.45;

    oscA.connect(mixA);
    oscB.connect(mixB);
    subOsc.connect(mixSub);

    mixA.connect(filter);
    mixB.connect(filter);
    mixSub.connect(filter);

    filter.connect(env);
    env.connect(bus.dryInput);
    if (sendReverb) env.connect(bus.reverbSend);

    oscA.start(now);
    oscB.start(now);
    subOsc.start(now);
    oscA.stop(now + durationSec + 0.03);
    oscB.stop(now + durationSec + 0.03);
    subOsc.stop(now + durationSec + 0.03);
  }

  /**
   * Punchy Stadium Drum Kick / Heartbeat Thump
   */
  private playPunchyKick(
    delaySec = 0,
    gainPeak = 0.34,
    startFreq = 155,
    endFreq = 44,
    durationSec = 0.15
  ) {
    const audio = this.getBus();
    if (!audio) return;
    const { ctx, bus } = audio;
    const now = ctx.currentTime + delaySec;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gainPeak, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(env);
    env.connect(bus.dryInput);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /**
   * Snappy Multi-Burst Studio Handclap
   */
  private playSnappyClap(delaySec = 0, gainPeak = 0.22) {
    const audio = this.getBus();
    if (!audio) return;
    const { ctx, bus } = audio;
    const baseTime = ctx.currentTime + delaySec;

    const microOffsets = [0, 0.011, 0.023];
    microOffsets.forEach((offset, idx) => {
      const t = baseTime + offset;
      const isTail = idx === microOffsets.length - 1;
      const dur = isTail ? 0.095 : 0.018;

      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1380, t);
      filter.Q.setValueAtTime(2.1, t);

      const env = ctx.createGain();
      env.gain.setValueAtTime(gainPeak * (isTail ? 1 : 0.75), t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      noise.connect(filter);
      filter.connect(env);
      env.connect(bus.dryInput);
      if (isTail) env.connect(bus.reverbSend);

      noise.start(t);
      noise.stop(t + dur + 0.01);
    });
  }

  /**
   * Crisp Mechanical Stopwatch / Woodblock Escapement Tick (zero annoying sine-beep!)
   */
  private playStopwatchTick(options: {
    pitchScale?: number;
    gainPeak?: number;
    delaySec?: number;
  }) {
    const audio = this.getBus();
    if (!audio) return;
    const { ctx, bus } = audio;
    const { pitchScale = 1.0, gainPeak = 0.2, delaySec = 0 } = options;
    const now = ctx.currentTime + delaySec;

    // 1. Tight wood-mallet resonant body (20ms pitch drop)
    const bodyOsc = ctx.createOscillator();
    const bodyEnv = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(1580 * pitchScale, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(590 * pitchScale, now + 0.022);

    bodyEnv.gain.setValueAtTime(0.0001, now);
    bodyEnv.gain.linearRampToValueAtTime(gainPeak, now + 0.002);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

    bodyOsc.connect(bodyEnv);
    bodyEnv.connect(bus.dryInput);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.03);

    // 2. Crisp mechanical escapement click transient (12ms)
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = this.getNoiseBuffer(ctx);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(Math.min(6500, 3100 * pitchScale), now);
    bp.Q.setValueAtTime(5.2, now);

    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(gainPeak * 0.9, now);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.013);

    clickSrc.connect(bp);
    bp.connect(clickEnv);
    clickEnv.connect(bus.dryInput);

    clickSrc.start(now);
    clickSrc.stop(now + 0.018);
  }

  vibrate(pattern: number | number[], enabled: boolean) {
    if (!enabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore unsupported vibration errors
      }
    }
  }

  /** Crisp tactile pop when tapping UI controls */
  onTap(soundEnabled: boolean) {
    if (!soundEnabled) return;
    this.playStopwatchTick({ pitchScale: 0.92, gainPeak: 0.12 });
  }

  /** Sparkling 2-note celesta chime when picking a topic & difficulty */
  onSelectTopic(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate(22, vibrationEnabled);
    if (!soundEnabled) return;
    this.playBellChime({ freq: 587.33, durationSec: 0.16, delaySec: 0, gainPeak: 0.2 });
    this.playBellChime({ freq: 880, durationSec: 0.26, delaySec: 0.065, gainPeak: 0.25 });
  }

  /** Exciting TV Game-Show Opening Fanfare when starting a brand new match! */
  onMatchLaunch(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([55, 35, 95], vibrationEnabled);
    if (!soundEnabled) return;

    // Punchy opening drum & clap hits
    this.playPunchyKick(0, 0.38, 165, 42, 0.16);
    this.playPunchyKick(0.36, 0.42, 175, 40, 0.2);
    this.playSnappyClap(0.36, 0.24);

    // Rising game-show fanfare: G4 -> C5 -> E5 -> G5 -> Full C Major 9 Chord!
    const pickup = [
      { f: 392.0, d: 0.0, dur: 0.11 },
      { f: 523.25, d: 0.09, dur: 0.11 },
      { f: 659.25, d: 0.18, dur: 0.11 },
      { f: 783.99, d: 0.27, dur: 0.11 },
    ];
    pickup.forEach((n) => {
      this.playWarmBrass({ freq: n.f, durationSec: n.dur, delaySec: n.d, gainPeak: 0.18 });
      this.playBellChime({ freq: n.f * 2, durationSec: 0.16, delaySec: n.d, gainPeak: 0.12 });
    });

    // Big triumphant landing chord at 0.36s (C4 + E5 + G5 + D6)
    this.playWarmBrass({ freq: 261.63, durationSec: 0.48, delaySec: 0.36, gainPeak: 0.22 });
    this.playWarmBrass({ freq: 523.25, durationSec: 0.48, delaySec: 0.36, gainPeak: 0.2 });
    this.playBellChime({ freq: 659.25, durationSec: 0.52, delaySec: 0.36, gainPeak: 0.2 });
    this.playBellChime({ freq: 783.99, durationSec: 0.55, delaySec: 0.38, gainPeak: 0.22 });
    this.playBellChime({ freq: 1174.66, durationSec: 0.62, delaySec: 0.41, gainPeak: 0.26 });
  }

  /** Muted wooden double-knock when tapping a locked topic or golden card */
  onLockedTap(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([25, 25], vibrationEnabled);
    if (!soundEnabled) return;
    this.playWarmBrass({
      freq: 175,
      endFreq: 125,
      durationSec: 0.09,
      delaySec: 0,
      gainPeak: 0.15,
      brightnessHz: 650,
      sendReverb: false,
    });
    this.playWarmBrass({
      freq: 145,
      endFreq: 105,
      durationSec: 0.11,
      delaySec: 0.075,
      gainPeak: 0.16,
      brightnessHz: 550,
      sendReverb: false,
    });
  }

  /** Mysterious shimmering curtain-reveal chord when revealing the secret word */
  onRevealWord(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate(28, vibrationEnabled);
    if (!soundEnabled) return;
    const notes = [440, 554.37, 659.25, 830.61];
    notes.forEach((f, idx) => {
      this.playBellChime({
        freq: f,
        durationSec: 0.3 + idx * 0.05,
        delaySec: idx * 0.045,
        gainPeak: 0.16,
      });
    });
  }

  /**
   * Energetic "Ready-Set-ACTION!" Launch when starting the turn countdown!
   */
  onTimerStart(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([45, 25, 85], vibrationEnabled);
    if (!soundEnabled) return;

    // Two crisp rhythmic countdown pickups -> explosive GO bell + brass + kick!
    this.playStopwatchTick({ pitchScale: 1.05, gainPeak: 0.24, delaySec: 0 });
    this.playBellChime({ freq: 783.99, durationSec: 0.09, delaySec: 0, gainPeak: 0.18, sendReverb: false });

    this.playStopwatchTick({ pitchScale: 1.15, gainPeak: 0.26, delaySec: 0.105 });
    this.playBellChime({ freq: 783.99, durationSec: 0.09, delaySec: 0.105, gainPeak: 0.2, sendReverb: false });

    // GO! at 0.21s
    this.playPunchyKick(0.21, 0.38, 170, 44, 0.16);
    this.playSnappyClap(0.21, 0.2);
    this.playWarmBrass({ freq: 523.25, durationSec: 0.32, delaySec: 0.21, gainPeak: 0.22, brightnessHz: 3000 });
    this.playBellChime({ freq: 1046.5, durationSec: 0.42, delaySec: 0.21, gainPeak: 0.28 });
    this.playBellChime({ freq: 1318.51, durationSec: 0.45, delaySec: 0.23, gainPeak: 0.24 });
    this.playBellChime({ freq: 1567.98, durationSec: 0.48, delaySec: 0.25, gainPeak: 0.24 });
  }

  /**
   * Dynamic 4-Stage Countdown Timer Sound (with accelerating rapid ticks in the final 10s!):
   * - 'normal' (> 10s or unlimited): Crisp mechanical tick-tock once per second (if tickSoundEnabled)
   * - 'fast10' (10s .. 5s): 2x speed (every 500ms: تیک‌تیک) + stadium heartbeat on downbeat!
   * - 'faster5' (5s .. 2.5s): 4x speed (every 250ms: تیک‌تیک‌تیک‌تیک) + rising tension chime!
   * - 'frantic2' (2.5s .. 0s): ~7.4x speed (every 135ms: تیک‌تیک‌تیک‌تیک‌تیک‌تیک) crescendo to 00:00!
   */
  onTimerSubTick(params: {
    remainingMs: number | null;
    remainingSeconds: number | null;
    elapsedSeconds: number;
    stage: TimerTickStage;
    isDownbeat: boolean;
    soundEnabled: boolean;
    tickSoundEnabled: boolean;
    vibrationEnabled?: boolean;
  }) {
    const {
      remainingMs,
      remainingSeconds,
      elapsedSeconds,
      stage,
      isDownbeat,
      soundEnabled,
      tickSoundEnabled,
      vibrationEnabled = false,
    } = params;

    if (!soundEnabled) return;

    if (stage === 'normal') {
      if (!tickSoundEnabled) return;
      const basis = remainingSeconds ?? elapsedSeconds;
      const isEven = basis % 2 === 0;
      this.playStopwatchTick({
        pitchScale: isEven ? 1.04 : 0.88,
        gainPeak: 0.16,
      });
      return;
    }

    // Final 10 seconds ALWAYS play when master sound is enabled for maximum excitement!
    const remMs = remainingMs ?? 5000;

    if (stage === 'fast10') {
      // 10.0s -> 5.0s: 2 ticks per second (every 500ms)
      const progress10to5 = Math.max(0, Math.min(1, (10_000 - remMs) / 5_000));
      this.playStopwatchTick({
        pitchScale: (isDownbeat ? 1.08 : 1.18) + progress10to5 * 0.1,
        gainPeak: isDownbeat ? 0.25 : 0.2,
      });
      if (isDownbeat) {
        this.playPunchyKick(0, 0.18, 110, 42, 0.11);
        this.playBellChime({
          freq: 440 + progress10to5 * 83.25,
          durationSec: 0.12,
          gainPeak: 0.09,
          sendReverb: false,
        });
      }
      return;
    }

    if (stage === 'faster5') {
      // 5.0s -> 2.5s: 4 rapid ticks per second (every 250ms)
      const progress5to2 = Math.max(0, Math.min(1, (5_000 - remMs) / 2_500));
      this.playStopwatchTick({
        pitchScale: 1.24 + progress5to2 * 0.2,
        gainPeak: isDownbeat ? 0.29 : 0.23,
      });
      if (isDownbeat) {
        this.vibrate(18, vibrationEnabled);
        this.playPunchyKick(0, 0.24, 125, 45, 0.11);
        this.playBellChime({
          freq: 587.33 + progress5to2 * 196,
          durationSec: 0.13,
          gainPeak: 0.14,
          sendReverb: false,
        });
      }
      return;
    }

    // stage === 'frantic2' (2.5s -> 0.08s): ~7.4 rapid ticks per second (every 135ms)!
    const progress2to0 = Math.max(0, Math.min(1, (2_500 - remMs) / 2_500));
    this.playStopwatchTick({
      pitchScale: 1.46 + progress2to0 * 0.34,
      gainPeak: isDownbeat ? 0.32 : 0.26,
    });
    if (isDownbeat) {
      this.vibrate(25, vibrationEnabled);
      this.playPunchyKick(0, 0.28, 140, 48, 0.1);
      this.playBellChime({
        freq: 880 + progress2to0 * 294,
        durationSec: 0.11,
        gainPeak: 0.16,
        sendReverb: false,
      });
    }
  }

  /**
   * Joyful, Dopamine-Packed TV Game-Show Correct Answer Celebration!
   * Includes punchy kick, snappy clap, warm brass + celesta Major-9th chord,
   * plus extra sparkling glissando when earning speed bonus or solving Golden!
   */
  onCorrect(
    soundEnabled: boolean,
    vibrationEnabled: boolean,
    options: { isGolden?: boolean; hasSpeedBonus?: boolean } = {}
  ) {
    const { isGolden = false, hasSpeedBonus = false } = options;
    this.vibrate(
      isGolden ? [75, 35, 95, 35, 160] : [55, 25, 90],
      vibrationEnabled
    );
    if (!soundEnabled) return;

    if (isGolden) {
      // Epic 30-Point Golden Victory Fanfare!
      this.playPunchyKick(0, 0.4, 170, 42, 0.18);
      this.playPunchyKick(0.32, 0.44, 180, 40, 0.22);
      this.playSnappyClap(0.16, 0.22);
      this.playSnappyClap(0.32, 0.26);
      this.playSnappyClap(0.52, 0.26);

      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      fanfare.forEach((f, idx) => {
        const isLast = idx === fanfare.length - 1;
        this.playWarmBrass({
          freq: f * 0.5,
          durationSec: isLast ? 0.68 : 0.16,
          delaySec: idx * 0.08,
          gainPeak: 0.2,
        });
        this.playBellChime({
          freq: f,
          durationSec: isLast ? 0.78 : 0.24,
          delaySec: idx * 0.08,
          gainPeak: 0.28,
        });
      });
      return;
    }

    // Standard Correct Word Solved: Crisp rhythm + Lush D Major 9 celebration!
    this.playPunchyKick(0, 0.34, 160, 44, 0.15);
    this.playSnappyClap(0.17, 0.22);

    const arpeggio = [
      { f: 587.33, d: 0.0, dur: 0.18 },   // D5
      { f: 739.99, d: 0.06, dur: 0.18 },  // F#5
      { f: 880.0, d: 0.12, dur: 0.2 },    // A5
      { f: 1174.66, d: 0.18, dur: 0.52 }, // D6
    ];
    arpeggio.forEach((n) => {
      this.playBellChime({ freq: n.f, durationSec: n.dur, delaySec: n.d, gainPeak: 0.27 });
    });

    // Warm harmonic chord bed at 0.18s (D4 + F#5 + E6 Major 9th!)
    this.playWarmBrass({ freq: 293.66, durationSec: 0.42, delaySec: 0.18, gainPeak: 0.2 });
    this.playWarmBrass({ freq: 587.33, durationSec: 0.42, delaySec: 0.18, gainPeak: 0.18 });
    this.playBellChime({ freq: 1318.51, durationSec: 0.48, delaySec: 0.21, gainPeak: 0.18 });

    // Extra dazzling harp sparkle when earning Speed Bonus!
    if (hasSpeedBonus) {
      const sparkle = [1479.98, 1760.0, 2217.46, 2349.32];
      sparkle.forEach((f, idx) => {
        this.playBellChime({
          freq: f,
          durationSec: 0.28,
          delaySec: 0.28 + idx * 0.048,
          gainPeak: 0.2,
        });
      });
    }
  }

  /** Warm TV Game-Show Muted Trombone "Uh-Oh" on Wrong Guess / Foul */
  onWrongGuess(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([45, 30, 65], vibrationEnabled);
    if (!soundEnabled) return;

    this.playWarmBrass({
      freq: 311.13, // Eb4
      endFreq: 293.66,
      durationSec: 0.14,
      delaySec: 0,
      gainPeak: 0.22,
      brightnessHz: 1200,
    });
    this.playWarmBrass({
      freq: 233.08, // Bb3
      endFreq: 196.0,
      durationSec: 0.28,
      delaySec: 0.14,
      gainPeak: 0.26,
      brightnessHz: 950,
    });
  }

  /** Crisp Card-Flip Swoosh + 2-Note Descending Marimba (-1 Swap) */
  onSwap(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate(38, vibrationEnabled);
    if (!soundEnabled) return;
    this.playStopwatchTick({ pitchScale: 1.15, gainPeak: 0.18, delaySec: 0 });
    this.playBellChime({ freq: 783.99, durationSec: 0.13, delaySec: 0, gainPeak: 0.2, sendReverb: false });
    this.playBellChime({ freq: 523.25, durationSec: 0.2, delaySec: 0.075, gainPeak: 0.22 });
  }

  /** Dramatic Stadium Time's-Up Horn & Gong Impact when 00:00 expires! */
  onTimeUp(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([190, 65, 250], vibrationEnabled);
    if (!soundEnabled) return;

    this.playPunchyKick(0, 0.45, 160, 36, 0.28);
    this.playPunchyKick(0.38, 0.45, 145, 34, 0.34);

    // Classic 3-step game-show horn: G4 -> Eb4 -> C4 (rich unison brass)
    this.playWarmBrass({
      freq: 392.0,
      durationSec: 0.2,
      delaySec: 0,
      gainPeak: 0.26,
      brightnessHz: 2100,
    });
    this.playWarmBrass({
      freq: 311.13,
      durationSec: 0.2,
      delaySec: 0.19,
      gainPeak: 0.26,
      brightnessHz: 1900,
    });
    this.playWarmBrass({
      freq: 261.63,
      endFreq: 220.0,
      durationSec: 0.62,
      delaySec: 0.38,
      gainPeak: 0.32,
      brightnessHz: 1700,
    });
    this.playWarmBrass({
      freq: 130.81,
      endFreq: 110.0,
      durationSec: 0.65,
      delaySec: 0.38,
      gainPeak: 0.28,
      brightnessHz: 950,
    });
  }

  /** Dramatic Final Round Herald when Golden 30-Point Challenge unlocks! */
  onFinalRound(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([50, 35, 50, 35, 120], vibrationEnabled);
    if (!soundEnabled) return;

    this.playPunchyKick(0, 0.36, 160, 42, 0.18);
    this.playPunchyKick(0.36, 0.4, 175, 40, 0.22);

    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, idx) => {
      const isLast = idx === notes.length - 1;
      this.playWarmBrass({
        freq: f * 0.5,
        durationSec: isLast ? 0.55 : 0.14,
        delaySec: idx * 0.095,
        gainPeak: 0.2,
      });
      this.playBellChime({
        freq: f,
        durationSec: isLast ? 0.62 : 0.2,
        delaySec: idx * 0.095,
        gainPeak: 0.24,
      });
    });
  }

  /** Grand Championship Victory Melody + Studio Claps on Game Over */
  onVictory(soundEnabled: boolean, vibrationEnabled: boolean) {
    this.vibrate([85, 40, 85, 40, 220], vibrationEnabled);
    if (!soundEnabled) return;

    this.playPunchyKick(0, 0.4, 170, 42, 0.18);
    this.playPunchyKick(0.33, 0.4, 170, 42, 0.18);
    this.playPunchyKick(0.76, 0.46, 180, 38, 0.25);

    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
    const delays = [0, 0.105, 0.21, 0.33, 0.5, 0.62, 0.76];
    melody.forEach((f, idx) => {
      const isLast = idx === melody.length - 1;
      this.playWarmBrass({
        freq: f * 0.5,
        durationSec: isLast ? 0.75 : 0.16,
        delaySec: delays[idx],
        gainPeak: 0.22,
      });
      this.playBellChime({
        freq: f,
        durationSec: isLast ? 0.85 : 0.22,
        delaySec: delays[idx],
        gainPeak: 0.28,
      });
    });

    // Final rich C Major 9 chord harmony at 0.76s
    this.playBellChime({ freq: 1567.98, durationSec: 0.85, delaySec: 0.78, gainPeak: 0.24 });
    this.playBellChime({ freq: 1174.66, durationSec: 0.85, delaySec: 0.8, gainPeak: 0.22 });

    // Celebratory studio crowd claps
    [0.33, 0.5, 0.64, 0.76, 0.92, 1.08].forEach((d) => {
      this.playSnappyClap(d, 0.22);
    });
  }
}

export const feedbackEngine = new FeedbackEngine();
