import { useEffect, useState } from "react";
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
import { Volume2, Square, AlertCircle } from "lucide-react";
import { useNotify } from "@/hooks/useNotify";

export function SpeechTab() {
  const { tts, actions } = useSettingsStore();
  const ttsPlayback = useTtsStore();
  const notify = useNotify();

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);

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
    if (ttsPlayback.error) {
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

  const isDisabled =
    (ttsPlayback.isGenerating && !isTesting) || !speechSupported;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        title="Speech / TTS Settings"
        description="Configure speech synthesis options for reading AI assistant messages."
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
            Browser SpeechSynthesis is not supported or disabled on your system.
          </Typography>
        </Box>
      ) : (
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
      )}

      <Box sx={{ pt: 2, display: "flex", justifyContent: "flex-end" }}>
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
            borderRadius: "8px",
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
