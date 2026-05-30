import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/store/authStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Box, Typography, Button as MuiButton, Tooltip } from "@mui/material";
import { Settings, Archive, LogOut, LogIn } from "lucide-react";

import { useSidebar } from "@/components/Layout/Sidebar";
import { ArchivedChatsDialog } from "@/components/Chat/ArchivedChatsDialog";

import { motion, AnimatePresence } from "motion/react";

interface ProfileMenuProps {
  onOpenSettings?: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  onOpenSettings,
}) => {
  const { user, isGuest, actions, isLoading } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isGuest: state.isGuest,
      actions: state.actions,
      isLoading: state.isLoading,
    })),
  );
  const { isCollapsed } = useSidebar();
  const [isArchivedOpen, setIsArchivedOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.5 }}>
        <MuiButton
          fullWidth
          disabled
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1.5,
            p: 1,
            borderRadius: 2,
            textTransform: "none",
          }}
        >
          <Box sx={{ width: 36, height: 36, borderRadius: "50%", bgcolor: "action.selected" }} />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <Box sx={{ width: 80, height: 14, bgcolor: "action.selected", mb: 0.5, borderRadius: 1 }} />
                <Box sx={{ width: 40, height: 10, bgcolor: "action.selected", borderRadius: 1 }} />
              </motion.div>
            )}
          </AnimatePresence>
        </MuiButton>
      </Box>
    );
  }

  if (isGuest) {
    const guestButton = (
      <MuiButton
        fullWidth
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: isCollapsed ? 0 : 1.5,
          p: 1,
          px: isCollapsed ? 0 : 1,
          borderRadius: "12px",
          textTransform: "none",
          color: "text.secondary",
          textAlign: "left",
          minWidth: 0,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box sx={{ display: "flex", flexShrink: 0, position: "relative" }}>
          <Avatar sx={{ width: isCollapsed ? 28 : 36, height: isCollapsed ? 28 : 36 }}>
            <AvatarFallback
              sx={{
                bgcolor: "action.selected",
                color: "text.secondary",
                fontSize: isCollapsed ? "0.65rem" : "0.75rem",
              }}
            >
              ?
            </AvatarFallback>
          </Avatar>
        </Box>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              style={{ flex: 1, overflow: "hidden" }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontSize: "13.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                Guest
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                Signed out
              </Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </MuiButton>
    );

    return (
      <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <Tooltip title="Guest" placement="right">
                {guestButton}
              </Tooltip>
            ) : (
              guestButton
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sx={{ width: 256 }}>
            <DropdownMenuLabel>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                  Guest
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                  Signed out
                </Typography>
              </Box>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSettings} sx={{ gap: 2 }}>
              <Settings size={16} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsArchivedOpen(true)} sx={{ gap: 2 }}>
              <Archive size={16} />
              <span>Archived Chats</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.openAuth()} sx={{ gap: 2 }}>
              <LogIn size={16} />
              <span>Log In</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ArchivedChatsDialog
          open={isArchivedOpen}
          onOpenChange={setIsArchivedOpen}
        />
      </Box>
    );
  }

  if (!user) return null;

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user.email[0].toUpperCase();

  const button = (
    <MuiButton
      fullWidth
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? 0 : 1.5,
        p: 1,
        px: isCollapsed ? 0 : 1,
        borderRadius: "12px",
        textTransform: "none",
        color: "text.primary",
        textAlign: "left",
        minWidth: 0,
        "&:hover": {
          bgcolor: "action.hover",
        },
      }}
    >
      <Box sx={{ display: "flex", flexShrink: 0, position: "relative" }}>
        <Avatar sx={{ width: isCollapsed ? 28 : 36, height: isCollapsed ? 28 : 36 }}>

          <AvatarFallback
            sx={{
              bgcolor: "action.selected",
              color: "text.primary",
              fontSize: isCollapsed ? "0.65rem" : "0.75rem",
            }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              bgcolor: "success.main",
              border: "2px solid",
              borderColor: "background.sidebar",
              borderRadius: "50%",
            }}
          />
        )}
      </Box>
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            style={{ flex: 1, overflow: "hidden" }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: "13.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {user.fullName || "User"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              Active
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
    </MuiButton>
  );

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isCollapsed ? (
            <Tooltip title={user.fullName || user.email} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sx={{ width: 256 }}>
          <DropdownMenuLabel>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, lineHeight: 1.2 }}
              >
                {user.fullName || "User"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ lineHeight: 1.2 }}
              >
                {user.email}
              </Typography>
            </Box>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenSettings} sx={{ gap: 2 }}>
            <Settings size={16} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsArchivedOpen(true)} sx={{ gap: 2 }}>
            <Archive size={16} />
            <span>Archived Chats</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            sx={{ color: "error.main", "&:focus": { color: "error.main" }, gap: 2 }}
            onClick={() => actions.logout()}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchivedChatsDialog
        open={isArchivedOpen}
        onOpenChange={setIsArchivedOpen}
      />
    </Box>
  );
};
