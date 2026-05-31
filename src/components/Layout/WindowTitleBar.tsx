import { Box } from "@mui/material";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { WindowControls } from "@/components/WindowControls";
import { UpdateChip } from "@/components/UpdateChip";

const TITLE_BAR_HEIGHT = 36;

function WindowTitleBar() {
  if (!IS_MAC && !USE_CUSTOM_WINDOW_CONTROLS) return null;

  return (
    <Box
      data-tauri-drag-region
      component="header"
      sx={{
        height: TITLE_BAR_HEIGHT,
        minHeight: TITLE_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.sidebar",
        userSelect: "none",
        pl: IS_MAC ? "80px" : 1,
        pr: IS_MAC ? 1 : 0,
      }}
    >
      <Box
        data-tauri-drag-region
        sx={{
          display: "flex",
          minWidth: 0,
          flex: 1,
          alignItems: "center",
          gap: 1,
        }}
      >
        <UpdateChip />
      </Box>
      {USE_CUSTOM_WINDOW_CONTROLS && <WindowControls />}
    </Box>
  );
}

export { TITLE_BAR_HEIGHT, WindowTitleBar };
