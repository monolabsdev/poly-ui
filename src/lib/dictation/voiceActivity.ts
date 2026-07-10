const CALIBRATION_MS = 500;
const SILENCE_MS = 900;
const MIN_SPEECH_MS = 250;
// Past the soft cap the turn ends at the next breath pause instead of
// mid-word; the hard cap guarantees an end even for nonstop speech.
const MAX_TURN_MS = 30_000;
const MAX_TURN_HARD_MS = 45_000;
const SOFT_STOP_SILENCE_MS = 350;
// Quiet mics put mumbled speech around 0.004-0.01 RMS; the old 0.008 floor
// cut it off. Hum rejection now comes from the modulation gate, not loudness.
const MIN_SPEECH_LEVEL = 0.004;
const SPEECH_END_MIN_LEVEL = 0.0025;
const SPEECH_START_MULTIPLIER = 3.0;
const SPEECH_END_MULTIPLIER = 1.5;
const NOISE_FLOOR_DECAY = 0.95;
const LEVEL_EMA_ALPHA = 0.2;
// Speech pulses at syllable rate, so its level swings against its own
// envelope; steady background noise (fan/fridge/hum) barely moves.
const MODULATION_RATIO = 0.25;
const MIN_MODULATION = 0.0008;
const MODULATION_HOLD_MS = 2_000;

// Barge-in: while the assistant speaks, the mic only monitors for the user
// talking over it. Two echo models combine: a slow floor learned from the mic
// itself, and a gain learned against the playback output level — mic level
// that tracks outputLevel is our own voice coming back, mic level that stands
// clear of both is the user.
const BARGE_IN_CALIBRATION_MS = 700;
const BARGE_IN_HOLD_MS = 300;
const BARGE_IN_MIN_LEVEL = 0.01;
const BARGE_IN_MULTIPLIER = 3.0;
// Playback output RMS below this carries no echo information (gaps between
// words); above it, mic/output ratio estimates the acoustic echo path.
const OUTPUT_ACTIVE_LEVEL = 0.05;

export type BargeInState = {
  startedAt: number;
  echoFloor: number;
  /** Learned mic-level per unit of playback output level (echo path gain). */
  echoGain: number;
  voiceStartedAt: number | null;
};

export function createBargeInState(now: number): BargeInState {
  return { startedAt: now, echoFloor: 0.004, echoGain: 0.05, voiceStartedAt: null };
}

export function advanceBargeIn(
  state: BargeInState,
  level: number,
  outputLevel: number,
  now: number,
): { state: BargeInState; shouldInterrupt: boolean } {
  const calibrating = now - state.startedAt <= BARGE_IN_CALIBRATION_MS;
  const outputActive = outputLevel >= OUTPUT_ACTIVE_LEVEL;
  const expectedEcho = state.echoGain * outputLevel;
  const threshold = Math.max(
    BARGE_IN_MIN_LEVEL,
    state.echoFloor * BARGE_IN_MULTIPLIER,
    expectedEcho * BARGE_IN_MULTIPLIER,
  );
  const voiced = !calibrating && level >= threshold;
  // Each model only learns from the samples it explains: the floor tracks the
  // mic while playback is quiet (room noise), the gain tracks mic/output while
  // playback is loud (echo path). Mixing them would let the floor absorb echo
  // and stay high during playback gaps — exactly when the user is easiest to
  // hear. "Voiced" samples still adapt slowly, so a loud echo raises its model
  // until it stops qualifying while a real interruption trips the hold first.
  const echoFloor = outputActive
    ? state.echoFloor
    : calibrating
      ? state.echoFloor * 0.7 + level * 0.3
      : voiced
        ? state.echoFloor * 0.95 + level * 0.05
        : state.echoFloor * 0.9 + level * 0.1;
  const observedGain = outputActive ? level / outputLevel : null;
  const echoGain =
    observedGain === null
      ? state.echoGain
      : calibrating
        ? state.echoGain * 0.5 + observedGain * 0.5
        : voiced
          ? state.echoGain * 0.95 + observedGain * 0.05
          : state.echoGain * 0.8 + observedGain * 0.2;
  const voiceStartedAt = voiced ? (state.voiceStartedAt ?? now) : null;

  return {
    state: { ...state, echoFloor, echoGain, voiceStartedAt },
    shouldInterrupt:
      voiceStartedAt !== null && now - voiceStartedAt >= BARGE_IN_HOLD_MS,
  };
}

