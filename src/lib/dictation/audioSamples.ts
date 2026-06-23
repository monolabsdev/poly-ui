export const DICTATION_SAMPLE_RATE = 16_000;
const CLIPPING_THRESHOLD = 0.999;

type AudioBufferLike = {
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
};

export function prepareDictationSamples(audioBuffer: AudioBufferLike): number[] {
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const mono = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < audioBuffer.length; i += 1) {
      mono[i] += data[i] / channelCount;
    }
  }

  return resamplePcm(mono, audioBuffer.sampleRate, DICTATION_SAMPLE_RATE);
}

export function summarizePcm(samples: readonly number[]) {
  let finiteCount = 0;
  let nanCount = 0;
  let infiniteCount = 0;
  let clippedCount = 0;
  let zeroCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let peak = 0;
  let sumSquares = 0;

  for (const sample of samples) {
    if (Number.isNaN(sample)) {
      nanCount += 1;
      continue;
    }
    if (!Number.isFinite(sample)) {
      infiniteCount += 1;
      continue;
    }

    const abs = Math.abs(sample);
    finiteCount += 1;
    min = Math.min(min, sample);
    max = Math.max(max, sample);
    peak = Math.max(peak, abs);
    sumSquares += sample * sample;
    if (sample === 0) zeroCount += 1;
    if (abs >= CLIPPING_THRESHOLD) clippedCount += 1;
  }

  return {
    sampleCount: samples.length,
    finiteCount,
    nanCount,
    infiniteCount,
    clippedCount,
    zeroCount,
    min: finiteCount ? min : 0,
    max: finiteCount ? max : 0,
    rms: finiteCount ? Math.sqrt(sumSquares / finiteCount) : 0,
    peak,
    allZero: finiteCount === zeroCount,
  };
}

export function resamplePcm(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = DICTATION_SAMPLE_RATE,
): number[] {
  if (sourceSampleRate === targetSampleRate) {
    return Array.from(samples);
  }

  const outputLength = Math.max(
    1,
    Math.round((samples.length * targetSampleRate) / sourceSampleRate),
  );
  const output = new Array<number>(outputLength);
  const ratio = sourceSampleRate / targetSampleRate;

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, samples.length - 1);
    const weight = sourceIndex - left;
    output[i] = samples[left] * (1 - weight) + samples[right] * weight;
  }

  return output;
}
