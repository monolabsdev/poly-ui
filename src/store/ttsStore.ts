import { Channel, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

interface TtsState {
  activeMessageId: number | string | null;
  isPlaying: boolean;
  isGenerating: boolean;
  error: string | null;
  actions: {
    play: (messageId: number | string, text: string) => Promise<void>;
    stop: () => void;
  };
}

let browserSentenceQueue: string[] = [];
let browserSentenceIndex = 0;
let supertonicAudio: HTMLAudioElement | null = null;
let supertonicLoadPromise: Promise<void> | null = null;
let ttsSettings = {
  engine: "auto" as "auto" | "native" | "supertonic",
  browser: {
    voiceURI: "",
    speed: 1,
    pitch: 1,
  },
  supertonic: {
    voiceName: "M1",
    speed: 1,
    totalStep: 10,
    silenceDuration: 0.3,
  },
};

export function setTtsBrowserSettings(settings: typeof ttsSettings.browser) {
  ttsSettings.browser = settings;
}

export function setTtsSettings(settings: typeof ttsSettings) {
  ttsSettings = settings;
}

export function cleanTextForSpeech(text: string): string {
  if (!text) return "";

  return text
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/\$[^\$]+\$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const cleanTextAsync = (text: string): Promise<string> =>
  new Promise((resolve) => setTimeout(() => resolve(cleanTextForSpeech(text)), 0));

const getVoice = (voiceURI: string): SpeechSynthesisVoice | undefined => {
  if (!voiceURI) return undefined;
  return window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === voiceURI);
};

const base64ToBlob = (base64: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "audio/wav" });
};

const ensureSupertonicLoaded = async () => {
  const status = await invoke<{ engineLoaded: boolean; currentVoice: string }>("plugin:supertonic|get_status");
  if (status.engineLoaded && status.currentVoice === ttsSettings.supertonic.voiceName) return;

  supertonicLoadPromise ??= invoke("plugin:supertonic|load_model", {
    modelId: "Supertone/supertonic-3",
    voiceStyle: ttsSettings.supertonic.voiceName,
    onProgress: new Channel(),
  }).finally(() => {
    supertonicLoadPromise = null;
  }) as Promise<void>;
  await supertonicLoadPromise;
};

const playSupertonic = async (text: string, set: (state: Partial<TtsState>) => void) => {
  await ensureSupertonicLoaded();
  const result = await invoke<{ wavBase64: string }>("plugin:supertonic|synthesize", {
    text,
    lang: "en",
    speed: ttsSettings.supertonic.speed,
    totalStep: ttsSettings.supertonic.totalStep,
    silenceDuration: ttsSettings.supertonic.silenceDuration,
  });

  const url = URL.createObjectURL(base64ToBlob(result.wavBase64));
  supertonicAudio = new Audio(url);
  supertonicAudio.onended = () => {
    URL.revokeObjectURL(url);
    supertonicAudio = null;
    set({ isPlaying: false, activeMessageId: null });
  };
  supertonicAudio.onerror = () => {
    URL.revokeObjectURL(url);
    supertonicAudio = null;
    set({ error: "Supertonic speech synthesis failed.", isPlaying: false, activeMessageId: null });
  };
  set({ isGenerating: false, isPlaying: true });
  await supertonicAudio.play();
};

export const useTtsStore = create<TtsState>((set, get) => ({
  activeMessageId: null,
  isPlaying: false,
  isGenerating: false,
  error: null,
  actions: {
    play: async (messageId, rawText) => {
      get().actions.stop();
      set({ activeMessageId: messageId, isPlaying: false, isGenerating: true, error: null });

      try {
        const nativeAvailable = typeof window !== "undefined" && Boolean(window.speechSynthesis);
        if (ttsSettings.engine === "supertonic" || (!nativeAvailable && ttsSettings.engine !== "native")) {
          const cleanedText = await cleanTextAsync(rawText);
          if (!cleanedText || !get().isGenerating) {
            set({ isGenerating: false, activeMessageId: null });
            return;
          }
          await playSupertonic(cleanedText, set);
          return;
        }
        if (!nativeAvailable) {
          throw new Error("Speech synthesis is not supported in this environment.");
        }

        const cleanedText = await cleanTextAsync(rawText);
        if (!cleanedText) {
          set({ isGenerating: false, activeMessageId: null });
          return;
        }

        if (!get().isGenerating) return;

        window.speechSynthesis.cancel();

        browserSentenceQueue = cleanedText
          .split(/[.!?]+\s+/)
          .map((sentence) => sentence.trim())
          .filter((sentence) => sentence.length > 0);

        if (browserSentenceQueue.length === 0) {
          set({ isGenerating: false, activeMessageId: null });
          return;
        }

        browserSentenceIndex = 0;
        set({ isGenerating: false, isPlaying: true });

        const speakNext = () => {
          if (browserSentenceIndex >= browserSentenceQueue.length) {
            set({ isPlaying: false, activeMessageId: null });
            return;
          }

          const utterance = new SpeechSynthesisUtterance(browserSentenceQueue[browserSentenceIndex]);
          const voice = getVoice(ttsSettings.browser.voiceURI);
          if (voice) utterance.voice = voice;
          utterance.rate = ttsSettings.browser.speed;
          utterance.pitch = ttsSettings.browser.pitch;

          utterance.onend = () => {
            browserSentenceIndex += 1;
            speakNext();
          };

          utterance.onerror = (event) => {
            if (event.error !== "interrupted") {
              const fallback = ttsSettings.engine === "auto"
                ? playSupertonic(cleanedText, set)
                : Promise.reject();
              void fallback.catch(() => {
                set({
                  error: `Speech synthesis error: ${event.error}`,
                  isPlaying: false,
                  activeMessageId: null,
                });
              });
            }
          };

          window.speechSynthesis.speak(utterance);
        };

        speakNext();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected speech synthesis error occurred.";
        set({ error: message, isPlaying: false, isGenerating: false, activeMessageId: null });
      }
    },

    stop: () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (err) {
          console.warn("Error cancelling speech synthesis:", err);
        }
      }

      browserSentenceQueue = [];
      browserSentenceIndex = 0;
      if (supertonicAudio) {
        supertonicAudio.pause();
        supertonicAudio = null;
      }
      set({ activeMessageId: null, isPlaying: false, isGenerating: false });
    },
  },
}));
