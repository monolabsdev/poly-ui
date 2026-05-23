import { create } from "zustand";
import { useSettingsStore } from "./settingsStore";
import { useChatStore } from "./chatStore";

interface TtsState {
  activeMessageId: number | string | null;
  isPlaying: boolean;
  isGenerating: boolean;
  engineLoaded: boolean;
  error: string | null;
  statusMessage: string | null;
  actions: {
    play: (messageId: number | string, text: string) => Promise<void>;
    stop: () => void;
    loadEngine: () => Promise<void>;
  };
}

let browserSentenceQueue: string[] = [];
let browserSentenceIndex = 0;

let stTtsAudio: HTMLAudioElement | null = null;

export function cleanTextForSpeech(text: string): string {
  if (!text) return "";

  let clean = text;

  clean = clean.replace(/<[^>]*>/g, "");
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/`([^`]+)`/g, "$1");
  clean = clean.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "");
  clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  clean = clean.replace(/^>\s+/gm, "");
  clean = clean.replace(/^#+\s+/gm, "");
  clean = clean.replace(/^\s*[-*+]\s+/gm, "");
  clean = clean.replace(/^\s*\d+\.\s+/gm, "");
  clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
  clean = clean.replace(/\*([^*]+)\*/g, "$1");
  clean = clean.replace(/__([^_]+)__/g, "$1");
  clean = clean.replace(/_([^_]+)_/g, "$1");
  clean = clean.replace(/~~([^~]+)~~/g, "$1");
  clean = clean.replace(/\$\$[\s\S]*?\$\$/g, "");
  clean = clean.replace(/\$[^\$]+\$/g, "");
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

const cleanTextAsync = (text: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(cleanTextForSpeech(text));
    }, 0);
  });
};

export const useTtsStore = create<TtsState>((set, get) => ({
  activeMessageId: null,
  isPlaying: false,
  isGenerating: false,
  engineLoaded: false,
  error: null,
  statusMessage: null,
  actions: {
    loadEngine: async () => {
      const { loadModel } = await import("tauri-plugin-supertonic-api");
      const settings = useSettingsStore.getState().tts.stTts;
      await loadModel(settings.modelId, settings.voiceStyle);
      set({ engineLoaded: true });
    },

    play: async (messageId, rawText) => {
      const { stop } = get().actions;
      stop();

      set({ activeMessageId: messageId, isPlaying: false, isGenerating: true, error: null });

      try {
        const cleanedText = await cleanTextAsync(rawText);
        if (!cleanedText) {
          set({ isGenerating: false, activeMessageId: null });
          return;
        }

        const settings = useSettingsStore.getState().tts;

        if (settings.engine === "stTts") {
          if (!get().engineLoaded) {
            set({ statusMessage: "Downloading TTS model (~100MB)..." });
            await get().actions.loadEngine();
            set({ statusMessage: null });
          }
          const { synthesize } = await import("tauri-plugin-supertonic-api");
          const result = await synthesize(cleanedText, "en", undefined, settings.stTts.speed);
          set({ isGenerating: false, isPlaying: true });

          const audio = new Audio(`data:audio/wav;base64,${result.wavBase64}`);
          stTtsAudio = audio;
          audio.onended = () => {
            stTtsAudio = null;
            set({ isPlaying: false, activeMessageId: null });
          };
          audio.onerror = () => {
            stTtsAudio = null;
            set({ error: "Audio playback failed", isPlaying: false, activeMessageId: null });
          };
          audio.play().catch((err) => {
            stTtsAudio = null;
            throw err;
          });
        } else {
          if (typeof window === "undefined" || !window.speechSynthesis) {
            throw new Error("Speech synthesis is not supported in this environment.");
          }

          window.speechSynthesis.cancel();

          browserSentenceQueue = cleanedText
            .split(/[.!?]+\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

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

            const sentence = browserSentenceQueue[browserSentenceIndex];
            const utterance = new SpeechSynthesisUtterance(sentence);

            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find((v) => v.voiceURI === settings.browser.voiceURI);
            if (voice) {
              utterance.voice = voice;
            }

            utterance.rate = settings.browser.speed;
            utterance.pitch = settings.browser.pitch;

            utterance.onend = () => {
              browserSentenceIndex++;
              speakNext();
            };

            utterance.onerror = (e) => {
              if (e.error !== "interrupted") {
                console.error("SpeechSynthesis utterance error:", e);
                set({ error: `Speech synthesis error: ${e.error}`, isPlaying: false, activeMessageId: null });
              }
            };

            window.speechSynthesis.speak(utterance);
          };

          speakNext();
        }
      } catch (err: any) {
        console.error("TTS play error:", err);
        set({
          error: err.message || "An unexpected error occurred during speech synthesis.",
          statusMessage: null,
          isPlaying: false,
          isGenerating: false,
          activeMessageId: null,
        });
      }
    },

    stop: () => {
      if (stTtsAudio) {
        stTtsAudio.pause();
        stTtsAudio = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          console.warn("Error cancelling speech synthesis:", e);
        }
      }
      browserSentenceQueue = [];
      browserSentenceIndex = 0;

      set({ activeMessageId: null, isPlaying: false, isGenerating: false });
    },
  },
}));

let lastActiveConversationId: string | undefined;

if (typeof window !== "undefined") {
  useChatStore.subscribe((state) => {
    const currentId = state.activeConversationId;
    if (lastActiveConversationId !== undefined && currentId !== lastActiveConversationId) {
      useTtsStore.getState().actions.stop();
    }
    lastActiveConversationId = currentId ?? undefined;
  });
}
