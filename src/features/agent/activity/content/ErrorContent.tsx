import { useMemo } from "react";
import { Box, Button, Typography } from "@mui/material";
import { RotateCcw } from "lucide-react";
import { agentBtn } from "../styles";

export function ErrorContent({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  const retryBtnSx = useMemo(() => ({ ...agentBtn, mt: 0.35, color: "error.main" }), []);
  return (
    <Box>
      <Typography sx={{ fontSize: 12, lineHeight: 1.4, color: "error.main" }}>
        {error}
      </Typography>
      {onRetry && (
        <Button
          size="small"
          color="inherit"
          startIcon={<RotateCcw size={11} />}
          onClick={onRetry}
          sx={retryBtnSx}
        >
          Retry
        </Button>
      )}
    </Box>
  );
}
