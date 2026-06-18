import { useCallback, useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useShallow } from "zustand/react/shallow";
import {
  AlertCircle,
  Square,
  Volume2,
} from "lucide-react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { SettingCard, SectionHeader, selectSx } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { useTtsStore } from "@/store/ttsStore";
import { useNotify } from "@/hooks/useNotify";
import { useDictation } from "@/hooks/useDictation";
import { DictationModelDialog } from "@/features/dictation/DictationModelDialog";

const WHISPER_LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
];

export function SpeechTab() {
  const { tts, dictation, actions } = useSettingsStore(
    useShallow((state) => ({
      tts: state.tts,
      dictation: state.dictation,
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

  const appendTranscript = useCallback(() => {}, []);
  const {
    models,
    selectedModelId,
    installingModelId,
    downloadProgress,
    installOpen,
    closeInstall,
    installModel,
    selectInstalledModel,
    refreshModels,
  } = useDictation(appendTranscript);

  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (manageOpen) {
      void refreshModels();
    }
  }, [manageOpen, refreshModels]);

  const downloadPercent =
    downloadProgress?.totalBytes && downloadProgress.totalBytes > 0
      ? Math.round(
          (downloadProgress.downloadedBytes / downloadProgress.totalBytes) *
            100,
        )
      : null;

  const currentModel = models.find((m) => m.id === selectedModelId);

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

      <SectionHeader
        title="Dictation"
        description="Local voice dictation using Whisper speech recognition models."
      />

      <SettingCard
        title="Enable dictation"
        description="Show the microphone button in chat input for voice dictation."
        action={
          <Switch
            checked={dictation.enabled}
            onChange={(e) => {
              if (!e.target.checked) {
                void invoke("release_whisper_model");
              }
              actions.updateDictation({ enabled: e.target.checked });
            }}
          />
        }
      />

      {dictation.enabled && (
        <>
          <SettingCard
            title="Language"
            description="Language for speech recognition. Auto-detect defaults to English for reliability."
            action={
              <FormControl size="small" sx={{ minWidth: 180, maxWidth: 240 }}>
                <Select
                  value={dictation.language}
                  onChange={(event) =>
                    actions.updateDictation({ language: event.target.value })
                  }
                  sx={selectSx}
                >
                  {WHISPER_LANGUAGES.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code} sx={{ fontSize: 13 }}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            }
          />

          <SettingCard
            title="Auto-start recording"
            description="Start recording immediately when pressing the mic button, skipping the model selection dialog."
            action={
              <Switch
                checked={dictation.autoStart}
                onChange={(e) => actions.updateDictation({ autoStart: e.target.checked })}
              />
            }
          />

          <SettingCard
            title="Model"
            description={
              currentModel
                ? `Currently using ${currentModel.name} (${currentModel.sizeLabel})`
                : "No Whisper model installed. Install one to use dictation."
            }
            action={
              <Button
                size="small"
                variant="outlined"
                onClick={() => setManageOpen(true)}
                sx={{ textTransform: "none", fontWeight: 600, fontSize: 12 }}
              >
                {models.length > 0 ? "Manage models" : "Install model"}
              </Button>
            }
          >
            {currentModel && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip
                  label={currentModel.speedLabel}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11 }}
                />
                <Chip
                  label={currentModel.qualityLabel}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11 }}
                />
              </Box>
            )}
          </SettingCard>
        </>
      )}

      <DictationModelDialog
        open={manageOpen || installOpen}
        models={models}
        selectedModelId={selectedModelId}
        installingModelId={installingModelId}
        downloadPercent={downloadPercent}
        onClose={() => {
          setManageOpen(false);
          closeInstall();
        }}
        onInstall={installModel}
        onSelect={selectInstalledModel}
      />
    </Stack>
  );
}
