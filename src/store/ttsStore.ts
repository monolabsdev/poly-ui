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
let browserSettings = {
  voiceURI: "",
  speed: 1,
  pitch: 1,
};

export function setTtsBrowserSettings(settings: typeof browserSettings) {
  browserSettings = settings;
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
        if (typeof window === "undefined" || !window.speechSynthesis) {
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
          const voice = getVoice(browserSettings.voiceURI);
          if (voice) utterance.voice = voice;
          utterance.rate = browserSettings.speed;
          utterance.pitch = browserSettings.pitch;

          utterance.onend = () => {
            browserSentenceIndex += 1;
            speakNext();
          };

          utterance.onerror = (event) => {
            if (event.error !== "interrupted") {
              set({
                error: `Speech synthesis error: ${event.error}`,
                isPlaying: false,
                activeMessageId: null,
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
      set({ activeMessageId: null, isPlaying: false, isGenerating: false });
    },
  },
}));
