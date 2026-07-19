import { describe, expect, it } from "vitest";
import {
  advanceBargeIn,
  advanceVoiceActivity,
  createBargeInState,
  createVoiceActivityState,
} from "../src/lib/dictation/voiceActivity";

describe("voice activity detection", () => {
  it("stops after speech followed by sustained silence", () => {
    let state = createVoiceActivityState(0);
    for (const [level, now] of [
      [0.002, 100],
      [0.002, 400],
      [0.03, 600],
      [0.035, 950],
      [0.001, 1_200],
    ] as const) {
      state = advanceVoiceActivity(state, level, now).state;
    }

    expect(advanceVoiceActivity(state, 0.001, 2_101).shouldStop).toBe(true);
  });

  it("never sends room silence before speech", () => {
    let state = createVoiceActivityState(0);
    for (let now = 100; now <= 10_000; now += 100) {
      const result = advanceVoiceActivity(state, 0.002, now);
      state = result.state;
      expect(result.shouldStop).toBe(false);
    }
  });

  it("calibrates above steady background noise", () => {
    let state = createVoiceActivityState(0);
    state = advanceVoiceActivity(state, 0.004, 100).state;
    state = advanceVoiceActivity(state, 0.004, 400).state;
    state = advanceVoiceActivity(state, 0.006, 700).state;
    expect(state.speechStartedAt).toBeNull();

    state = advanceVoiceActivity(state, 0.03, 800).state;
    expect(state.speechStartedAt).toBe(800);
  });

  it("caps a long turn at the next pause after thirty seconds", () => {
    let state = createVoiceActivityState(0);
    // Continuous modulated speech straight through the soft cap.
    for (let now = 100; now <= 30_500; now += 100) {
      const result = advanceVoiceActivity(state, now % 200 === 0 ? 0.06 : 0.03, now);
      state = result.state;
      expect(result.shouldStop).toBe(false);
    }

    // The first breath pause past the cap ends the turn, well before the
    // normal 900ms end-of-turn silence.
    state = advanceVoiceActivity(state, 0.001, 30_600).state;
    expect(advanceVoiceActivity(state, 0.001, 30_900).shouldStop).toBe(true);
  });

  it("hard-stops a turn that never pauses by forty-five seconds", () => {
    let state = createVoiceActivityState(0);
    let stopped = false;
    for (let now = 100; now <= 45_100 && !stopped; now += 100) {
      const result = advanceVoiceActivity(state, now % 200 === 0 ? 0.06 : 0.03, now);
      state = result.state;
      stopped = result.shouldStop;
    }
    expect(stopped).toBe(true);
  });

  it("a higher sensitivity hears speech a lower one ignores", () => {
    const speakQuietly = (sensitivity: number) => {
      let state = createVoiceActivityState(0);
      for (let now = 100; now <= 500; now += 100) {
        state = advanceVoiceActivity(state, 0.001, now, sensitivity).state;
      }
      const levels = [0.003, 0.005, 0.002, 0.004] as const;
      levels.forEach((level, index) => {
        state = advanceVoiceActivity(state, level, 600 + index * 100, sensitivity).state;
      });
      return state.speechStartedAt !== null;
    };

    expect(speakQuietly(2)).toBe(true);
    expect(speakQuietly(0.5)).toBe(false);
  });

  it("detects speech that starts immediately", () => {
    let state = createVoiceActivityState(0);
    state = advanceVoiceActivity(state, 0.03, 100).state;
    state = advanceVoiceActivity(state, 0.05, 200).state;

    expect(state.speechStartedAt).toBe(200);
  });

  it("hears quiet mumbled speech above a low noise floor", () => {
    let state = createVoiceActivityState(0);
    for (let now = 100; now <= 500; now += 100) {
      state = advanceVoiceActivity(state, 0.0015, now).state;
    }

    const mumble = [0.006, 0.009, 0.004, 0.008, 0.005, 0.009] as const;
    mumble.forEach((level, index) => {
      state = advanceVoiceActivity(state, level, 600 + index * 100).state;
    });
    expect(state.speechStartedAt).not.toBeNull();

    let stopped = false;
    for (let now = 1_300; now <= 2_400; now += 100) {
      const result = advanceVoiceActivity(state, 0.0015, now);
      state = result.state;
      stopped ||= result.shouldStop;
    }
    expect(stopped).toBe(true);
  });

  it("ignores a loud steady hum present from the start", () => {
    let state = createVoiceActivityState(0);
    for (let now = 100; now <= 8_000; now += 100) {
      const result = advanceVoiceActivity(state, 0.02, now);
      state = result.state;
      expect(result.shouldStop).toBe(false);
    }
    expect(state.speechStartedAt).toBeNull();
  });

  it("does not let a hum that starts mid-listen hold a turn open", () => {
    let state = createVoiceActivityState(0);
    for (let now = 100; now <= 1_000; now += 100) {
      state = advanceVoiceActivity(state, 0.0015, now).state;
    }

    let stoppedAt: number | null = null;
    for (let now = 1_100; now <= 15_000; now += 100) {
      const result = advanceVoiceActivity(state, 0.02, now);
      state = result.state;
      if (result.shouldStop) {
        stoppedAt = now;
        break;
      }
    }
    // The hum onset may register briefly, but the modulation hold must end
    // the turn long before the 30s cap.
    if (stoppedAt !== null) {
      expect(stoppedAt).toBeLessThan(8_000);
    } else {
      expect(state.speechStartedAt).toBeNull();
    }
  });

  it("does not trigger on steady background noise below speech level", () => {
    let state = createVoiceActivityState(0);
    for (let now = 100; now <= 5_000; now += 100) {
      const result = advanceVoiceActivity(state, 0.005, now);
      state = result.state;
      expect(result.shouldStop).toBe(false);
    }
    expect(state.speechStartedAt).toBeNull();

    state = advanceVoiceActivity(state, 0.04, 5_100).state;
    expect(state.speechStartedAt).toBe(5_100);
  });

  it("barge-in ignores steady playback echo", () => {
    let state = createBargeInState(0);
    for (let now = 100; now <= 6_000; now += 100) {
      const level = 0.005 + (now % 300 === 0 ? 0.002 : 0);
      const result = advanceBargeIn(state, level, 0.25, now);
      state = result.state;
      expect(result.shouldInterrupt).toBe(false);
    }
  });

  it("barge-in triggers on sustained loud speech over playback", () => {
    let state = createBargeInState(0);
    for (let now = 100; now <= 1_000; now += 100) {
      state = advanceBargeIn(state, 0.004, 0.25, now).state;
    }

    let interrupted = false;
    for (let now = 1_100; now <= 1_600; now += 100) {
      const result = advanceBargeIn(state, 0.05, 0.25, now);
      state = result.state;
      interrupted ||= result.shouldInterrupt;
    }
    expect(interrupted).toBe(true);
  });

  it("barge-in ignores a brief spike", () => {
    let state = createBargeInState(0);
    for (let now = 100; now <= 1_000; now += 100) {
      state = advanceBargeIn(state, 0.004, 0.25, now).state;
    }

    expect(advanceBargeIn(state, 0.06, 0.25, 1_100).shouldInterrupt).toBe(false);
    expect(advanceBargeIn(state, 0.004, 0.25, 1_200).shouldInterrupt).toBe(false);
  });

  it("barge-in ignores mic level that tracks loud playback output", () => {
    // Loud room playback: the mic hears ~10% of the output level. The echo
    // gain learned during calibration keeps the correlated echo below the
    // interrupt threshold even when it is objectively loud.
    let state = createBargeInState(0);
    for (let now = 100; now <= 5_000; now += 100) {
      const output = 0.2 + (now % 400 === 0 ? 0.3 : 0);
      const result = advanceBargeIn(state, output * 0.1, output, now);
      state = result.state;
      expect(result.shouldInterrupt).toBe(false);
    }
  });

  it("barge-in triggers fast when the user speaks into a playback gap", () => {
    let state = createBargeInState(0);
    for (let now = 100; now <= 2_000; now += 100) {
      state = advanceBargeIn(state, 0.02, 0.25, now).state;
    }

    // Playback pauses between sentences (output near zero); the same mic
    // level that was echo before is now clearly the user.
    let interrupted = false;
    for (let now = 2_100; now <= 2_600; now += 100) {
      const result = advanceBargeIn(state, 0.05, 0.001, now);
      state = result.state;
      interrupted ||= result.shouldInterrupt;
    }
    expect(interrupted).toBe(true);
  });

  it("recovers noise floor when ambient level changes", () => {
    let state = createVoiceActivityState(0);
    for (let now = 100; now <= 2_000; now += 100) {
      state = advanceVoiceActivity(state, 0.006, now).state;
    }
    expect(state.speechStartedAt).toBeNull();

    state = advanceVoiceActivity(state, 0.04, 2_100).state;
    expect(state.speechStartedAt).toBe(2_100);
  });
});
