import * as React from "react";
import { useNotify } from "@/hooks/useNotify";
import { useDevStore } from "@/store/devStore";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";

export function SidebarBrand() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const reducedMotion = useReducedMotion();
  const notify = useNotify();
  const setDevMode = useDevStore((s) => s.actions.setDevMode);
  const devTapCount = React.useRef(0);

  const handleDevTap = () => {
    devTapCount.current += 1;
    if (devTapCount.current >= 10) {
      devTapCount.current = 0;
      setDevMode(true);
      notify.success(
        "Dev mode activated",
        "Tap the PolyUI logo 10 more times to deactivate.",
      );
    } else if (devTapCount.current === 1 && useDevStore.getState().devMode) {
      devTapCount.current = 0;
      setDevMode(false);
      notify.info("Dev mode deactivated");
    }
  };

  return (
    <div
      className={`relative flex w-full items-center ${isCollapsed ? "justify-center" : "justify-between"}`}
    >
      <div
        className={`flex items-center gap-2 overflow-hidden ${
          isCollapsed ? "pointer-events-none w-0 opacity-0" : "w-auto opacity-100"
        } ${reducedMotion ? "" : "transition-opacity duration-200 ease-out"}`}
      >
        <button
          type="button"
          onClick={handleDevTap}
          className="cursor-pointer select-none whitespace-nowrap bg-transparent text-base font-bold text-foreground"
        >
          PolyUI
        </button>
      </div>
      <SidebarTrigger />
      {isCollapsed && (
        <div
          data-testid="collapsed-sidebar-trigger-divider"
          className="absolute top-[calc(var(--sidebar-icon-button)+var(--sidebar-padding)*0.5)] h-px w-(--sidebar-icon-button) bg-sidebar-border"
        />
      )}
    </div>
  );
}
