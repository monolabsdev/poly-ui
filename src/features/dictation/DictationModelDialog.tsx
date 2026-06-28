import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { WhisperModelInfo } from "@/hooks/useDictation";

interface DictationModelDialogProps {
  open: boolean;
  models: WhisperModelInfo[];
  selectedModelId: string | null;
  installingModelId: string | null;
  downloadPercent: number | null;
  onClose: () => void;
  onInstall: (modelId: string) => void;
  onSelect: (modelId: string) => void;
}

export function DictationModelDialog({
  open,
  models,
  selectedModelId,
  installingModelId,
  downloadPercent,
  onClose,
  onInstall,
  onSelect,
}: DictationModelDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>Install dictation model</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Dictation runs locally. Choose a Whisper model to download before recording.
        </Typography>

        <Stack spacing={1.25}>
          {models.map((model) => {
            const installing = installingModelId === model.id;
            const selected = selectedModelId === model.id;
            const actionLabel = model.installed ? "Use" : "Download";

            return (
              <Box
                key={model.id}
                sx={{
                  border: "1px solid",
                  borderColor: selected ? "primary.main" : "divider",
                  borderRadius: 1,
                  p: 1.5,
                  bgcolor: selected ? "action.selected" : "background.paper",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography variant="subtitle2">
                        {model.name}
                      </Typography>
                      {model.recommended && (
                        <Chip
                          label="Recommended"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {model.installed && (
                        <Chip label="Installed" size="small" />
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {model.description}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mt: 1,
                      }}
                    >
                      {model.sizeLabel} / {model.speedLabel} /{" "}
                      {model.qualityLabel}
                    </Typography>
                  </Box>

                  <Button
                    size="small"
                    variant={model.installed ? "outlined" : "contained"}
                    disabled={!!installingModelId}
                    onClick={() =>
                      model.installed
                        ? onSelect(model.id)
                        : onInstall(model.id)
                    }
                  >
                    {installing ? "Downloading" : actionLabel}
                  </Button>
                </Box>

                {installing && (
                  <Box sx={{ mt: 1.5 }}>
                    <LinearProgress
                      variant={
                        downloadPercent === null
                          ? "indeterminate"
                          : "determinate"
                      }
                      value={downloadPercent ?? undefined}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mt: 0.75,
                      }}
                    >
                      {downloadPercent === null
                        ? "Starting download..."
                        : `${downloadPercent}% downloaded`}
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!installingModelId}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
