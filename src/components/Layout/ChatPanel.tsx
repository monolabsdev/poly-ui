import Box from "@mui/material/Box";

type ChatPanelProps = {
  children: React.ReactNode;
  backgroundImage?: string | null;
};

export function ChatPanel({ children, backgroundImage }: ChatPanelProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        bgcolor: "background.chatPanel",
        borderRadius: "14px 0 0 0",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {backgroundImage && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "blur(24px)",
          }}
        />
      )}
      {backgroundImage && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.35)",
          }}
        />
      )}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
