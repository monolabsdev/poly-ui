import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ModelProvider } from "@/store/modelStore";
import { useOllama } from "@/services/ollama";
import {
  Box,
  Select,
  MenuItem,
  Typography,
  FormControl,
  Link,
  Tooltip,
  IconButton,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import {
  X,
  Plus,
  AlertCircle,
  ScrollText,
} from "lucide-react";
import { PROMPT_PRESETS } from "@/constants/promptPresets";
import { useSettingsStore } from "@/store/settingsStore";
import { ModelSelector } from "@/components/Chat/ModelSelector";


interface HeaderProps {
  selectedModels: string[];
  selectedProviders: ModelProvider[];
  onModelChange: (
    index: number,
    provider: ModelProvider,
    model: string,
  ) => void;
  onAddModel: () => void;
  onRemoveModel: (index: number) => void;
  onSetDefault: (model: string) => void;
  isTemporary?: boolean;
  onToggleTemporaryChat: () => void;
  transparent?: boolean;
}

export const Header = memo(function Header({
  selectedModels,
  selectedProviders,
  onModelChange,
  onAddModel,
  onRemoveModel,
  onSetDefault,
  isTemporary,
  onToggleTemporaryChat,
  transparent = false,
}: HeaderProps) {
  const { selectedPromptPreset, actions } = useSettingsStore(
    useShallow((state) => ({
      selectedPromptPreset: state.selectedPromptPreset,
      actions: state.actions,
    })),
  );
  const ollama = useOllama();

  const pullCompleted = ollama.pullProgress?.completed ?? 0;
  const pullTotal = ollama.pullProgress?.total ?? 0;
  const hasPullProgress =
    typeof ollama.pullProgress?.completed === "number" &&
    typeof ollama.pullProgress?.total === "number" &&
    pullTotal > 0;
  const pullProgressPercent = hasPullProgress
    ? Math.round((pullCompleted / pullTotal) * 100)
    : undefined;

  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        minHeight: 56,
        flexShrink: 0,
        alignItems: "flex-start",
        justifyContent: "space-between",
        bgcolor: transparent ? "transparent" : "background.default",
        backdropFilter: "blur(12px)",
        px: { xs: 2, md: 3 },
        py: { xs: 1.5, sm: 1 },
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 }, minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, flex: 1 }}>
          {ollama.pullingModel ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                minWidth: { xs: 120, sm: 200 },
                px: 0.5,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: "text.primary" }}
                >
                  Pulling {ollama.pullingModel}...
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {hasPullProgress
                    ? `${pullProgressPercent}%`
                    : (ollama.pullProgress?.status ?? "Starting...")}
                </Typography>
              </Box>
              <LinearProgress
                variant={hasPullProgress ? "determinate" : "indeterminate"}
                value={pullProgressPercent}
                sx={{ height: 4, borderRadius: 2, bgcolor: "action.hover" }}
              />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 0.5, sm: 1 },
                  flexWrap: "wrap",
                  minWidth: 0,
                }}
              >
                {selectedModels.length === 0 ? (
                  <ModelSelector
                    model=""
                    provider="OllamaLocal"
                    onChange={(provider, model) =>
                      onModelChange(0, provider, model)
                    }
                  />
                ) : null}
                {selectedModels.map((selectedModel, index) => (
                  <Box
                    key={`${selectedModel}-${index}`}
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                  >
                    <ModelSelector
                      model={selectedModel}
                      provider={selectedProviders[index] ?? "OllamaLocal"}
                      onChange={(provider, model) =>
                        onModelChange(index, provider, model)
                      }
                    />
                    {selectedModels.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => onRemoveModel(index)}
                        sx={{ p: 0.5, color: "text.secondary" }}
                      >
                        <X size={14} />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Box
                  onClick={onAddModel}
                  sx={{
                    color: "text.secondary",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    ml: 1,
                    "&:hover": { color: "text.primary" },
                  }}
                >
                  <Plus size={16} />
                </Box>
              </Box>
              <Link
                component="button"
                variant="caption"
                underline="none"
                onClick={() => onSetDefault(selectedModels[0])}
                disabled={!selectedModels[0]}
                sx={{
                  color: "text.secondary",
                  fontSize: "11px",
                  textAlign: "left",
                  ml: 0.2,
                  "&:hover": { color: "text.primary" },
                }}
              >
                Set as default
              </Link>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1.5 }, flexShrink: 0 }}>
        {ollama.state !== "online" && (
          <Tooltip title={ollama.state === "reconnecting" ? "Reconnecting to providers..." : "Providers offline"}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 1 }}>
              {ollama.state === "reconnecting" ? (
                <CircularProgress size={12} color="inherit" sx={{ opacity: 0.5 }} />
              ) : (
                <Box component="span" sx={{ color: "error.main", display: "flex" }}>
                  <AlertCircle size={14} />
                </Box>
              )}
              <Typography variant="caption" sx={{ color: ollama.state === "reconnecting" ? "text.secondary" : "error.main", fontSize: "11px", fontWeight: 500 }}>
                {ollama.state === "reconnecting" ? "Reconnecting" : "Offline"}
              </Typography>
            </Box>
          </Tooltip>
        )}
        <Tooltip
          title={
            isTemporary ? "Disable Temporary Chat" : "Enable Temporary Chat"
          }
        >
          <IconButton
            onClick={onToggleTemporaryChat}
            size="small"
            sx={{
              p: 0.75,
              borderRadius: "6px",
              cursor: "pointer",
              color: isTemporary ? "primary.main" : "text.secondary",
              bgcolor: isTemporary ? "action.selected" : "transparent",
              "&:hover": {
                bgcolor: "action.hover",
                color: "text.primary",
              },
            }}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              style={{ width: 18, height: 18 }}
            >
              {isTemporary ? (
                <path
                  d="M8 12L11 15L16 10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              ) : null}
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2.5 3.5"
              ></path>
            </svg>
          </IconButton>
        </Tooltip>

        <Tooltip title="Switch Prompt Preset">
          <FormControl size="small" sx={{ m: 0 }}>
            <Select
              value={selectedPromptPreset}
              onChange={(e) =>
                actions.setPromptPreset(e.target.value as "default" | "technical" | "creative" | "concise")
              }
              IconComponent={() => null}
              sx={{
                bgcolor: "transparent",
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                "& .MuiSelect-select": {
                  p: 0.75,
                  paddingRight: "6px !important",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color:
                    selectedPromptPreset !== "default"
                      ? "primary.main"
                      : "text.secondary",
                  bgcolor:
                    selectedPromptPreset !== "default"
                      ? "action.selected"
                      : "transparent",
                  "&:hover": {
                    bgcolor: "action.hover",
                    color: "text.primary",
                  },
                  minHeight: "unset !important",
                  height: "30px !important",
                  boxSizing: "border-box",
                  lineHeight: 1,
                },
              }}
              renderValue={() => (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <ScrollText size={18} />
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: "background.paper",
                    mt: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    minWidth: 200,
                  },
                },
              }}
            >
              {PROMPT_PRESETS.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {preset.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 250 }}
                    >
                      {preset.content}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Tooltip>
      </Box>
    </Box>
  );
});

