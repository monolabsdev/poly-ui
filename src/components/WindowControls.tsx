import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/utils/platform";

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
    <div className="flex h-full shrink-0 items-center gap-0.5 pr-0">
      {!closeOnly && (
        <>
          <WinButton onClick={() => void w.minimize()} title="Minimize">
            <Minus size={15} strokeWidth={1.5} />
          </WinButton>
          <WinButton onClick={() => void w.toggleMaximize()} title={maximized ? "Restore" : "Maximize"}>
            <Square size={13} strokeWidth={1.5} />
          </WinButton>
        </>
      )}
      <WinButton close onClick={() => void w.close()} title="Close">
        <X size={15} strokeWidth={1.5} />
      </WinButton>
    </div>
  );
}

function WinButton({ children, onClick, title, close = false }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  close?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
      className={`flex h-full w-[46px] cursor-pointer items-center justify-center rounded-none text-muted-foreground ${
        close ? "hover:bg-destructive/15 hover:text-destructive" : "hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
