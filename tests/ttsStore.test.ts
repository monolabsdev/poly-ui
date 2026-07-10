import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: ((message: unknown) => void) | null = null;
  },
  invoke,
}));

import { setTtsSettings, speakableSentencePrefix, useTtsStore } from "../src/store/ttsStore";

const sourceStarted = vi.fn();

class FakeAnalyser {
  fftSize = 0;
  frequencyBinCount = 128;
  connect = vi.fn();
  getByteTimeDomainData = vi.fn();
}

class FakeBufferSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = (at: number) => sourceStarted(at);
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  createAnalyser = () => new FakeAnalyser();
  createBuffer = (_channels: number, length: number, sampleRate: number) => ({
    duration: length / sampleRate,
    copyToChannel: vi.fn(),
  });
  createBufferSource = () => new FakeBufferSource();
}

const pcmBase64 = Buffer.from(new Float32Array([0.25, -0.25, 0.5, -0.5]).buffer).toString(
  "base64",
);

type StreamChannel = { onmessage: ((message: unknown) => void) | null };

const mockSupertonicInvoke = () => {
  invoke.mockImplementation((command: unknown, args?: unknown) => {
    if (command === "plugin:supertonic|get_status") {
      return Promise.resolve({ engineLoaded: false, currentVoice: "", sampleRate: 44100 });
    }
    if (command === "plugin:supertonic|synthesize_stream") {
      const channel = (args as { onChunk: StreamChannel }).onChunk;
      channel.onmessage?.({
        pcmBase64,
        sampleRate: 44100,
        durationSecs: 0.1,
        chunkIndex: 0,
        isLast: true,
      });
      return Promise.resolve(undefined);
    }
    return Promise.resolve(undefined);
  });
};

describe("tts store", () => {
  beforeEach(() => {
    invoke.mockReset();
    sourceStarted.mockClear();
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
    Object.defineProperty(globalThis, "AudioContext", {
      value: FakeAudioContext,
      configurable: true,
    });
  });

  it("falls back to Supertonic and speaks streamed chunks as they arrive", async () => {
    mockSupertonicInvoke();

    await useTtsStore.getState().actions.play("m1", "hello");

    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|get_status");
    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|load_model", expect.any(Object));
    expect(invoke).toHaveBeenCalledWith(
      "plugin:supertonic|synthesize_stream",
      expect.objectContaining({ text: "hello" }),
    );
    expect(sourceStarted).toHaveBeenCalledTimes(1);
    expect(useTtsStore.getState().isPlaying).toBe(true);
  });

  it("passes selected Supertonic voice and synthesis settings to the plugin", async () => {
    setTtsSettings({
      engine: "supertonic",
      browser: { voiceURI: "", speed: 1, pitch: 1 },
      supertonic: { voiceName: "F2", speed: 1.4, totalStep: 12, silenceDuration: 0.15 },
    });
    mockSupertonicInvoke();

    await useTtsStore.getState().actions.play("m1", "hello");

    expect(invoke).toHaveBeenCalledWith("plugin:supertonic|load_model", expect.objectContaining({ voiceStyle: "F2" }));
    expect(invoke).toHaveBeenCalledWith(
      "plugin:supertonic|synthesize_stream",
      expect.objectContaining({
        speed: 1.4,
        totalStep: 12,
        silenceDuration: 0.15,
      }),
    );
  });

  it("speaks incremental chunks in order and settles after endUtterance", async () => {
    mockSupertonicInvoke();
    const actions = useTtsStore.getState().actions;

    actions.beginUtterance("m2");
    expect(useTtsStore.getState().isGenerating).toBe(true);

    await actions.speakChunk("First sentence.");
    await actions.speakChunk("Second sentence.");

    const streamCalls = invoke.mock.calls.filter(
      ([command]) => command === "plugin:supertonic|synthesize_stream",
    );
    expect(streamCalls.map(([, args]) => (args as { text: string }).text)).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
    expect(useTtsStore.getState().isPlaying).toBe(true);

    actions.endUtterance();
    // Sources never fire onended in the fake, so playback stays active.
    expect(useTtsStore.getState().isPlaying).toBe(true);
    actions.stop();
    expect(useTtsStore.getState().isPlaying).toBe(false);
  });
});

describe("speakableSentencePrefix", () => {
  it("returns only text up to the last sentence boundary", () => {
    expect(speakableSentencePrefix("Hello there. This is unfin")).toBe("Hello there.");
    expect(speakableSentencePrefix("No boundary yet")).toBe("");
    expect(speakableSentencePrefix("One. Two! Three? Four")).toBe("One. Two! Three?");
  });

  it("treats paragraph breaks as boundaries", () => {
    expect(speakableSentencePrefix("A heading\n\nmore text")).toBe("A heading\n\n");
  });

  it("never flushes into an unclosed code fence", () => {
    expect(speakableSentencePrefix("Run this. ```js\nconst x = 1.")).toBe("Run this.");
    expect(speakableSentencePrefix("Done. ```js\nx.\n``` After. Trailing")).toBe(
      "Done. ```js\nx.\n``` After.",
    );
  });

  it("does not split decimal numbers", () => {
    expect(speakableSentencePrefix("It costs 3.5 dollars")).toBe("");
  });
});
