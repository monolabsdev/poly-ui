import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "@/store/settingsStore";

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

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function useDictation(onTranscript: (text: string) => void) {
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
  const streamRef = useRef<MediaStream | null>(null);
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);

    chunksRef.current = [];
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.start();
    setRecording(true);
  }, []);

  const start = useCallback(async () => {
    touchActivity();
    const status = await refreshModels();
    if (!status.selectedModelId) {
      setInstallOpen(true);
      return;
    }

    await beginRecording();
  }, [beginRecording, refreshModels, touchActivity]);

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
      } finally {
        setInstallingModelId(null);
        setDownloadProgress(null);
      }
    },
    [beginRecording, refreshModels, touchActivity],
  );

  const selectInstalledModel = useCallback(
    async (modelId: string) => {
      touchActivity();
      await invoke("select_whisper_model", { modelId });
      await refreshModels();
      setInstallOpen(false);
      await beginRecording();
    },
    [beginRecording, refreshModels, touchActivity],
  );

  const stop = useCallback(async () => {
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
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(
        await blob.arrayBuffer(),
      );

      try {
        const samples = Array.from(audioBuffer.getChannelData(0));
        const language = useSettingsStore.getState().dictation.language;
        const transcript = await invoke<string>("transcribe_audio", {
          audioSamples: samples,
          language: language === "auto" ? null : language,
        });

        if (transcript.trim()) {
          onTranscript(transcript);
        }
      } finally {
        await audioContext.close();
      }
    } finally {
      chunksRef.current = [];
      stopTracks();
      setProcessing(false);
      touchActivity();
    }
  }, [onTranscript, stopTracks, touchActivity]);

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
