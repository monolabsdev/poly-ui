import * as React from "react";
import { Box, IconButton, Tooltip, Typography, Button as MuiButton } from "@mui/material";
import { Info, MoreHorizontal, LogIn, Settings, Archive, Cpu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArchivedChatsDialog } from "@/features/chat/components/ArchivedChatsDialog";
import { useAuthStore } from "@/store/authStore";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import { sidebarIconButtonSx } from "@/features/sidebar/components/SidebarPrimitives";
import { useViewStore } from "@/lib/view-registry";

export function GuestFooter({ onOpenSettings }: { onOpenSettings: () => void }) {
  const openAuth = useAuthStore((s) => s.actions.openAuth);
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();
  const [archivedOpen, setArchivedOpen] = React.useState(false);

  if (isCollapsed) {
    return (
      <>
        <DropdownMenu>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Tooltip title="Guest mode" placement="right">
              <DropdownMenuTrigger asChild>
                <IconButton
                  aria-label="Guest menu"
                  sx={(theme) => ({
                    ...sidebarIconButtonSx(theme, reducedMotion),
                    bgcolor: "action.selected",
                    "&:hover": {
                      bgcolor: "action.selected",
                      opacity: 0.8,
                    },
                  })}
                >
                  <Avatar sx={(theme) => ({ width: theme.spacing(3), height: theme.spacing(3) })}>
                    <AvatarFallback
                      sx={(theme) => ({
                        ...theme.typography.caption,
                        bgcolor: "action.selected",
                        color: "text.secondary",
                      })}
                    >
                      ?
                    </AvatarFallback>
                  </Avatar>
                </IconButton>
              </DropdownMenuTrigger>
            </Tooltip>
          </Box>
          <DropdownMenuContent align="end" sx={{ minWidth: 180 }}>
            <DropdownMenuItem onClick={onOpenSettings} sx={{ gap: 1.5 }}>
              <Settings size={14} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useViewStore.getState().setActiveView("model-browser")} sx={{ gap: 1.5 }}>
              <Cpu size={14} />
              <span>Models</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setArchivedOpen(true)}
              sx={{ gap: 1.5 }}
            >
              <Archive size={14} />
              <span>Archived Chats</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAuth()} sx={{ gap: 1.5 }}>
              <LogIn size={14} />
              <span>Sign in</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ArchivedChatsDialog
          open={archivedOpen}
          onOpenChange={setArchivedOpen}
        />
      </>
    );
  }

  return (
    <>
      <Box
        data-testid="guest-footer-flat"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          px: 1.25,
          pb: 0.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Avatar sx={(theme) => ({ width: theme.spacing(3.5), height: theme.spacing(3.5), flexShrink: 0 })}>
            <AvatarFallback
              sx={(theme) => ({
                ...theme.typography.caption,
                bgcolor: "action.selected",
                color: "text.secondary",
              })}
            >
              ?
            </AvatarFallback>
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography
              sx={(theme) => ({
                ...theme.typography.body2,
                fontWeight: theme.typography.fontWeightMedium,
                color: "text.primary",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })}
            >
              Guest mode
            </Typography>
            <Typography
              sx={(theme) => ({
                ...theme.typography.caption,
                color: "text.secondary",
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })}
            >
              Not signed in
            </Typography>
          </Box>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="small"
                aria-label="More options"
                sx={(theme) => sidebarIconButtonSx(theme, reducedMotion)}
              >
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sx={{ minWidth: 180 }}>
              <DropdownMenuItem onClick={onOpenSettings} sx={{ gap: 1.5 }}>
                <Settings size={14} />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => useViewStore.getState().setActiveView("model-browser")} sx={{ gap: 1.5 }}>
                <Cpu size={14} />
                <span>Models</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setArchivedOpen(true)}
                sx={{ gap: 1.5 }}
              >
                <Archive size={14} />
                <span>Archived Chats</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            color: "text.secondary",
          }}
        >
          <Info size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
          <Typography
            sx={(theme) => ({
              ...theme.typography.caption,
              lineHeight: 1.3,
            })}
          >
            Sign in to save your chats.
          </Typography>
        </Box>

        <MuiButton
          variant="contained"
          color="primary"
          fullWidth
          startIcon={<LogIn size={14} />}
          onClick={() => openAuth()}
          sx={{
            minHeight: 34,
            typography: "body2",
            fontWeight: (theme) => theme.typography.fontWeightMedium,
            textTransform: "none",
          }}
        >
          Sign in
        </MuiButton>
      </Box>

      <ArchivedChatsDialog open={archivedOpen} onOpenChange={setArchivedOpen} />
    </>
  );
}
