import { Box, Button, Typography } from "@mui/material";
import { EyeOff } from "lucide-react";

interface EmptyStateProps {
  children?: React.ReactNode;
  selectedModels: string[];
  userName?: string;
  isTemporary?: boolean;
  providerOnline: boolean;
  onOpenConnections: () => void;
}

export function EmptyState({
  children,
  selectedModels,
  userName,
  isTemporary,
  providerOnline,
  onOpenConnections,
}: EmptyStateProps) {
  const isMultiModel = selectedModels.length >= 2;
  const headingText = (() => {
    if (!providerOnline) return "No provider connected";
    if (isMultiModel) return `Hello, ${userName || "User"}`;
    return selectedModels[0] || "PolyUI";
  })();

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        maxWidth: isMultiModel ? "100%" : 840,
        mx: "auto",
        width: "100%",
        height: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          mb: providerOnline ? 6 : 3,
        }}
      >
        {isTemporary && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: "20px",
              color: "text.secondary",
              mb: 1,
            }}
          >
            <EyeOff />
            <Typography sx={{ fontSize: "18px", fontWeight: 400 }}>
              Temporary Chat
            </Typography>
          </Box>
        )}
        <Typography
          variant="h3"
          sx={{
            fontWeight: 600,
            color: "primary.main",
            fontSize: { xs: "24px", sm: "30px", md: "36px" },
            letterSpacing: "-0.5px",
            opacity: 1,
            textAlign: "center",
          }}
        >
          {headingText}
        </Typography>
        {!providerOnline ? (
          <>
            <Typography sx={{ color: "text.secondary", fontSize: 14, textAlign: "center", maxWidth: 460 }}>
              Start Ollama, then connect it here. Ollama runs local models on your machine at localhost:11434.
            </Typography>
            <Button variant="contained" onClick={onOpenConnections} sx={{ mt: 1, textTransform: "none", fontWeight: 700 }}>
              Open Connections
            </Button>
          </>
        ) : null}
      </Box>

      <Box
        sx={{ width: "100%", maxWidth: 768 }}
      >
        {children}
      </Box>
    </Box>
  );
}
