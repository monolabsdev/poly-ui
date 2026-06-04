import { useEffect, useState, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlertCircle,
  Square,
  Volume2,
} from "lucide-react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { SettingCard, SectionHeader, selectSx } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { useTtsStore } from "@/store/ttsStore";
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
      error: state.error,
      actions: state.actions,
    })),
  );
  const notify = useNotify();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const shownErrorsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSpeechSupported(false);
      return;
    }

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
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
  const isDisabled = (ttsPlayback.isGenerating && !isTesting) || !speechSupported;

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Speech Settings"
        description="Configure native system speech synthesis for reading assistant messages."
      />

      {!speechSupported ? (
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
            Native speech synthesis is not supported or disabled on your system.
          </Typography>
        </Box>
      ) : null}

      {speechSupported ? (
        <>
          <SettingCard
            title="Voice"
            description="Select the system voice to use for reading messages."
            action={
              <FormControl size="small" sx={{ minWidth: 220, maxWidth: 300 }}>
                <Select
                  value={tts.browser.voiceURI || (voices[0]?.voiceURI ?? "")}
                  onChange={(event) =>
                    actions.updateTts({
                      browser: {
                        ...tts.browser,
                        voiceURI: event.target.value,
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
                      <MenuItem key={voice.voiceURI} value={voice.voiceURI} sx={{ fontSize: 13 }}>
                        {voice.name} ({voice.lang})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            }
          />

          <SettingCard title="Playback Speed" description="Adjust the voice reading speed.">
            <Box sx={{ px: 1, py: 0.5, display: "flex", alignItems: "center", gap: 3 }}>
              <Slider
                value={tts.browser.speed}
                min={0.5}
                max={2.0}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(1)}x`}
                onChange={(_, value) =>
                  actions.updateTts({
                    browser: { ...tts.browser, speed: value as number },
                  })
                }
                sx={{ flexGrow: 1 }}
              />
              <Typography
                sx={{ width: 45, fontSize: 13, fontWeight: 700, textAlign: "right", color: "text.secondary" }}
              >
                {tts.browser.speed.toFixed(1)}x
              </Typography>
            </Box>
          </SettingCard>

          <SettingCard title="Voice Pitch" description="Adjust the tone of the speaking voice.">
            <Box sx={{ px: 1, py: 0.5, display: "flex", alignItems: "center", gap: 3 }}>
              <Slider
                value={tts.browser.pitch}
                min={0.5}
                max={2.0}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(1)}`}
                onChange={(_, value) =>
                  actions.updateTts({
                    browser: { ...tts.browser, pitch: value as number },
                  })
                }
                sx={{ flexGrow: 1 }}
              />
              <Typography
                sx={{ width: 45, fontSize: 13, fontWeight: 700, textAlign: "right", color: "text.secondary" }}
              >
                {tts.browser.pitch.toFixed(1)}
              </Typography>
            </Box>
          </SettingCard>
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
          sx={{ textTransform: "none", fontWeight: 700, fontSize: 13, px: 3 }}
        >
          {ttsPlayback.isGenerating && isTesting
            ? "Preparing..."
            : ttsPlayback.isPlaying && isTesting
              ? "Stop Test"
              : "Test Voice"}
        </Button>
      </Box>
    </Stack>
  );
}
