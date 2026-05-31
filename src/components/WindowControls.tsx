import { Box } from "@mui/material";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { Minus, Maximize2, X } from "lucide-react";
import { USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";

export function WindowControls({ closeOnly = false }: { closeOnly?: boolean }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!USE_CUSTOM_WINDOW_CONTROLS || closeOnly) return;
    const w = getCurrentWindow();
    void w.isMaximized().then(setMaximized);
    const unlisten: (() => void)[] = [];
    void w.onResized(() => {
      void w.isMaximized().then(setMaximized);
    }).then((fn) => unlisten.push(fn));
    return () => { unlisten.forEach((fn) => fn()); };
  }, [closeOnly]);

  if (!USE_CUSTOM_WINDOW_CONTROLS) return null;

  const w = getCurrentWindow();
  return (
    <Box sx={{ display: "flex", height: "100%", flexShrink: 0, alignItems: "center", gap: 0.25, pr: 0.5 }}>
      {!closeOnly && (
        <>
          <WinButton onClick={() => void w.minimize()} title="Minimize">
            <Minus size={15} strokeWidth={1.5} />
          </WinButton>
          <WinButton onClick={() => void w.toggleMaximize()} title={maximized ? "Restore" : "Maximize"}>
            <Maximize2 size={13} strokeWidth={1.5} />
          </WinButton>
        </>
      )}
      <WinButton close onClick={() => void w.close()} title="Close">
        <X size={15} strokeWidth={1.5} />
      </WinButton>
    </Box>
  );
}

function WinButton({ children, onClick, title, close = false }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  close?: boolean;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      title={title}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        width: 46,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
        cursor: "pointer",
        transition: "background-color 0.14s ease, color 0.14s ease",
        "&:hover": close
          ? { bgcolor: "#c42b1c", color: "#ffffff" }
          : { bgcolor: "action.hover", color: "text.primary" },
      }}
    >
      {children}
    </Box>
  );
}