export type VoiceActivityState = {
  startedAt: number;
  noiseFloor: number;
  emaLevel: number | null;
  speechStartedAt: number | null;
  lastVoiceAt: number | null;
  lastModulatedAt: number | null;
};

export function createVoiceActivityState(now: number): VoiceActivityState {
  return {
    startedAt: now,
    noiseFloor: 0.002,
    emaLevel: null,
    speechStartedAt: null,
    lastVoiceAt: null,
    lastModulatedAt: null,
  };
}

export function advanceVoiceActivity(
  state: VoiceActivityState,
  level: number,
  now: number,
  /** >1 hears quieter speech, <1 needs louder speech. User-tunable. */
  sensitivity = 1,
): { state: VoiceActivityState; shouldStop: boolean } {
  // Seed the envelope on the first sample so noise that is already present
  // when listening starts doesn't read as a modulation spike.
  if (state.emaLevel === null) {
    return {
      state: {
        ...state,
        emaLevel: level,
        noiseFloor: state.noiseFloor * 0.8 + level * 0.2,
      },
      shouldStop: false,
    };
  }

  const deviation = Math.abs(level - state.emaLevel);
  const emaLevel = state.emaLevel + (level - state.emaLevel) * LEVEL_EMA_ALPHA;
  const modulated = deviation >= Math.max(emaLevel * MODULATION_RATIO, MIN_MODULATION);
  const lastModulatedAt = modulated ? now : state.lastModulatedAt;

  const isSpeaking = state.speechStartedAt !== null;
  const threshold =
    (isSpeaking
      ? Math.max(SPEECH_END_MIN_LEVEL, state.noiseFloor * SPEECH_END_MULTIPLIER)
      : Math.max(MIN_SPEECH_LEVEL, state.noiseFloor * SPEECH_START_MULTIPLIER)) /
    sensitivity;
  const loud = level >= threshold;
  // Starting a turn needs loudness AND modulation; keeping one alive needs
  // loudness plus recent modulation, so a steady tone can't hold a turn open.
  const recentlyModulated =
    lastModulatedAt !== null && now - lastModulatedAt <= MODULATION_HOLD_MS;
  const hasVoice = isSpeaking ? loud && recentlyModulated : loud && modulated;

  const calibrating =
    !isSpeaking && !hasVoice && now - state.startedAt <= CALIBRATION_MS;
  const noiseFloor = calibrating
    ? state.noiseFloor * 0.8 + level * 0.2
    : !isSpeaking && !hasVoice
      ? loud && !modulated
        ? // Steady-but-loud tone (hum): climb the floor over it within ~1s so
          // thresholds rise above it and it stays ignored.
          state.noiseFloor * 0.9 + level * 0.1
        : state.noiseFloor * NOISE_FLOOR_DECAY + level * (1 - NOISE_FLOOR_DECAY)
      : state.noiseFloor;

  const speechStartedAt = state.speechStartedAt ?? (hasVoice ? now : null);
  const lastVoiceAt = hasVoice ? now : state.lastVoiceAt;
  const next = {
    ...state,
    noiseFloor,
    emaLevel,
    speechStartedAt,
    lastVoiceAt,
    lastModulatedAt,
  };
  const enoughSpeech =
    speechStartedAt !== null &&
    lastVoiceAt !== null &&
    lastVoiceAt - speechStartedAt >= MIN_SPEECH_MS;

  // A blip (keyboard click, hum onset) that never accumulates real speech is
  // abandoned instead of pinning the turn open until the 30s cap fires.
  if (
    speechStartedAt !== null &&
    !enoughSpeech &&
    lastVoiceAt !== null &&
    now - lastVoiceAt >= SILENCE_MS
  ) {
    return {
      state: { ...next, speechStartedAt: null, lastVoiceAt: null },
      shouldStop: false,
    };
  }

  const silenceEndedTurn = enoughSpeech && now - lastVoiceAt >= SILENCE_MS;
  const overSoftCap =
    speechStartedAt !== null && now - state.startedAt >= MAX_TURN_MS;
  const turnTimedOut =
    overSoftCap &&
    (now - state.startedAt >= MAX_TURN_HARD_MS ||
      (lastVoiceAt !== null && now - lastVoiceAt >= SOFT_STOP_SILENCE_MS));

  return { state: next, shouldStop: silenceEndedTurn || turnTimedOut };
}
