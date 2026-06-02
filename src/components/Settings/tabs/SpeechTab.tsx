import { useEffect, useState, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  FormControl,
  MenuItem,
  Select,
  Stack,
  Slider,
  Typography,
  Button,
  Box,
  CircularProgress,
} from "@mui/material";
import { SettingCard, SectionHeader, selectSx } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { useTtsStore } from "@/store/ttsStore";
import { Volume2, Square, AlertCircle, Download, Check } from "lucide-react";
import { useNotify } from "@/hooks/useNotify";

export function SpeechTab() {
  const { tts, actions } = useSettingsStore(
    useShallow((state) => ({
      tts: state.tts,
      actions: state.actions,
    })),
  );
  const ttsPlayback = useTtsStore(
    useShallow((state) => ({
      activeMessageId: state.activeMessageId,
      isPlaying: state.isPlaying,
      isGenerating: state.isGenerating,
      engineLoaded: state.engineLoaded,
      error: state.error,
      actions: state.actions,
    })),
  );
  const notify = useNotify();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [stTtsVoices, setStTtsVoices] = useState<string[]>([]);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);

  const stTtsVoiceStyle = tts.stTts?.voiceStyle ?? "M1";
  const shownErrorsRef = useRef<Set<string>>(new Set());
  const voicesLoadedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSpeechSupported(false);
      return;
    }

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (ttsPlayback.error && !shownErrorsRef.current.has(ttsPlayback.error)) {
      shownErrorsRef.current.add(ttsPlayback.error);
      notify.error("Speech error", ttsPlayback.error);
    }
  }, [ttsPlayback.error, notify]);

  useEffect(() => {
    if (ttsPlayback.engineLoaded && !voicesLoadedRef.current) {
      voicesLoadedRef.current = true;
      (async () => {
        try {
          const { listVoices } = await import("tauri-plugin-supertonic-api");
          const v = await listVoices();
          setStTtsVoices(v);
        } catch {
          voicesLoadedRef.current = false;
        }
      })();
    }
  }, [ttsPlayback.engineLoaded]);

  const loadCancelRef = useRef<(() => void) | null>(null);

  const handleLoadModel = useCallback(async () => {
    if (loadProgress) {
      loadCancelRef.current?.();
      setLoadProgress(null);
      return;
    }
    setLoadProgress("Downloading model...");
    let cancelled = false;
    loadCancelRef.current = () => { cancelled = true; };
    try {
      await ttsPlayback.actions.loadEngine();
      if (cancelled) return;
      setLoadProgress(null);
      notify.success("TTS model loaded");

      voicesLoadedRef.current = true;
      const { listVoices } = await import("tauri-plugin-supertonic-api");
      const v = await listVoices();
      setStTtsVoices(v);
    } catch (err: any) {
      if (cancelled) return;
      setLoadProgress(null);
      notify.error("Failed to load TTS model", err?.message ?? String(err));
    } finally {
      loadCancelRef.current = null;
    }
  }, [loadProgress, ttsPlayback.actions, notify]);

  const handleTestSpeech = async () => {
    const testId = "test-synthesis";
    if (ttsPlayback.activeMessageId === testId && ttsPlayback.isPlaying) {
      ttsPlayback.actions.stop();
      return;
    }

    await ttsPlayback.actions.play(
      testId,
      "Speech synthesis is active and configured correctly.",
    );
  };

  const isTesting = ttsPlayback.activeMessageId === "test-synthesis";
  const isDisabled =
    (ttsPlayback.isGenerating && !isTesting) ||
    (tts.engine === "browser" && !speechSupported);

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Speech / TTS Settings"
        description="Configure speech synthesis options for reading AI assistant messages."
      />

      <SettingCard
        title="TTS Engine"
        description="Choose between browser SpeechSynthesis or on-device ST-TTS."
        action={
          <FormControl size="small" sx={{ minWidth: 160, maxWidth: 200 }}>
            <Select
              value={tts.engine}
              onChange={(e) =>
                actions.updateTts({ engine: e.target.value as "browser" | "stTts" })
              }
              sx={selectSx}
            >
              <MenuItem value="browser" sx={{ fontSize: 13 }}>Browser</MenuItem>
              <MenuItem value="stTts" sx={{ fontSize: 13 }}>ST-TTS (On-device)</MenuItem>
            </Select>
          </FormControl>
        }
      />

      {tts.engine === "browser" && !speechSupported ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 2,
            borderRadius: "12px",
            bgcolor: "rgba(211, 47, 47, 0.08)",
            border: "1px solid",
            borderColor: "error.main",
            color: "error.main",
          }}
        >
          <AlertCircle size={18} />
          <Typography variant="body2" sx={{ fontSize: "13px" }}>
            Browser SpeechSynthesis is not supported or disabled on your system.
          </Typography>
        </Box>
      ) : null}

      {tts.engine === "browser" && speechSupported ? (
        <>
          <SettingCard
            title="Browser Voice"
            description="Select the system voice to use for reading messages."
            action={
              <FormControl size="small" sx={{ minWidth: 220, maxWidth: 300 }}>
                <Select
                  value={
                    tts.browser.voiceURI || (voices[0]?.voiceURI ?? "")
                  }
                  onChange={(e) =>
                    actions.updateTts({
                      browser: {
                        ...tts.browser,
                        voiceURI: e.target.value,
                      },
                    })
                  }
                  sx={selectSx}
                  displayEmpty
                >
                  {voices.length === 0 ? (
                    <MenuItem value="" disabled>
                      Loading voices...
                    </MenuItem>
                  ) : (
                    voices.map((voice) => (
                      <MenuItem
                        key={voice.voiceURI}
                        value={voice.voiceURI}
                        sx={{ fontSize: 13 }}
                      >
                        {voice.name} ({voice.lang})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            }
          />

          <SettingCard
            title="Playback Speed"
            description="Adjust the voice reading speed."
          >
            <Box
              sx={{
                px: 1,
                py: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Slider
                value={tts.browser.speed}
                min={0.5}
                max={2.0}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(val) => `${val.toFixed(1)}x`}
                onChange={(_, val) =>
                  actions.updateTts({
                    browser: { ...tts.browser, speed: val as number },
                  })
                }
                sx={{ flexGrow: 1 }}
              />
              <Typography
                sx={{
                  width: 45,
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "right",
                  color: "text.secondary",
                }}
              >
                {tts.browser.speed.toFixed(1)}x
              </Typography>
            </Box>
          </SettingCard>

          <SettingCard
            title="Voice Pitch"
            description="Adjust the tone of the speaking voice."
          >
            <Box
              sx={{
                px: 1,
                py: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Slider
                value={tts.browser.pitch}
                min={0.5}
                max={2.0}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(val) => `${val.toFixed(1)}`}
                onChange={(_, val) =>
                  actions.updateTts({
                    browser: { ...tts.browser, pitch: val as number },
                  })
                }
                sx={{ flexGrow: 1 }}
              />
              <Typography
                sx={{
                  width: 45,
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "right",
                  color: "text.secondary",
                }}
              >
                {tts.browser.pitch.toFixed(1)}
              </Typography>
            </Box>
          </SettingCard>
        </>
      ) : null}

      {tts.engine === "stTts" ? (
        <>
          <SettingCard
            title="Model"
            description="On-device TTS model from HuggingFace (~100MB download)."
            action={
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Button
                  variant={loadProgress ? "outlined" : ttsPlayback.engineLoaded ? "outlined" : "contained"}
                  disableElevation
                  size="small"
                  onClick={handleLoadModel}
                  color={loadProgress ? "error" : "primary"}
                  startIcon={
                    loadProgress ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : ttsPlayback.engineLoaded ? (
                      <Check size={14} />
                    ) : (
                      <Download size={14} />
                    )
                  }
                  sx={{ textTransform: "none", fontWeight: 600, fontSize: 12 }}
                >
                  {loadProgress ? "Cancel" : ttsPlayback.engineLoaded ? "Loaded" : "Load Model"}
                </Button>
              </Box>
            }
          />

          {ttsPlayback.engineLoaded ? (
            <SettingCard
              title="Voice"
              description="Select a voice style for synthesis."
              action={
                <FormControl size="small" sx={{ minWidth: 160, maxWidth: 200 }}>
                  <Select
                    value={stTtsVoiceStyle}
                    onChange={async (e) => {
                      const voice = e.target.value;
                      actions.updateTts({ stTts: { ...tts.stTts, voiceStyle: voice } });
                      try {
                        const { selectVoice } = await import("tauri-plugin-supertonic-api");
                        await selectVoice(voice);
                      } catch (err: any) {
                        notify.error("Failed to switch voice", err.message);
                      }
                    }}
                    sx={selectSx}
                  >
                    {stTtsVoices.length === 0 ? (
                      <MenuItem value={stTtsVoiceStyle} sx={{ fontSize: 13 }}>
                        {stTtsVoiceStyle}
                      </MenuItem>
                    ) : (
                      stTtsVoices.map((v) => (
                        <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              }
            />
          ) : null}

        </>
      ) : null}

      <Box sx={{ py: 1.5, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          disableElevation
          onClick={handleTestSpeech}
          disabled={isDisabled}
          startIcon={
            ttsPlayback.isGenerating && isTesting ? (
              <CircularProgress size={16} color="inherit" />
            ) : ttsPlayback.isPlaying && isTesting ? (
              <Square size={16} />
            ) : (
              <Volume2 size={16} />
            )
          }
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            px: 3,
          }}
        >
          {ttsPlayback.isGenerating && isTesting
            ? "Synthesizing..."
            : ttsPlayback.isPlaying && isTesting
              ? "Stop Test"
              : "Test Voice"}
        </Button>
      </Box>
    </Stack>
  );
}
