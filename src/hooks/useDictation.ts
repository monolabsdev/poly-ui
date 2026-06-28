import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/store/settingsStore";
import { useNotify } from "@/hooks/useNotify";
import { IS_LINUX } from "@/lib/utils/platform";
import {
  DICTATION_SAMPLE_RATE,
  prepareDictationSamples,
  summarizePcm,
} from "@/lib/dictation/audioSamples";

export interface WhisperModelInfo {
  id: string;
  name: string;
  filename: string;
  downloadUrl: string;
  sizeLabel: string;
  speedLabel: string;
  qualityLabel: string;
  description: string;
  recommended: boolean;
  installed: boolean;
}

interface WhisperModelsStatus {
  models: WhisperModelInfo[];
  selectedModelId: string | null;
}

interface WhisperDownloadProgress {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number | null;
}

interface NativeDictationRecording {
  audioSamples: number[];
  audioMeta: Record<string, unknown>;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const USE_NATIVE_DICTATION =
  IS_LINUX ||
  (typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("linux"));
const DICTATION_AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: { ideal: 1 },
    sampleRate: { ideal: DICTATION_SAMPLE_RATE },
    echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false },
    autoGainControl: { ideal: false },
  },
};

function compact(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 2_000);
  } catch {
    return String(value);
  }
}

function logDictation(message: string): void {
  void invoke("log_startup_phase", {
    message: `dictation: ${message}`,
  }).catch(() => {});
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function listAudioInputs(): Promise<string[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) =>
        `${index}: ${device.label || "(unlabeled)"} deviceId=${device.deviceId || "(empty)"}`,
      );
  } catch (error) {
    return [`enumerateDevices failed: ${String(error)}`];
  }
}

