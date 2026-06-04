import * as React from "react";
import { Box } from "@mui/material";
import { useElementBreakpoint } from "@/hooks/useResizePerformance";

interface SidebarContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(
  undefined,
);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [openMobile, setOpenMobile] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const handleBreakpointChange = React.useCallback((matches: boolean) => {
    setIsMobile((current) => (current === matches ? current : matches));
  }, []);

  useElementBreakpoint(rootRef, 900, handleBreakpointChange);

  const value = React.useMemo(
    () => ({
      isOpen: !isCollapsed,
      setIsOpen: (open: boolean) => setIsCollapsed(!open),
      isCollapsed,
      setIsCollapsed,
      isMobile,
      openMobile,
      setOpenMobile,
    }),
    [isCollapsed, isMobile, openMobile],
  );

  return (
    <SidebarContext.Provider value={value}>
      <Box
        ref={rootRef}
        data-resize-contain
        sx={{
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        {children}
      </Box>
    </SidebarContext.Provider>
  );
}
