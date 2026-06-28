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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Box, Typography, Button as MuiButton, Tooltip } from "@mui/material";
import { Settings, Archive, LogOut, LogIn, Cpu } from "lucide-react";

import { useSidebar } from "@/features/sidebar";
import { ArchivedChatsDialog } from "@/features/chat/components/ArchivedChatsDialog";
import type { SettingsTab } from "@/features/settings/SettingsModal";
import { useViewStore } from "@/lib/view-registry";

interface ProfileMenuProps {
  onOpenSettings?: (tab?: SettingsTab) => void;
}

const menuItemSx = { gap: 2 } as const;

function openModelBrowser() {
  useViewStore.getState().setActiveView("model-browser");
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
            gap: 1,
            p: 1,
            textTransform: "none",
          }}
        >
          <Box
            sx={(theme) => ({
              width: theme.spacing(4.5),
              height: theme.spacing(4.5),
              borderRadius: theme.app.radius.pill,
              bgcolor: "action.selected",
            })}
          />
          {!isCollapsed && (
            <Box
              sx={(theme) => ({
                width: theme.spacing(10),
                height: theme.spacing(1.75),
                bgcolor: "action.selected",
                mb: 0.5,
                borderRadius: theme.shape.borderRadius,
              })}
            >
              <Box
                sx={(theme) => ({
                  width: theme.spacing(5),
                  height: theme.spacing(1.25),
                  bgcolor: "action.selected",
                  borderRadius: theme.shape.borderRadius,
                })}
              />
            </Box>
          )}
        </MuiButton>
      </Box>
    );
  }

  if (isGuest) {
    const guestButton = (
      <MuiButton
        fullWidth
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: isCollapsed ? 0 : 1.5,
          p: 0.5,
          px: isCollapsed ? 0 : 0.75,
          textTransform: "none",
          color: "text.secondary",
          textAlign: "left",
          minWidth: 0,
          ...(isCollapsed
            ? {
                bgcolor: "action.selected",
                borderRadius: theme.app.radius.pill,
                width: 32,
                height: 32,
                mx: "auto",
                flexShrink: 0,
                "&:hover": { bgcolor: "action.selected", opacity: 0.8 },
              }
            : {
                "&:hover": { bgcolor: "action.hover" },
              }),
        })}
      >
        <Box sx={{ display: "flex", flexShrink: 0 }}>
          <Avatar
            sx={(theme) => ({
              width: theme.spacing(isCollapsed ? 3 : 3.5),
              height: theme.spacing(isCollapsed ? 3 : 3.5),
            })}
          >
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
        </Box>
        {!isCollapsed && (
            <Box
              className="animate-slide-in"
              sx={{ flex: 1, overflow: "hidden" }}
            >
              <Typography
                sx={(theme) => ({
                  ...theme.typography.body2,
                  fontWeight: theme.typography.fontWeightMedium,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "text.primary",
                })}
              >
                Guest mode
              </Typography>
              <Typography
                sx={(theme) => ({
                  ...theme.typography.caption,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "text.secondary",
                  opacity: 0.6,
                })}
              >
                Not signed in
              </Typography>
            </Box>
          )}
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
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.body2,
                    fontWeight: theme.typography.fontWeightMedium,
                    lineHeight: 1.2,
                  })}
                >
                  Guest
                </Typography>
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.caption,
                    color: "text.secondary",
                    lineHeight: 1.2,
                  })}
                >
                  Signed out
                </Typography>
              </Box>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onOpenSettings?.("profile")} sx={menuItemSx}>
              <Settings size={16} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openModelBrowser} sx={menuItemSx}>
              <Cpu size={16} />
              <span>Models</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsArchivedOpen(true)} sx={menuItemSx}>
              <Archive size={16} />
              <span>Archived Chats</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.openAuth()} sx={menuItemSx}>
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
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? 0 : 1.25,
        p: 0.75,
        px: isCollapsed ? 0 : 1,
        textTransform: "none",
        color: "text.primary",
        textAlign: "left",
        minWidth: 0,
        borderRadius: isCollapsed ? theme.app.radius.pill : theme.app.radius.control,
        ...(isCollapsed
          ? {
              bgcolor: "action.selected",
              width: 32,
              height: 32,
              mx: "auto",
              flexShrink: 0,
              "&:hover": { bgcolor: "action.selected", opacity: 0.8 },
            }
          : {
              "&:hover": { bgcolor: "action.hover" },
            }),
      })}
    >
      <Box sx={{ display: "flex", flexShrink: 0, position: "relative" }}>
        <Avatar
          sx={(theme) => ({
            width: theme.spacing(isCollapsed ? 3 : 3.5),
            height: theme.spacing(isCollapsed ? 3 : 3.5),
          })}
        >
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
          ) : (
            <AvatarFallback
              sx={(theme) => ({
                ...theme.typography.caption,
                bgcolor: "action.selected",
                color: "text.primary",
              })}
            >
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        {!isCollapsed && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              bgcolor: "success.main",
              border: "2px solid",
              borderColor: "background.sidebar",
              borderRadius: (theme) => theme.app.radius.pill,
            }}
          />
        )}
      </Box>
      {!isCollapsed && (
          <Box
            className="animate-slide-in"
            sx={{ flex: 1, overflow: "hidden" }}
          >
            <Typography
              sx={(theme) => ({
                ...theme.typography.body2,
                fontWeight: theme.typography.fontWeightMedium,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              })}
            >
              {user.fullName || "User"}
            </Typography>
            <Typography
              sx={(theme) => ({
                ...theme.typography.caption,
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "text.secondary",
                opacity: 0.6,
              })}
            >
              Active
            </Typography>
          </Box>
        )}
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Avatar sx={(theme) => ({ width: theme.spacing(4.25), height: theme.spacing(4.25), flexShrink: 0 })}>
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
                ) : (
                  <AvatarFallback
                    sx={(theme) => ({
                      ...theme.typography.caption,
                      bgcolor: "action.selected",
                      color: "text.primary",
                    })}
                  >
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.body2,
                    fontWeight: theme.typography.fontWeightMedium,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  })}
                >
                  {user.fullName || "User"}
                </Typography>
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.caption,
                    color: "text.secondary",
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  })}
                >
                  {user.email}
                </Typography>
              </Box>
            </Box>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOpenSettings?.("profile")} sx={menuItemSx}>
            <Settings size={16} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openModelBrowser} sx={menuItemSx}>
            <Cpu size={16} />
            <span>Models</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsArchivedOpen(true)} sx={menuItemSx}>
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
