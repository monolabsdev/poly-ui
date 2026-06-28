import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog-panel";
import { DialogActions } from "@/components/ui/dialog-panel";
import { DialogContent } from "@/components/ui/dialog-panel";
import { DialogTitle } from "@/components/ui/dialog-panel";
import { LinearProgress } from "@/components/ui/linear-progress";
import { Stack } from "@/components/ui/Stack";
import { Typography } from "@/components/ui/Typography";
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
    >
      <DialogTitle>Install dictation model</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
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
                className={selected ? "border-primary" : undefined}
              >
                <Box
                >
                  <Box>
                    <Box
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
                    >
                      {model.description}
                    </Typography>
                    <Typography
                      variant="caption"
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
                  <Box>
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
