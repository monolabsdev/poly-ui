import { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton, 
  LinearProgress,
  Stack,
} from "@mui/material";
import { Download, Trash2, RefreshCw, XCircle } from "lucide-react";
import { appPanelSx, appTextFieldSx } from "@/components/ui/appDialog";
import { SectionHeader, EmptyState } from "./SettingComponents";

import { useOllama, type PullProgress } from "@/services/ollama";
import { loggedInvoke, formatFileSize, cn } from "@/lib/utils";
import { listen } from "@tauri-apps/api/event";

export function ModelManagement() {
  const ollama = useOllama();
  const [newModelName, setNewModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshModels = async () => {
    setIsRefreshing(true);
    try {
      await ollama.refresh();
    } catch (error) {
      console.error("Failed to refresh models:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePullModel = async () => {
    const hasModelName = newModelName.trim().length > 0;
    if (!hasModelName) return;

    const modelToPull = newModelName.trim();
    ollama.actions.setPullingModel(modelToPull);
    setIsPulling(true);
    ollama.actions.setPullProgress({ status: "Starting..." });

    try {
      await loggedInvoke("pull_model", { model: modelToPull });
      setNewModelName("");
      // Wait a moment for model to be fully registered, then refresh
      await new Promise(r => setTimeout(r, 1000));
      await refreshModels();
      // Refresh again after a short delay to ensure we catch it
      await new Promise(r => setTimeout(r, 500));
      await refreshModels();
    } catch (error) {
      const isCancelled = error === "Pull cancelled by user";
      if (!isCancelled) {
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
    const confirmed = confirm(`Are you sure you want to delete ${modelName}?`);
    if (!confirmed) return;

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
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [ollama.actions]);

  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <SectionHeader 
          title="Pull New Model" 
          description="Download a model from the Ollama registry."
        />
        <Box sx={{ display: "flex", gap: 1 }}>
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
                ...appTextFieldSx["& .MuiOutlinedInput-root"],
                bgcolor: "action.hover",
              }
            }}
          />
          <Button
            variant="contained"
            disableElevation
            onClick={handlePullModel}
            disabled={isPulling || newModelName.trim().length === 0}
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
          <Box sx={appPanelSx}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, alignItems: "center" }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>
                Pulling {ollama.pullingModel}...
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ color: "text.secondary", fontSize: 12 }}>
                  {ollama.pullProgress.status}
                </Typography>
                <IconButton size="small" onClick={handleCancelPull} title="Cancel Pull" sx={{ color: "error.main", p: 0.5, borderRadius: "8px" }}>
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
                    "& .MuiLinearProgress-bar": {
                        borderRadius: 3,
                    }
                  }}
                />
                <Typography sx={{ minWidth: 35, fontSize: 12, fontWeight: 600, color: "text.primary" }}>
                  {Math.round((ollama.pullProgress.completed / ollama.pullProgress.total) * 100)}%
                </Typography>
              </Box>
            ) : (
              <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
            )}
          </Box>
        ) : null}
      </Stack>

      <Stack spacing={1.5}>
        <SectionHeader 
          title="Local Models" 
          description="Models currently stored on your machine."
          action={
            <IconButton size="small" onClick={refreshModels} disabled={isRefreshing} sx={{ borderRadius: "8px" }}>
              <RefreshCw size={16} className={cn(isRefreshing && "animate-spin")} />
            </IconButton>
          }
        />

        <Stack spacing={1}>
          {ollama.models.map((model) => (
            <Box key={model.name} sx={{ ...appPanelSx, p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                  "&:hover": { color: "error.main", bgcolor: "error.main", opacity: 0.8 },
                }}
              >
                <Trash2 size={16} />
              </IconButton>
            </Box>
          ))}
          {ollama.models.length === 0 && !isRefreshing ? (
            <EmptyState>No local models found.</EmptyState>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}
