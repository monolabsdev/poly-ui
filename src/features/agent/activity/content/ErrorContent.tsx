import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/Typography";
import { RotateCcw } from "lucide-react";

export function ErrorContent({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <Box>
      <Typography>
        {error}
      </Typography>
      {onRetry && (
        <Button
          size="small"
          color="inherit"
          startIcon={<RotateCcw size={11} />}
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </Box>
  );
}
