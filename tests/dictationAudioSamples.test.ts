import { describe, expect, it } from "vitest";
import {
  DICTATION_SAMPLE_RATE,
  prepareDictationSamples,
  resamplePcm,
  summarizePcm,
} from "../src/lib/dictation/audioSamples";

describe("dictation audio samples", () => {
  it("resamples decoded audio to Whisper sample rate", () => {
    const samples = new Float32Array(48_000).fill(0.5);

    expect(resamplePcm(samples, 48_000)).toHaveLength(DICTATION_SAMPLE_RATE);
  });

  it("mixes channels before resampling", () => {
    const audioBuffer = {
      length: 2,
      numberOfChannels: 2,
      sampleRate: DICTATION_SAMPLE_RATE,
      getChannelData: (channel: number) =>
        channel === 0 ? new Float32Array([1, 1]) : new Float32Array([-1, 0]),
    };

    expect(prepareDictationSamples(audioBuffer)).toEqual([0, 0.5]);
  });

  it("summarizes invalid and clipped PCM", () => {
    expect(summarizePcm([0, 1, -1, Number.NaN, Number.POSITIVE_INFINITY])).toMatchObject({
      sampleCount: 5,
      finiteCount: 3,
      nanCount: 1,
      infiniteCount: 1,
      clippedCount: 2,
      min: -1,
      max: 1,
    });
  });
});
