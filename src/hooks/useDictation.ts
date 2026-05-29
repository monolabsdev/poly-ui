import { useCallback, useEffect, useRef, useState } from "react";
import { loggedInvoke } from "@/lib/utils";
import { markDictationMounted } from "./dictationLifecycle";
import { runDictationTranscription } from "./dictationSession";

type DictationStatus = "idle" | "recording" | "transcribing";

interface UseDictationOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

const TARGET_SAMPLE_RATE = 16000;

function pickRecorderMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = audioBuffer;
  const mono = new Float32Array(length);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] ?? 0;
    }
  }

  const scale = numberOfChannels > 0 ? 1 / numberOfChannels : 1;
  for (let i = 0; i < mono.length; i += 1) {
    mono[i] *= scale;
  }

  return mono;
}

function downsamplePcm(samples: Float32Array, sourceSampleRate: number, targetSampleRate: number) {
  if (sourceSampleRate === targetSampleRate) {
    return samples;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    if (end <= start) {
      output[i] = samples[Math.min(start, samples.length - 1)] ?? 0;
      continue;
    }

    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += samples[j] ?? 0;
    }

    output[i] = sum / (end - start);
  }

  return output;
}

async function decodeRecording(blob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(decoded);
    return downsamplePcm(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
  } finally {
    await audioContext.close().catch(() => {});
  }
}

export function useDictation({ onTranscript, onError }: UseDictationOptions) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);
  const sessionIdRef = useRef(0);

  useEffect(() => {
    const markUnmounted = markDictationMounted(isMountedRef);
    return () => {
      markUnmounted();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const cleanup = useCallback(() => {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }, []);

  const transcribeRecording = useCallback(
    async (blob: Blob) => {
      const samples = await decodeRecording(blob);
      const transcript = await loggedInvoke<string>("transcribe_audio", {
        samples: Array.from(samples),
        sampleRate: TARGET_SAMPLE_RATE,
        language: "en",
      });

      return transcript.trim();
    },
    [],
  );

  const finishSession = useCallback((sessionId: number) => {
    if (!isMountedRef.current) {
      return;
    }

    if (sessionIdRef.current !== sessionId) {
      return;
    }

    setStatus("idle");
  }, []);

  const runTranscription = useCallback(
    async (blob: Blob, sessionId: number) => {
      try {
        await runDictationTranscription({
          transcribe: () => transcribeRecording(blob),
          isCurrentSession: () => isMountedRef.current && sessionIdRef.current === sessionId,
          onTranscript,
          onError,
        });
      } finally {
        finishSession(sessionId);
      }
    },
    [finishSession, onError, onTranscript, transcribeRecording],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Microphone capture is not supported in this environment.");
      return;
    }

    try {
      const sessionId = sessionIdRef.current + 1;
      sessionIdRef.current = sessionId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setStatus("recording");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        onError?.("Dictation recording failed.");
        cleanup();
        finishSession(sessionId);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        cleanup();
        setStatus("transcribing");
        void runTranscription(blob, sessionId);
      };

      recorder.start();
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message || "Microphone permission denied.");
      finishSession(sessionIdRef.current);
    }
  }, [cleanup, finishSession, onError, runTranscription, status]);

  const toggle = useCallback(() => {
    if (status === "recording") {
      stop();
      return;
    }

    void start();
  }, [start, status, stop]);

  return {
    isRecording: status === "recording",
    isTranscribing: status === "transcribing",
    isBusy: status !== "idle",
    toggle,
    stop,
  };
}
