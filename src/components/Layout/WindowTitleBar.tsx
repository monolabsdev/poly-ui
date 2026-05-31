import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minus, X } from "lucide-react";

const TITLE_BAR_HEIGHT = 32;

type WindowAction = "close" | "minimize" | "toggleMaximize";

function isMacOS() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function WindowTitleBar() {
  const nativeRuntime = isTauri();
  const macOS = useMemo(isMacOS, []);
  const [maximized, setMaximized] = useState(false);

  const runWindowAction = useCallback(
    async (action: WindowAction) => {
      if (!nativeRuntime) return;

      try {
        await getCurrentWindow()[action]();
        if (action === "toggleMaximize") {
          setMaximized(await getCurrentWindow().isMaximized());
        }
      } catch (error) {
        console.error(`[WindowTitleBar] Failed to ${action}:`, error);
      }
    },
    [nativeRuntime],
  );

  useEffect(() => {
    if (!nativeRuntime) return;

    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const syncMaximized = async () => {
      try {
        const nextMaximized = await appWindow.isMaximized();
        if (!disposed) setMaximized(nextMaximized);
      } catch (error) {
        console.error("[WindowTitleBar] Failed to read maximized state:", error);
      }
    };

    void syncMaximized();
    void appWindow.onResized(syncMaximized).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [nativeRuntime]);

  const handleDrag = useCallback(
    async (event: React.MouseEvent) => {
      if (!nativeRuntime || event.button !== 0 || event.detail > 1) return;

      try {
        await getCurrentWindow().startDragging();
      } catch (error) {
        console.error("[WindowTitleBar] Failed to start dragging:", error);
      }
    },
    [nativeRuntime],
  );

  const handleDoubleClick = useCallback(() => {
    void runWindowAction("toggleMaximize");
  }, [runWindowAction]);

  const commonButtonProps = {
    type: "button" as const,
    "aria-disabled": !nativeRuntime,
    onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
    onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
  };

  return (
    <Box
      component="header"
      onMouseDown={handleDrag}
      onDoubleClick={handleDoubleClick}
      sx={{
        height: TITLE_BAR_HEIGHT,
        minHeight: TITLE_BAR_HEIGHT,
        position: "relative",
        zIndex: 2147483647,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.sidebar",
        borderBottom: "1px solid",
        borderColor: "divider",
        userSelect: "none",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          pointerEvents: "none",
        }}
      >
        PolyUI
      </Typography>

      {macOS ? (
        <Box sx={{ position: "absolute", left: 12, display: "flex", gap: "8px" }}>
          {[
            { label: "Close", color: "#ff5f57", action: "close" },
            { label: "Minimize", color: "#febc2e", action: "minimize" },
            { label: "Zoom", color: "#28c840", action: "toggleMaximize" },
          ].map(({ label, color, action }) => (
            <Box
              key={action}
              component="button"
              {...commonButtonProps}
              aria-label={label}
              onClick={() => void runWindowAction(action as WindowAction)}
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: color,
                cursor: nativeRuntime ? "pointer" : "default",
                opacity: nativeRuntime ? 1 : 0.55,
                boxShadow: "inset 0 0 0 0.5px rgba(0, 0, 0, 0.18)",
              }}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ position: "absolute", right: 0, top: 0, display: "flex", height: "100%" }}>
          <WindowsButton
            {...commonButtonProps}
            label="Minimize"
            nativeRuntime={nativeRuntime}
            onClick={() => void runWindowAction("minimize")}
          >
            <Minus size={15} strokeWidth={1.5} />
          </WindowsButton>
          <WindowsButton
            {...commonButtonProps}
            label={maximized ? "Restore" : "Maximize"}
            nativeRuntime={nativeRuntime}
            onClick={() => void runWindowAction("toggleMaximize")}
          >
            {maximized ? (
              <Box sx={{ position: "relative", width: 13, height: 13 }}>
                <Box sx={restoreSquareStyles({ top: 1, left: 3 })} />
                <Box sx={restoreSquareStyles({ top: 4, left: 0, bgcolor: "background.sidebar" })} />
              </Box>
            ) : (
              <Maximize2 size={13} strokeWidth={1.5} />
            )}
          </WindowsButton>
          <WindowsButton
            {...commonButtonProps}
            label="Close"
            nativeRuntime={nativeRuntime}
            close
            onClick={() => void runWindowAction("close")}
          >
            <X size={15} strokeWidth={1.5} />
          </WindowsButton>
        </Box>
      )}
    </Box>
  );
}

function restoreSquareStyles(extra: Record<string, unknown>) {
  return {
    position: "absolute",
    width: 9,
    height: 9,
    border: "1px solid currentColor",
    ...extra,
  };
}

type WindowsButtonProps = {
  label: string;
  nativeRuntime: boolean;
  close?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  onMouseDown: (event: React.MouseEvent) => void;
  onDoubleClick: (event: React.MouseEvent) => void;
  type: "button";
  "aria-disabled": boolean;
};

function WindowsButton({
  label,
  nativeRuntime,
  close = false,
  children,
  ...props
}: WindowsButtonProps) {
  return (
    <Box
      component="button"
      {...props}
      aria-label={label}
      sx={{
        width: 46,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
        cursor: nativeRuntime ? "pointer" : "default",
        opacity: nativeRuntime ? 1 : 0.55,
        transition: "background-color 0.14s ease, color 0.14s ease",
        "&:hover": nativeRuntime
          ? close
            ? { bgcolor: "#c42b1c", color: "#ffffff" }
            : { bgcolor: "action.hover", color: "text.primary" }
          : undefined,
      }}
    >
      {children}
    </Box>
  );
}

export { TITLE_BAR_HEIGHT, WindowTitleBar };
