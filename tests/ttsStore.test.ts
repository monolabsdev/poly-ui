import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {},
  invoke,
}));

import { setTtsSettings, useTtsStore } from "../src/store/ttsStore";

const play = vi.fn(() => Promise.resolve());

class TestAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string;

  constructor(src: string) {
    this.src = src;
  }

  play = play;
  pause = vi.fn();
}

describe("tts store", () => {
  beforeEach(() => {
    invoke.mockReset();
    play.mockClear();
    setTtsSettings({
      engine: "auto",
      browser: { voiceURI: "", speed: 1, pitch: 1 },
      supertonic: { voiceName: "M1", speed: 1, totalStep: 10, silenceDuration: 0.3 },
    });
    useTtsStore.getState().actions.stop();
    Object.defineProperty(globalThis, "window", {
      value: {},
      configurable: true,
    });
    Object.defineProperty(globalThis, "Audio", {
      value: TestAudio,
      configurable: true,
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:supertonic"),
      configurable: true,
    });
  });

  it("falls back to Supertonic when native speech synthesis is unavailable", async () => {
    invoke
      .mockResolvedValueOnce({ engineLoaded: false, currentVoice: "", sampleRate: 44100 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ wavBase64: "UklGRg==", durationSecs: 1, sampleRate: 44100 });

    await useTtsStore.getState().actions.play("m1", "hello");

    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|get_status");
    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|load_model", expect.any(Object));
    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|synthesize", expect.objectContaining({ text: "hello" }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(useTtsStore.getState().isPlaying).toBe(true);
  });

  it("passes selected Supertonic voice and synthesis settings to the plugin", async () => {
    setTtsSettings({
      engine: "supertonic",
      browser: { voiceURI: "", speed: 1, pitch: 1 },
      supertonic: { voiceName: "F2", speed: 1.4, totalStep: 12, silenceDuration: 0.15 },
    });
    invoke
      .mockResolvedValueOnce({ engineLoaded: false, currentVoice: "", sampleRate: 44100 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ wavBase64: "UklGRg==", durationSecs: 1, sampleRate: 44100 });

    await useTtsStore.getState().actions.play("m1", "hello");

    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|load_model", expect.objectContaining({ voiceStyle: "F2" }));
    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|synthesize", expect.objectContaining({
      speed: 1.4,
      totalStep: 12,
      silenceDuration: 0.15,
    }));
  });
});
