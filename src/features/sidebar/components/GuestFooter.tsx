import * as React from "react";
import { Box, IconButton, Tooltip, Typography, Button as MuiButton } from "@mui/material";
import { Info, MoreHorizontal, LogIn, Settings, Archive } from "lucide-react";
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

export function GuestFooter({ onOpenSettings }: { onOpenSettings: () => void }) {
  const openAuth = useAuthStore((s) => s.actions.openAuth);
  const { isCollapsed } = useSidebar();
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
                  sx={{
                    width: 36,
                    height: 36,
                    color: "text.secondary",
                    bgcolor: "action.hover",
                    "&:hover": {
                      bgcolor: "action.selected",
                      color: "text.primary",
                    },
                  }}
                >
                  <Avatar sx={{ width: 22, height: 22 }}>
                    <AvatarFallback
                      sx={{
                        bgcolor: "action.selected",
                        color: "text.secondary",
                        fontSize: "0.65rem",
                      }}
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        p: 1.5,
        borderRadius: 2,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Avatar sx={{ width: 28, height: 28, flexShrink: 0 }}>
          <AvatarFallback
            sx={{
              bgcolor: "action.selected",
              color: "text.secondary",
              fontSize: "0.7rem",
            }}
          >
            ?
          </AvatarFallback>
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              color: "text.primary",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Guest mode
          </Typography>
          <Typography
            sx={{
              fontSize: "11px",
              color: "text.secondary",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Not signed in
          </Typography>
        </Box>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              size="small"
              aria-label="More options"
              sx={{
                p: 0.5,
                color: "text.secondary",
                "&:hover": {
                  color: "text.primary",
                  bgcolor: "action.selected",
                },
              }}
            >
              <MoreHorizontal size={15} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sx={{ minWidth: 180 }}>
            <DropdownMenuItem onClick={onOpenSettings} sx={{ gap: 1.5 }}>
              <Settings size={14} />
              <span>Settings</span>
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
        <Typography sx={{ fontSize: "11px", lineHeight: 1.3 }}>
          Sign in to save your chats.
        </Typography>
      </Box>

      <MuiButton
        variant="contained"
        color="primary"
        fullWidth
        startIcon={<LogIn size={14} />}
        onClick={() => openAuth()}
        sx={{ minHeight: 34, fontSize: "13px", fontWeight: 500 }}
      >
        Sign in
      </MuiButton>

      <ArchivedChatsDialog open={archivedOpen} onOpenChange={setArchivedOpen} />
    </Box>
  );
}