export function useDictation(onTranscript: (text: string) => void) {
  const notify = useNotify();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [models, setModels] = useState<WhisperModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [installingModelId, setInstallingModelId] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] =
    useState<WhisperDownloadProgress | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const nativeRecordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioInputsRef = useRef<string[]>([]);
  const recordingStartedAtRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const unlisten = listen<WhisperDownloadProgress>(
      "whisper-model-download-progress",
      (event) => setDownloadProgress(event.payload),
    );

    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (recording || processing) return;
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        void invoke("release_whisper_model");
      }
    }, 30_000);

    return () => clearInterval(id);
  }, [recording, processing]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const refreshModels = useCallback(async () => {
    const status = await invoke<WhisperModelsStatus>(
      "get_whisper_models_status",
    );
    setModels(status.models);
    setSelectedModelId(status.selectedModelId);
    return status;
  }, []);

  const beginRecording = useCallback(async () => {
    if (USE_NATIVE_DICTATION) {
      await invoke("start_native_dictation_recording");
      nativeRecordingRef.current = true;
      recordingStartedAtRef.current = Date.now();
      logDictation("native capture start requested");
      setRecording(true);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia(
      DICTATION_AUDIO_CONSTRAINTS,
    );
    const track = stream.getAudioTracks()[0] ?? null;
    const audioInputs = await listAudioInputs();
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );

    chunksRef.current = [];
    audioInputsRef.current = audioInputs;
    recordingStartedAtRef.current = Date.now();
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.start();
    logDictation(
      `capture start constraints=${compact(DICTATION_AUDIO_CONSTRAINTS.audio)} recorder=${recorder.mimeType || "default"} track_label=${track?.label || "unknown"} track_settings=${compact(track?.getSettings?.() ?? null)} audio_inputs=${compact(audioInputs)}`,
    );
    setRecording(true);
  }, []);

  const start = useCallback(async () => {
    try {
      touchActivity();
      const status = await refreshModels();
      if (!status.selectedModelId) {
        setInstallOpen(true);
        return;
      }

      await beginRecording();
    } catch (error) {
      const message = errorText(error);
      logDictation(`start failed: ${message}`);
      notify.error("Dictation failed", message);
      nativeRecordingRef.current = false;
      recorderRef.current = null;
      stopTracks();
      setRecording(false);
      setProcessing(false);
    }
  }, [beginRecording, notify, refreshModels, stopTracks, touchActivity]);

  const closeInstall = useCallback(() => {
    if (!installingModelId) {
      setInstallOpen(false);
    }
  }, [installingModelId]);

  const installModel = useCallback(
    async (modelId: string) => {
      touchActivity();
      setInstallingModelId(modelId);
      setDownloadProgress({
        modelId,
        downloadedBytes: 0,
        totalBytes: null,
      });

      try {
        await invoke("download_whisper_model", { modelId });
        await refreshModels();
        setInstallOpen(false);
        await beginRecording();
      } catch (error) {
        const message = errorText(error);
        logDictation(`install/start failed: ${message}`);
        notify.error("Dictation failed", message);
      } finally {
        setInstallingModelId(null);
        setDownloadProgress(null);
      }
    },
    [beginRecording, notify, refreshModels, touchActivity],
  );

  const selectInstalledModel = useCallback(
    async (modelId: string) => {
      try {
        touchActivity();
        await invoke("select_whisper_model", { modelId });
        await refreshModels();
        setInstallOpen(false);
        await beginRecording();
      } catch (error) {
        const message = errorText(error);
        logDictation(`select/start failed: ${message}`);
        notify.error("Dictation failed", message);
      }
    },
    [beginRecording, notify, refreshModels, touchActivity],
  );

  const stop = useCallback(async () => {
    if (nativeRecordingRef.current) {
      nativeRecordingRef.current = false;
      setRecording(false);
      setProcessing(true);

      try {
        const { audioSamples, audioMeta } = await invoke<NativeDictationRecording>(
          "stop_native_dictation_recording",
        );
        logDictation(
          `native capture stop elapsed_ms=${Date.now() - recordingStartedAtRef.current} prepared_len=${audioSamples.length} meta=${compact(audioMeta)}`,
        );
        const language = useSettingsStore.getState().dictation.language;
        const transcript = await invoke<string>("transcribe_audio", {
          audioSamples,
          language: language === "auto" ? null : language,
          audioMeta,
        });

        if (transcript.trim()) {
          onTranscript(transcript);
        } else {
          const stats = summarizePcm(audioSamples);
          logDictation(`empty transcript native_stats=${compact(stats)}`);
          notify.warn(
            "No speech detected",
            stats.peak === 0
              ? "The microphone returned silence. Check the selected input device."
              : "Audio was captured, but Whisper returned no text.",
          );
        }
      } catch (error) {
        const message = errorText(error);
        logDictation(`native stop/transcribe failed: ${message}`);
        notify.error("Dictation failed", message);
      } finally {
        setProcessing(false);
        touchActivity();
      }
      return;
    }

    const recorder = recorderRef.current;
    if (!recorder) return;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    if (recorder.state !== "inactive") {
      recorder.stop();
      await stopped;
    }

    recorderRef.current = null;
    setRecording(false);
    setProcessing(true);

    try {
      const chunks = chunksRef.current;
      const chunkSizes = chunks.map((chunk) => chunk.size);
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      const track = streamRef.current?.getAudioTracks()[0] ?? null;
      const trackSettings = track?.getSettings?.() ?? null;
      logDictation(
        `recording stop elapsed_ms=${Date.now() - recordingStartedAtRef.current} chunks=${chunks.length} chunk_sizes=${compact(chunkSizes)} blob_size=${blob.size} blob_type=${blob.type || "unknown"} track_label=${track?.label || "unknown"} track_settings=${compact(trackSettings)}`,
      );

      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(
        await blob.arrayBuffer(),
      );

      try {
        const samples = prepareDictationSamples(audioBuffer);
        const frontendStats = summarizePcm(samples);
        logDictation(
          `decoded source_rate=${audioBuffer.sampleRate} source_channels=${audioBuffer.numberOfChannels} decoded_len=${audioBuffer.length} decoded_duration=${audioBuffer.duration.toFixed(3)} prepared_rate=${DICTATION_SAMPLE_RATE} prepared_len=${samples.length} prepared_stats=${compact(frontendStats)}`,
        );
        const language = useSettingsStore.getState().dictation.language;
        const transcript = await invoke<string>("transcribe_audio", {
          audioSamples: samples,
          language: language === "auto" ? null : language,
          audioMeta: {
            recorderMimeType: recorder.mimeType || null,
            blobType: blob.type || null,
            blobSize: blob.size,
            chunkCount: chunks.length,
            chunkSizes,
            sourceSampleRate: audioBuffer.sampleRate,
            sourceChannelCount: audioBuffer.numberOfChannels,
            decodedLength: audioBuffer.length,
            decodedDurationSeconds: audioBuffer.duration,
            targetSampleRate: DICTATION_SAMPLE_RATE,
            sampleFormat: "float32",
            trackLabel: track?.label || null,
            trackSettings,
            audioInputs: audioInputsRef.current,
            frontendStats,
          },
        });

        if (transcript.trim()) {
          onTranscript(transcript);
        } else {
          const stats = summarizePcm(samples);
          logDictation(`empty transcript browser_stats=${compact(stats)}`);
          notify.warn("No speech detected", "Audio was captured, but Whisper returned no text.");
        }
      } catch (error) {
        const message = errorText(error);
        logDictation(`browser stop/transcribe failed: ${message}`);
        notify.error("Dictation failed", message);
      } finally {
        await audioContext.close();
      }
    } finally {
      chunksRef.current = [];
      stopTracks();
      setProcessing(false);
      touchActivity();
    }
  }, [notify, onTranscript, stopTracks, touchActivity]);

  return {
    recording,
    processing,
    start,
    stop,
    installOpen,
    models,
    selectedModelId,
    installingModelId,
    downloadProgress,
    closeInstall,
    installModel,
    selectInstalledModel,
    refreshModels,
  };
}
