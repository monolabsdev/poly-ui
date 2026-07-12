import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_LINUX } from "@/lib/utils/platform";

// Not exported from @tauri-apps/api/window; mirrors its ResizeDirection type.
type ResizeDirection = Parameters<ReturnType<typeof getCurrentWindow>["startResizeDragging"]>[0];

const EDGE = 5; // px hit area along edges
const CORNER = 12; // px hit area in corners

// Undecorated GTK windows have no native resize borders (lib.rs disables
// decorations on Linux), so we provide our own via startResizeDragging.
const HANDLES: { direction: ResizeDirection; cursor: string; style: React.CSSProperties }[] = [
  { direction: "North", cursor: "n-resize", style: { top: 0, left: CORNER, right: CORNER, height: EDGE } },
  { direction: "South", cursor: "s-resize", style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE } },
  { direction: "West", cursor: "w-resize", style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { direction: "East", cursor: "e-resize", style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { direction: "NorthWest", cursor: "nw-resize", style: { top: 0, left: 0, width: CORNER, height: CORNER } },
  { direction: "NorthEast", cursor: "ne-resize", style: { top: 0, right: 0, width: CORNER, height: CORNER } },
  { direction: "SouthWest", cursor: "sw-resize", style: { bottom: 0, left: 0, width: CORNER, height: CORNER } },
  { direction: "SouthEast", cursor: "se-resize", style: { bottom: 0, right: 0, width: CORNER, height: CORNER } },
];

export function WindowResizeBorders() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!IS_LINUX) return;
    const w = getCurrentWindow();
    void w.isMaximized().then(setMaximized);
    const unlisten: (() => void)[] = [];
    void w.onResized(() => {
      void w.isMaximized().then(setMaximized);
    }).then((fn) => unlisten.push(fn));
    return () => { unlisten.forEach((fn) => fn()); };
  }, []);

  if (!IS_LINUX || maximized) return null;

  return (
    <>
      {HANDLES.map(({ direction, cursor, style }) => (
        <div
          key={direction}
          style={{ position: "fixed", zIndex: "calc(var(--z-titlebar) + 60)", cursor, ...style }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            void getCurrentWindow().startResizeDragging(direction);
          }}
        />
      ))}
    </>
  );
}
