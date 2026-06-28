import * as React from "react";
import { Info, MoreHorizontal, LogIn, Settings, Archive } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArchivedChatsDialog } from "@/features/chat/components/ArchivedChatsDialog";
import { useAuthStore } from "@/store/authStore";
import { useSidebar } from "@/components/ui/sidebar";
import { sidebarIconButtonClassName } from "@/features/sidebar/components/sidebar-utils";

export function GuestFooter({ onOpenSettings }: { onOpenSettings: () => void }) {
  const openAuth = useAuthStore((s) => s.actions.openAuth);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [archivedOpen, setArchivedOpen] = React.useState(false);

  if (isCollapsed) {
    return (
      <>
        <DropdownMenu>
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Guest menu"
                  className={`${sidebarIconButtonClassName} bg-muted hover:bg-muted/80`}
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                      ?
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Guest mode</TooltipContent>
            </Tooltip>
          </div>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onClick={onOpenSettings} className="gap-3">
              <Settings size={14} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setArchivedOpen(true)}
              className="gap-3"
            >
              <Archive size={14} />
              <span>Archived Chats</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAuth()} className="gap-3">
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
      <div
        data-testid="guest-footer-flat"
        className="flex flex-col gap-2 px-2.5 pb-1"
      >
        <div className="flex items-center gap-2.5">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="bg-muted text-xs text-muted-foreground">
              ?
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium leading-[1.3] text-foreground">
              Guest mode
            </p>
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-[1.4] text-muted-foreground">
              Not signed in
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="More options"
                className={sidebarIconButtonClassName}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={onOpenSettings} className="gap-3">
                <Settings size={14} />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setArchivedOpen(true)}
                className="gap-3"
              >
                <Archive size={14} />
                <span>Archived Chats</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Info size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
          <p className="text-xs leading-[1.3]">
            Sign in to save your chats.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => openAuth()}
          className="min-h-[34px] w-full gap-2 text-sm font-medium"
        >
          <LogIn size={14} />
          Sign in
        </Button>
      </div>

      <ArchivedChatsDialog open={archivedOpen} onOpenChange={setArchivedOpen} />
    </>
  );
}
