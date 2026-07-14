import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/utils/platform";
import { WindowControls } from "@/components/WindowControls";
import { UpdateChip } from "@/components/UpdateChip";

const TITLE_BAR_HEIGHT = 36;

function WindowTitleBar() {
  if (!IS_MAC && !USE_CUSTOM_WINDOW_CONTROLS) return null;

  return (
    <header
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[var(--z-titlebar)] flex h-9 min-h-9 shrink-0 select-none items-center rounded-none bg-sidebar"
      style={{ paddingLeft: IS_MAC ? 80 : 8, paddingRight: IS_MAC ? 8 : 0 }}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <UpdateChip />
      </div>
      {USE_CUSTOM_WINDOW_CONTROLS && <WindowControls />}
    </header>
  );
}

export { TITLE_BAR_HEIGHT, WindowTitleBar };
