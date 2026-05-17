import React from "react";
import { useAuthStore } from "@/store/authStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const { user, isGuest, actions, isLoading } = useAuthStore();
  const { isCollapsed } = useSidebar();
  const [isArchivedOpen, setIsArchivedOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Box className="w-full flex flex-col items-center" sx={{ opacity: 0.5 }}>
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
        <Box className="relative flex-shrink-0" sx={{ display: "flex" }}>
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
                sx={{ fontWeight: 600, fontSize: "13.5px" }}
                className="truncate"
              >
                Guest
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                className="truncate"
                sx={{ display: "block", mt: -0.2 }}
              >
                Signed out
              </Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </MuiButton>
    );

    return (
      <Box className="w-full flex flex-col items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <Tooltip title="Guest" placement="right" arrow>
                {guestButton}
              </Tooltip>
            ) : (
              guestButton
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
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
            <DropdownMenuItem className="cursor-pointer" onClick={onOpenSettings}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setIsArchivedOpen(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              <span>Archived Chats</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => actions.openAuth()}
            >
              <LogIn className="mr-2 h-4 w-4" />
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
      <Box className="relative flex-shrink-0" sx={{ display: "flex" }}>
        <Avatar sx={{ width: isCollapsed ? 28 : 36, height: isCollapsed ? 28 : 36 }}>
          {user.avatarUrl && (
            <AvatarImage
              src={user.avatarUrl}
              alt={user.fullName || user.email}
            />
          )}
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
              sx={{ fontWeight: 600, fontSize: "13.5px" }}
              className="truncate"
            >
              {user.fullName || "User"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              className="truncate"
              sx={{ display: "block", mt: -0.2 }}
            >
              {user.status}
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
    </MuiButton>
  );

  return (
    <Box className="w-full flex flex-col items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isCollapsed ? (
            <Tooltip title={user.fullName || user.email} placement="right" arrow>
              {button}
            </Tooltip>
          ) : (
            button
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
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
          <DropdownMenuItem className="cursor-pointer" onClick={onOpenSettings}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setIsArchivedOpen(true)}
          >
            <Archive className="mr-2 h-4 w-4" />
            <span>Archived Chats</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            sx={{ color: "error.main", "&:focus": { color: "error.main" } }}
            onClick={() => actions.logout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
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
