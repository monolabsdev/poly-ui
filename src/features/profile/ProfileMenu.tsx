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
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { Button as Button } from "@/components/ui/button";
import { Settings, Archive, LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

import { useSidebar } from "@/components/ui/sidebar";
import { ArchivedChatsDialog } from "@/features/chat/components/ArchivedChatsDialog";
import type { SettingsTab } from "@/features/settings/SettingsModal";

interface ProfileMenuProps {
  onOpenSettings?: (tab?: SettingsTab) => void;
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
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isArchivedOpen, setIsArchivedOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Box className="px-2 pb-1">
        <Button
          type="button"
          variant="ghost"
          fullWidth
          disabled
          className={cn(
            "h-auto min-w-0 justify-start gap-2 rounded-xl px-2 py-2",
            isCollapsed && "justify-center px-0",
          )}
        >
          <Box className="size-8 shrink-0 rounded-full bg-muted" />
          {!isCollapsed && (
            <Box className="flex min-w-0 flex-1 flex-col gap-1">
              <Box className="h-3 w-24 rounded-full bg-muted" />
              <Box className="h-3 w-14 rounded-full bg-muted" />
            </Box>
          )}
        </Button>
      </Box>
    );
  }

  if (isGuest) {
    const guestButton = (
      <Button
        type="button"
        variant="ghost"
        fullWidth
        title={isCollapsed ? "Guest" : undefined}
        className={cn(
          "h-auto min-w-0 justify-start gap-2 rounded-xl px-2 py-2 text-left",
          isCollapsed && "justify-center px-0",
        )}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarFallback>
              ?
          </AvatarFallback>
        </Avatar>
        {!isCollapsed && (
            <Box
              className="flex min-w-0 flex-1 flex-col"
            >
              <Typography
                noWrap
                weight="medium"
              >
                Guest mode
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
              >
                Not signed in
              </Typography>
            </Box>
          )}
      </Button>
    );

    return (
      <Box className="px-2 pb-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {guestButton}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>
              <Box className="flex min-w-0 flex-col">
                <Typography
                  weight="medium"
                  noWrap
                >
                  Guest
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                >
                  Signed out
                </Typography>
              </Box>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-3 whitespace-nowrap" onClick={() => onOpenSettings?.("profile")}>
              <Settings size={16} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 whitespace-nowrap" onClick={() => setIsArchivedOpen(true)}>
              <Archive size={16} />
              <span>Archived Chats</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-3 whitespace-nowrap" onClick={() => actions.openAuth()}>
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
    <Button
      type="button"
      variant="ghost"
      fullWidth
      title={isCollapsed ? user.fullName || user.email : undefined}
      className={cn(
        "flex h-auto min-w-0 items-center justify-start gap-2 rounded-xl px-2 py-2 text-left",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Box className="relative shrink-0">
        <Avatar className="size-8">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
          ) : (
            <AvatarFallback seed={user.email}>{initials}</AvatarFallback>
          )}
        </Avatar>
      </Box>
      {!isCollapsed && (
          <Box
            className="flex min-w-0 flex-1 flex-col"
          >
            <Typography
              noWrap
              weight="medium"
            >
              {user.fullName || "User"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
            >
              Active
            </Typography>
          </Box>
        )}
    </Button>
  );

  return (
    <Box className="px-2 pb-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {button}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuLabel className="p-2">
            <Box className="flex min-w-0 items-center gap-2">
              <Avatar className="size-8 shrink-0">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
                ) : (
                  <AvatarFallback seed={user.email}>{initials}</AvatarFallback>
                )}
              </Avatar>
              <Box className="flex min-w-0 flex-1 flex-col">
                <Typography
                  weight="medium"
                  noWrap
                >
                  {user.fullName || "User"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                >
                  {user.email}
                </Typography>
              </Box>
            </Box>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-3 whitespace-nowrap" onClick={() => onOpenSettings?.("profile")}>
            <Settings size={16} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 whitespace-nowrap" onClick={() => setIsArchivedOpen(true)}>
            <Archive size={16} />
            <span>Archived Chats</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-3 whitespace-nowrap"
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
