import { useState, useEffect } from "react";
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Download, RefreshCw, Trash2, XCircle } from "lucide-react";
import { SectionHeader } from "../SettingComponents";
import { appPanelSx, appTextFieldSx } from "@/components/ui/appDialog";
import { PROMPT_PRESETS } from "@/constants/promptPresets";
import { useSettingsStore } from "@/store/settingsStore";
import { useOllama, type PullProgress } from "@/services/ollama";
import { loggedInvoke, formatFileSize } from "@/lib/utils";
import { listen } from "@tauri-apps/api/event";

export function PersonalisationTab() {
  const { selectedPromptPreset, actions } = useSettingsStore();
  const ollama = useOllama();
  const [newModelName, setNewModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshModels = async () => {
    setIsRefreshing(true);
    try {
      await ollama.refresh();
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePullModel = async () => {
    if (!newModelName.trim()) return;
    const modelToPull = newModelName.trim();
    ollama.actions.setPullingModel(modelToPull);
    setIsPulling(true);
    ollama.actions.setPullProgress({ status: "Starting..." });

    try {
      await loggedInvoke("pull_model", { model: modelToPull });
      setNewModelName("");
      await new Promise((r) => setTimeout(r, 1000));
      await refreshModels();
      await new Promise((r) => setTimeout(r, 500));
      await refreshModels();
    } catch (error) {
      if (error !== "Pull cancelled by user") {
        console.error("Failed to pull model:", error);
      }
    } finally {
      ollama.actions.setPullingModel(null);
      ollama.actions.setPullProgress(null);
      setIsPulling(false);
    }
  };

  const handleCancelPull = async () => {
    try {
      await ollama.cancelPull();
    } catch (error) {
      console.error("Failed to cancel pull:", error);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    try {
      await ollama.deleteModel(modelName);
      refreshModels();
    } catch (error) {
      console.error("Failed to delete model:", error);
    }
  };

  useEffect(() => {
    const unlistenPromise = listen<PullProgress>("pull-progress", (event) => {
      ollama.actions.setPullProgress(event.payload);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [ollama.actions]);

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Prompt Preset"
        description="Choose a default style for the AI's responses."
      />

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", pb: 2 }}>
        {PROMPT_PRESETS.map((preset) => (
          <Box
            key={preset.id}
            onClick={() => actions.setPromptPreset(preset.id)}
            sx={{
              flex: "1 1 140px",
              p: 1.5,
              borderRadius: "8px",
              border: "1px solid",
              borderColor:
                selectedPromptPreset === preset.id ? "primary.main" : "divider",
              bgcolor:
                selectedPromptPreset === preset.id
                  ? "action.selected"
                  : "transparent",
              cursor: "pointer",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
              {preset.name}
            </Typography>
            <Typography
              sx={{
                fontSize: 11,
                color: "text.secondary",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {preset.content}
            </Typography>
          </Box>
        ))}
      </Stack>

      <SectionHeader
        title="Model Selection"
        description="Download and manage local models."
      />

      <Box sx={{ display: "flex", gap: 1, pb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="e.g. llama3, deepseek-r1:7b"
          value={newModelName}
          onChange={(e) => setNewModelName(e.target.value)}
          disabled={isPulling}
          sx={{
            ...appTextFieldSx,
            "& .MuiOutlinedInput-root": {
              bgcolor: "action.hover",
            },
          }}
        />
        <Button
          variant="contained"
          disableElevation
          onClick={handlePullModel}
          disabled={isPulling || !newModelName.trim()}
          startIcon={<Download size={16} />}
          sx={{
            borderRadius: "8px",
            textTransform: "none",
            px: 3,
            bgcolor: "primary.main",
            fontWeight: 600,
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          Pull
        </Button>
      </Box>

      {isPulling && ollama.pullProgress ? (
        <Box sx={{ ...appPanelSx, mb: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 1,
              alignItems: "center",
            }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>
              Pulling {ollama.pullingModel}...
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ color: "text.secondary", fontSize: 12 }}>
                {ollama.pullProgress.status}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCancelPull}
                title="Cancel Pull"
                sx={{ color: "error.main", p: 0.5, borderRadius: "8px" }}
              >
                <XCircle size={14} />
              </IconButton>
            </Box>
          </Box>
          {ollama.pullProgress.total && ollama.pullProgress.completed ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <LinearProgress
                variant="determinate"
                value={(ollama.pullProgress.completed / ollama.pullProgress.total) * 100}
                sx={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "action.selected",
                  "& .MuiLinearProgress-bar": { borderRadius: 3 },
                }}
              />
              <Typography
                sx={{
                  minWidth: 35,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "text.primary",
                }}
              >
                {Math.round(
                  (ollama.pullProgress.completed / ollama.pullProgress.total) * 100,
                )}
                %
              </Typography>
            </Box>
          ) : (
            <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
          )}
        </Box>
      ) : null}

      <Stack spacing={1}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>
            Local Models
          </Typography>
          <IconButton
            size="small"
            onClick={refreshModels}
            disabled={isRefreshing}
            sx={{ borderRadius: "8px" }}
          >
            <RefreshCw size={16} style={isRefreshing ? { animation: "spin 1s linear infinite" } : undefined} />
          </IconButton>
        </Box>

        {ollama.models.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: "text.secondary", py: 2, textAlign: "center" }}>
            No local models found.
          </Typography>
        ) : (
          ollama.models.map((model) => (
            <Box
              key={model.name}
              sx={{
                ...appPanelSx,
                p: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>
                  {model.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
                  {formatFileSize(model.size)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleDeleteModel(model.name)}
                sx={{
                  color: "text.secondary",
                  borderRadius: "8px",
                  "&:hover": { color: "error.main", bgcolor: "error.main" },
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Box>
          ))
        )}
      </Stack>
    </Stack>
  );
}
