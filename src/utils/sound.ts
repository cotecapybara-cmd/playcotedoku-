// Cozy acoustic coffee-shop Web Audio API synthesizer for PLAYCOTEDOKU
// Uses warm wooden marimba/kalimba bodies, soft felt-piano harmonics, micro noise transients,
// and mobile gesture unlocking so every cue plays cleanly without overlap or harsh beeps.

let audioCtx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let musicInterval: number | null = null;
let musicEnabledState = false;
let soundEnabledState = true;
let unlockListenersAttached = false;

let activeShortVoices: Array<{ stopAt: (t: number) => void; duck: (t: number) => void }> = [];
let lastShortSfxTimestampMs = 0;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock AudioContext synchronously inside user gestures for iOS Safari & mobile Chrome
export function unlockAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    // ignore unlock errors in restricted environments
  }
}

function attachGlobalMobileUnlock(): void {
  if (typeof window === 'undefined' || unlockListenersAttached) return;
  unlockListenersAttached = true;
  const onGesture = () => {
    unlockAudio();
  };
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('touchstart', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture, { passive: true });
}

attachGlobalMobileUnlock();

function getSfxBus(ctx: AudioContext): AudioNode {
  if (sfxBus) return sfxBus;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.85, ctx.currentTime);

  if (typeof ctx.createDynamicsCompressor === 'function') {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-16, ctx.currentTime);
    comp.knee.setValueAtTime(18, ctx.currentTime);
    comp.ratio.setValueAtTime(6, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.08, ctx.currentTime);
    master.connect(comp);
    comp.connect(ctx.destination);
  } else {
    master.connect(ctx.destination);
  }

  sfxBus = master;
  return sfxBus;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
  if (noiseBuffer) return noiseBuffer;
  if (typeof ctx.createBuffer !== 'function') return null;

  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.08));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Warm pink-tinted decay noise
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  noiseBuffer = buffer;
  return noiseBuffer;
}

function duckShortVoices(now: number): void {
  if (activeShortVoices.length === 0) return;
  for (const v of activeShortVoices) {
    v.duck(now);
    v.stopAt(now + 0.02);
  }
  activeShortVoices = [];
}

// Subtle organic pitch variation (±1.2%) so repetitive taps feel handmade & cozy
function jitter(freq: number, amount = 0.024): number {
  return freq * (1 + (Math.random() - 0.5) * amount);
}

// Synthesize an acoustic wooden marimba / felt-piano pluck with micro mallet transient
function playWoodenPluck(
  ctx: AudioContext,
  opts: {
    freq: number;
    endFreq?: number;
    startTime?: number;
    duration: number;
    volume: number;
    cutoffHz?: number;
    harmonicGain?: number;
    malletNoiseGain?: number;
    malletCenterHz?: number;
    chokePrevious?: boolean;
  }
): void {
  const start = opts.startTime ?? ctx.currentTime;
  const bus = getSfxBus(ctx);

  if (opts.chokePrevious) {
    duckShortVoices(start);
  }

  // 1. Warm wooden fundamental body
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, opts.endFreq), start + opts.duration * 0.75);
  }

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(opts.cutoffHz ?? 1250, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(opts.volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bus);

  osc.start(start);
  osc.stop(start + opts.duration + 0.02);

  // 2. Optional soft octave overtone for felt-piano / celesta warmth
  let overOsc: OscillatorNode | null = null;
  let overGain: GainNode | null = null;
  if (opts.harmonicGain && opts.harmonicGain > 0) {
    overOsc = ctx.createOscillator();
    overGain = ctx.createGain();
    overOsc.type = 'sine';
    overOsc.frequency.setValueAtTime(opts.freq * 2, start);
    overGain.gain.setValueAtTime(0.0001, start);
    overGain.gain.linearRampToValueAtTime(opts.harmonicGain, start + 0.005);
    overGain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration * 0.55);
    overOsc.connect(overGain);
    overGain.connect(filter);
    overOsc.start(start);
    overOsc.stop(start + opts.duration * 0.6 + 0.01);
  }

  // 3. Optional ultra-brief wooden/felt mallet transient (< 12ms)
  if (
    opts.malletNoiseGain &&
    opts.malletNoiseGain > 0 &&
    typeof ctx.createBufferSource === 'function'
  ) {
    const nBuf = getNoiseBuffer(ctx);
    if (nBuf) {
      const nSrc = ctx.createBufferSource();
      const nFilter = ctx.createBiquadFilter();
      const nGain = ctx.createGain();
      nSrc.buffer = nBuf;
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(opts.malletCenterHz ?? 950, start);
      nGain.gain.setValueAtTime(opts.malletNoiseGain, start);
      nGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.014);
      nSrc.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(bus);
      nSrc.start(start);
      nSrc.stop(start + 0.018);
    }
  }

  if (opts.chokePrevious) {
    activeShortVoices.push({
      duck: (t: number) => {
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(0.01, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);
          if (overGain) {
            overGain.gain.cancelScheduledValues(t);
            overGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
          }
        } catch {
          // ignore
        }
      },
      stopAt: (t: number) => {
        try {
          osc.stop(t);
          overOsc?.stop(t);
        } catch {
          // ignore
        }
      },
    });
  }
}

