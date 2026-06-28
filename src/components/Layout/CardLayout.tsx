import Box from "@mui/material/Box";

type CardLayoutProps = {
  backgroundImage?: string | null;
  header: React.ReactNode;
  children: React.ReactNode;
};

export function CardLayout({ backgroundImage, header, children }: CardLayoutProps) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: backgroundImage ? undefined : "background.sidebar",
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          bgcolor: "background.paper",
          borderRadius: 1.5,
          mr: { xs: 0.5, sm: 1.5 },
          mt: { xs: 0.5, sm: 1.5 },
          mb: { xs: 0.5, sm: 1.5 },
          ml: 0,
        }}
      >
        <Box
          sx={{
            bgcolor: "background.paper",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
          }}
        >
          {header}
        </Box>
        {children}
      </Box>
    </Box>
  );
}