function canFireShortSfx(minGapMs = 34): boolean {
  if (!soundEnabledState) return false;
  const nowMs = Date.now();
  if (nowMs - lastShortSfxTimestampMs < minGapMs) {
    return false;
  }
  lastShortSfxTimestampMs = nowMs;
  return true;
}

export function setAudioPreferences(soundEnabled: boolean, musicEnabled: boolean) {
  soundEnabledState = soundEnabled;
  if (musicEnabled !== musicEnabledState) {
    musicEnabledState = musicEnabled;
    if (musicEnabled) {
      startAmbientMusic();
    } else {
      stopAmbientMusic();
    }
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabledState;
}

// 1. CUTE PUZZLE OPENING SOUND (~420ms cozy cafe bell/marimba welcome)
// Returns a Promise that resolves once the introductory chime finishes (or 0ms if muted)
export function playPuzzleStartSound(): Promise<void> {
  if (!soundEnabledState) {
    return Promise.resolve();
  }
  const ctx = getCtx();
  if (!ctx) {
    return Promise.resolve();
  }

  const now = ctx.currentTime;
  duckShortVoices(now);

  // Cozy Fmaj9 welcome arpeggio: F4 -> A4 -> C5 -> G5
  const notes = [349.23, 440.0, 523.25, 783.99];
  notes.forEach((freq, i) => {
    playWoodenPluck(ctx, {
      freq,
      startTime: now + i * 0.085,
      duration: i === notes.length - 1 ? 0.24 : 0.14,
      volume: i === notes.length - 1 ? 0.04 : 0.034,
      cutoffHz: 1400,
      harmonicGain: 0.009,
      malletNoiseGain: 0.008,
      malletCenterHz: 1100,
    });
  });

  return new Promise((resolve) => {
    window.setTimeout(resolve, 420);
  });
}

// 2. NUMBER PLACEMENT: Warm wooden coaster / felt tile "thock-pop"
export function playTapSound() {
  if (!canFireShortSfx(34)) return;
  const ctx = getCtx();
  if (!ctx) return;

  playWoodenPluck(ctx, {
    freq: jitter(310),
    endFreq: 225,
    duration: 0.044,
    volume: 0.038,
    cutoffHz: 1100,
    harmonicGain: 0.007,
    malletNoiseGain: 0.015,
    malletCenterHz: 880,
    chokePrevious: true,
  });
}

// 3. BUTTON CLICKS & NUMBER PAD SELECT: Gentle wooden kalimba/marimba keys
const KALIMBA_WARM_HZ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

export function playNumberSelectSound(digit?: number) {
  if (!canFireShortSfx(32)) return;
  const ctx = getCtx();
  if (!ctx) return;

  const idx = digit && digit >= 1 && digit <= 9 ? digit - 1 : 2;
  const freq = jitter(KALIMBA_WARM_HZ[idx], 0.012);
  playWoodenPluck(ctx, {
    freq,
    duration: 0.065,
    volume: 0.03,
    cutoffHz: 1150,
    harmonicGain: 0.006,
    malletNoiseGain: 0.009,
    malletCenterHz: 1050,
    chokePrevious: true,
  });
}

export function playButtonClickSound() {
  if (!canFireShortSfx(36)) return;
  const ctx = getCtx();
  if (!ctx) return;

  playWoodenPluck(ctx, {
    freq: jitter(255),
    endFreq: 195,
    duration: 0.028,
    volume: 0.026,
    cutoffHz: 950,
    malletNoiseGain: 0.012,
    malletCenterHz: 1150,
    chokePrevious: true,
  });
}

// 4. MENU INTERACTIONS: Soft paper-turn / cafe breeze glide
export function playMenuTransitionSound() {
  if (!canFireShortSfx(75)) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playWoodenPluck(ctx, {
    freq: 293.66,
    endFreq: 392.0,
    startTime: now,
    duration: 0.075,
    volume: 0.018,
    cutoffHz: 850,
    malletNoiseGain: 0.008,
    malletCenterHz: 700,
    chokePrevious: true,
  });
}

// Soft chalk/paper brush when erasing or clearing a number
export function playEraseSound() {
  if (!canFireShortSfx(34)) return;
  const ctx = getCtx();
  if (!ctx) return;

  playWoodenPluck(ctx, {
    freq: jitter(330),
    endFreq: 235,
    duration: 0.045,
    volume: 0.024,
    cutoffHz: 900,
    malletNoiseGain: 0.016,
    malletCenterHz: 720,
    chokePrevious: true,
  });
}

// Warm ceramic switch for Pencil, Fast Pencil, and Sound toggles
export function playToggleSound(enabled: boolean) {
  if (!canFireShortSfx(40)) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playWoodenPluck(ctx, {
    freq: enabled ? 392.0 : 493.88,
    endFreq: enabled ? 523.25 : 369.99,
    startTime: now,
    duration: 0.06,
    volume: 0.028,
    cutoffHz: 1150,
    malletNoiseGain: 0.008,
    malletCenterHz: 1000,
    chokePrevious: true,
  });
}

// 5. CORRECT ANSWER: Cute cozy two-note tea-bell / kalimba sparkle
export function playCorrectSound() {
  if (!canFireShortSfx(32)) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  duckShortVoices(now);
  playWoodenPluck(ctx, {
    freq: jitter(523.25, 0.01),
    startTime: now,
    duration: 0.085,
    volume: 0.032,
    cutoffHz: 1300,
    harmonicGain: 0.008,
    malletNoiseGain: 0.007,
    malletCenterHz: 1000,
  });
  playWoodenPluck(ctx, {
    freq: jitter(659.25, 0.01),
    startTime: now + 0.045,
    duration: 0.125,
    volume: 0.036,
    cutoffHz: 1350,
    harmonicGain: 0.009,
    chokePrevious: true,
  });
}

// 6. INCORRECT ANSWER: Gentle muted felt woodblock nudge (zero harshness)
export function playMistakeSound() {
  if (!canFireShortSfx(45)) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  duckShortVoices(now);
  playWoodenPluck(ctx, {
    freq: 246.94,
    endFreq: 196.0,
    startTime: now,
    duration: 0.095,
    volume: 0.034,
    cutoffHz: 520,
    malletNoiseGain: 0.009,
    malletCenterHz: 480,
    chokePrevious: true,
  });
}

// 7. PUZZLE COMPLETION: Cheerful soft coffee-shop music-box melody
export function playVictorySound() {
  if (!soundEnabledState) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  duckShortVoices(now);

  // Warm C4 bass cushion
  playWoodenPluck(ctx, {
    freq: 261.63,
    startTime: now,
    duration: 0.55,
    volume: 0.022,
    cutoffHz: 700,
  });

  const melody = [523.25, 659.25, 783.99, 987.77, 1174.66, 1046.5];
  melody.forEach((freq, i) => {
    playWoodenPluck(ctx, {
      freq,
      startTime: now + i * 0.09,
      duration: i === melody.length - 1 ? 0.34 : 0.22,
      volume: 0.034,
      cutoffHz: 1450,
      harmonicGain: 0.008,
      malletNoiseGain: 0.006,
      malletCenterHz: 1050,
    });
  });
}

// Cozy warm Rhodes-style progression for coffee shop background ambiance
const LOFI_CHORDS = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 349.23], // G7
];
let chordIdx = 0;

function playAmbientChord() {
  if (!musicEnabledState) return;
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;

  const chord = LOFI_CHORDS[chordIdx % LOFI_CHORDS.length];
  chordIdx++;

  const now = ctx.currentTime;
  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.04);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, now);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.04);
    gain.gain.linearRampToValueAtTime(0.018, now + idx * 0.04 + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.04);
    osc.stop(now + 3.5);
  });
}

export function startAmbientMusic() {
  if (musicInterval !== null) return;
  musicEnabledState = true;
  playAmbientChord();
  musicInterval = window.setInterval(playAmbientChord, 3600);
}

export function stopAmbientMusic() {
  musicEnabledState = false;
  if (musicInterval !== null) {
    window.clearInterval(musicInterval);
    musicInterval = null;
  }
}
