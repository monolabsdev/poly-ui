import * as React from "react";
import {
  Box,
  IconButton,
  Drawer,
  CSSObject,
  Typography,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  PanelLeft,
  Trash2,
  Edit2,
  Check,
  X,
  MoreHorizontal,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { motion } from "motion/react";
import { useTiming, ANIMATION_VARIANTS } from "@/lib/motion";
import { useNotify } from "@/hooks/useNotify";
import { useDevStore } from "@/store/devStore";
import { useAuthStore } from "@/store/authStore";
import { Conversation, useChatStore } from "@/store/chatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConversationDialog } from "@/components/Chat/DeleteConversationDialog";
import { ProfileMenu } from "@/components/Profile/ProfileMenu";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";
import { useElementBreakpoint, useResizeActivity } from "@/hooks/useResizePerformance";

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

  useResizeActivity(rootRef);
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
          height: "100vh",
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        {children}
      </Box>
    </SidebarContext.Provider>
  );
}

interface SidebarProps {
  onOpenSettings: () => void;
  onNewChat: (isTemporary?: boolean) => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  conversations: Conversation[];
  activeConversationId: string | null;
  collapsible?: "icon" | "none";
}

const ConversationItem = React.memo(function ConversationItem({
  conv,
  activeConversationId,
  editingId,
  editValue,
  setEditValue,
  handleConfirmRename,
  handleCancelRename,
  handleStartRename,
  handleArchive,
  handleStartDelete,
}: {
  conv: Conversation;
  activeConversationId: string | null;
  editingId: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  handleConfirmRename: (e: React.MouseEvent, id: string) => void;
  handleCancelRename: (e: React.MouseEvent) => void;
  handleStartRename: (e: React.MouseEvent, conv: Conversation) => void;
  handleArchive: (id: string) => void;
  handleStartDelete: (conv: Conversation) => void;
}) {
  const { isCollapsed } = useSidebar();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        height: "100%",
      }}
    >
      <>
        {editingId === conv.id ? (
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              gap: "4px",
            }}
          >
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename(e as any, conv.id);
                if (e.key === "Escape") handleCancelRename(e as any);
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "inherit",
                outline: "none",
                fontSize: "inherit",
                padding: 0,
                width: "100%",
              }}
            />
            <IconButton
              size="small"
              onClick={(e) => handleConfirmRename(e, conv.id)}
              sx={{ p: 0.5, color: "text.secondary" }}
            >
              <Check size={14} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleCancelRename}
              sx={{ p: 0.5, color: "text.secondary" }}
            >
              <X size={14} />
            </IconButton>
          </Box>
        ) : (
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              minWidth: 0,
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{
                flex: 1,
                color:
                  activeConversationId === conv.id ? "text.primary" : "inherit",
                fontSize: "13.5px",
                fontWeight: activeConversationId === conv.id ? 500 : 400,
                pr: 1,
              }}
            >
              {conv.title || "Untitled"}
            </Typography>

            <Box
              className="conversation-actions"
              sx={{
                display: "flex",
                gap: 0,
                mr: -0.5,
                visibility: isCollapsed ? "hidden" : "visible",
              }}
            >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        p: 0.5,
                        color: "text.secondary",
                        "&:hover": {
                          color: "text.primary",
                          bgcolor: "action.selected",
                        },
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => handleStartRename(e, conv)}
                    >
                      <Edit2 size={14} /> Rename
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => handleArchive(conv.id)}>
                      <Archive size={14} /> Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleStartDelete(conv)}
                    >
                      <Trash2 size={14} /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </Box>
          </Box>
        )}
      </>
    </Box>
  );
});

export const Sidebar = React.memo(function Sidebar({
  onOpenSettings,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  conversations,
  activeConversationId,
  collapsible,
}: SidebarProps) {
  const { isCollapsed, isMobile, openMobile, setOpenMobile } =
    useSidebar();
  const theme = useTheme();
  const timing = useTiming();
  const notify = useNotify();

  const archiveConversation = useChatStore(
    (state) => state.actions.archiveConversation,
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = React.useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const devTapCount = React.useRef(0);
  const setDevMode = useDevStore((s) => s.actions.setDevMode);

  const handleDevTap = React.useCallback(() => {
    devTapCount.current += 1;
    if (devTapCount.current >= 10) {
      devTapCount.current = 0;
      setDevMode(true);
      notify.success("Dev mode activated", "Tap the OpenBench logo 10 more times to deactivate.");
    } else if (devTapCount.current === 1 && useDevStore.getState().devMode) {
      // First tap while already in dev mode — deactivate
      devTapCount.current = 0;
      setDevMode(false);
      notify.info("Dev mode deactivated");
    }
  }, [setDevMode, notify]);

  const handleStartDelete = (conv: Conversation) => {
    setDeleteId(conv.id);
    setDeleteTitle(conv.title || "Untitled");
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      try {
        await onDeleteConversation(deleteId);
        notify.success("Conversation deleted");
      } catch {
        notify.error("Failed to delete conversation");
      }
      setDeleteId(null);
      setDeleteTitle("");
    }
  };

  const handleStartRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(conv.id);
    setEditValue(conv.title || "Untitled");
  };

  const handleConfirmRename = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (editValue.trim()) {
      try {
        await onRenameConversation(id, editValue.trim());
        notify.success("Conversation renamed");
      } catch {
        notify.error("Failed to rename conversation");
      }
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(null);
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveConversation(id);
      notify.success("Conversation archived");
    } catch {
      notify.error("Failed to archive");
    }
  };

  const groupedConversations = React.useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    const filtered = conversations
      .filter((c) => !c.isArchived && !c.isTemporary);

    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const last7Days: Conversation[] = [];
    const older: Conversation[] = [];

    filtered.forEach((conv) => {
      const date = new Date(conv.updatedAt || conv.createdAt);
      if (isToday(date)) {
        today.push(conv);
      } else if (isYesterday(date)) {
        yesterday.push(conv);
      } else if (isAfter(date, sevenDaysAgo)) {
        last7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    return [
      { id: "today", label: "Today", items: today },
      { id: "yesterday", label: "Yesterday", items: yesterday },
      { id: "last7days", label: "Previous 7 Days", items: last7Days },
      { id: "older", label: "Older", items: older },
    ].filter((group) => group.items.length > 0);
  }, [conversations]);

  const sidebarContent = (
    <>
      <SidebarHeader>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            width: "100%",
            px: isCollapsed ? 0 : 2,
            pt: isCollapsed ? 1 : 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              opacity: isCollapsed ? 0 : 1,
              width: isCollapsed ? 0 : "auto",
              overflow: "hidden",
              transition: "opacity 0.18s ease",
              willChange: "opacity, transform",
              pointerEvents: isCollapsed ? "none" : "auto",
            }}
          >
            <Typography
              variant="subtitle2"
              onClick={handleDevTap}
              sx={{
                fontWeight: 700,
                color: "primary.main",
                letterSpacing: "-0.01em",
                fontSize: "15px",
                whiteSpace: "nowrap",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              OpenBench
            </Typography>
          </Box>
          <SidebarTrigger />
        </Box>
      </SidebarHeader>

      <SidebarContent>
        <Box sx={{ px: 1.5, mb: 1, mt: 1 }}>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <SidebarMenuButton
              onClick={() => onNewChat(false)}
              isActive={false}
              tooltip="New Chat"
              sx={{
                bgcolor: isCollapsed ? "transparent" : "background.paper",
                border: isCollapsed ? "none" : "1px solid",
                borderColor: "divider",
                boxShadow: isCollapsed ? "none" : "0 1px 2px rgba(0,0,0,0.05)",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "border.main",
                },
              }}
            >
              <Edit2 size={18} />
              <Box
                component="span"
                sx={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  opacity: isCollapsed ? 0 : 1,
                  width: isCollapsed ? 0 : "auto",
                  overflow: "hidden",
                  transition: "opacity 0.18s ease",
                  willChange: "opacity, transform",
                }}
              >
                New Chat
              </Box>
            </SidebarMenuButton>

            <SidebarMenuButton
              onClick={() => onNewChat(true)}
              isActive={false}
              tooltip="Temporary Chat"
              sx={{
                bgcolor: "transparent",
                border: isCollapsed ? "none" : "1px dashed",
                borderColor: "divider",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "border.main",
                },
              }}
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                style={{ width: 18, height: 18 }}
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="2.5 3.5"
                ></path>
              </svg>
              <Box
                component="span"
                sx={{
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  opacity: isCollapsed ? 0 : 1,
                  width: isCollapsed ? 0 : "auto",
                  overflow: "hidden",
                  transition: "opacity 0.18s ease",
                  willChange: "opacity, transform",
                }}
              >
                Temporary Chat
              </Box>
            </SidebarMenuButton>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            mt: 1,
            opacity: isCollapsed ? 0 : 1,
            visibility: isCollapsed ? "hidden" : "visible",
            transition: "opacity 0.18s ease",
            willChange: "opacity, transform",
            height: isCollapsed ? 0 : "auto",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
            {groupedConversations.map((group, groupIndex) => (
              <Box
                key={group.id}
                component={motion.div}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ 
                  duration: timing.duration("base"), 
                  delay: groupIndex * 0.05,
                  ease: timing.ease 
                }}
              >
                <SidebarGroup sx={{ mb: 1 }}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent sx={{ mt: 0.5 }}>
                    <SidebarMenu>
                      {group.items.map((conv) => (
                        <SidebarMenuButton
                          key={conv.id}
                          isActive={activeConversationId === conv.id}
                          tooltip={conv.title || "Untitled"}
                          onClick={() => {
                            onSelectConversation(conv.id);
                            if (isMobile) setOpenMobile(false);
                          }}
                          sx={{
                            "&:hover .conversation-actions": { opacity: 1 },
                          }}
                        >
                          <ConversationItem
                            conv={conv}
                            activeConversationId={activeConversationId}
                            editingId={editingId}
                            editValue={editValue}
                            setEditValue={setEditValue}
                            handleConfirmRename={handleConfirmRename}
                            handleCancelRename={handleCancelRename}
                            handleStartRename={handleStartRename}
                            handleArchive={handleArchive}
                            handleStartDelete={handleStartDelete}
                          />
                        </SidebarMenuButton>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </Box>
            ))}
          </Box>
      </SidebarContent>

      <SidebarFooter>
        <GuestWarning />
        <ProfileMenu onOpenSettings={onOpenSettings} />
      </SidebarFooter>

      <DeleteConversationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={deleteTitle}
      />
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        open={openMobile}
        onClose={() => setOpenMobile(false)}
        PaperProps={{
          sx: {
            width: 260,
            bgcolor: "background.sidebar",
            borderRight: "1px solid",
            borderColor: "divider",
            backgroundImage: "none",
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  const width = isCollapsed && collapsible === "icon" ? 60 : 260;

  return (
    <Box
      component={motion.div}
      initial={false}
      animate={{ width }}
      transition={{ duration: timing.duration("base"), ease: timing.ease }}
      style={{
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.sidebar,
        borderRight: "1px solid",
        borderColor: theme.palette.divider,
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          width: isCollapsed ? 60 : 260,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "transparent",
        }}
      >
        {sidebarContent}
      </Box>
    </Box>
  );
});

export function SidebarHeader({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  return (
    <Box
      sx={{
        p: 0,
        display: "flex",
        alignItems: "center",
        minHeight: 64,
        borderBottom: "1px solid",
        borderColor: "transparent",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarFooter({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  const { isCollapsed } = useSidebar();
  return (
    <Box
      sx={{
        p: isCollapsed ? 1 : 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderTop: "1px solid",
        borderColor: "divider",
        transition: "padding 0.2s",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarGroup({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  return <Box sx={{ mb: 2, width: "100%", ...sx }}>{children}</Box>;
}

export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: 2.5, mb: 0, mt: 0 }}>
      <Box
        component="span"
        sx={{
          fontSize: "11px",
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function SidebarGroupContent({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  return <Box sx={{ px: 0, width: "100%", ...sx }}>{children}</Box>;
}

export function SidebarMenu({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  const { isCollapsed } = useSidebar();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        px: isCollapsed ? 0 : 1.5,
        alignItems: "stretch",
        width: "100%",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarMenuButton({
  children,
  isActive,
  onClick,
  sx,
  tooltip,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  sx?: CSSObject;
  tooltip?: string;
}) {
  const { isCollapsed } = useSidebar();

  const content = (
    <Box
      component={motion.div}
      variants={ANIMATION_VARIANTS.interactive}
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? 0 : 1.5,
        px: isCollapsed ? 0 : 1.5,
        width: "100%",
        height: 40,
        borderRadius: "10px",
        cursor: "pointer",
        bgcolor: isActive ? "action.selected" : "transparent",
        color: isActive ? "text.primary" : "text.secondary",
        fontSize: "13.5px",
        fontWeight: 500,
        overflow: "hidden",
        position: "relative",
        transition: "background-color 0.18s ease, color 0.18s ease",
        "&:hover": {
          bgcolor: "action.hover",
          color: "text.primary",
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );

  if (isCollapsed && tooltip) {
    return (
      <Tooltip title={tooltip} placement="right" arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
}

export function SidebarTrigger({ sx }: { sx?: CSSObject }) {
  const { isCollapsed, setIsCollapsed, isMobile, setOpenMobile } = useSidebar();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      setOpenMobile(true);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <Tooltip
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      placement="right"
    >
      <IconButton
        component={motion.button}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        size="small"
        sx={{
          color: "text.secondary",
          width: 40,
          height: 40,
          borderRadius: "10px",
          bgcolor: isCollapsed ? "action.hover" : "transparent",
          transition: "background-color 0.18s ease, color 0.18s ease",
          "&:hover": {
            color: "text.primary",
            bgcolor: "action.selected",
          },
          ...sx,
        }}
      >
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PanelLeft size={20} />
        </Box>
      </IconButton>
    </Tooltip>
  );
}

function GuestWarning() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const { isCollapsed } = useSidebar();

  if (!isGuest || isCollapsed) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        px: 1,
        py: 0.75,
        mx: 0.5,
        borderRadius: "8px",
        bgcolor: "rgba(245, 158, 11, 0.1)",
        border: "1px solid rgba(245, 158, 11, 0.2)",
      }}
    >
      <Box component="span" sx={{ color: "warning.main", mt: 0.5, flexShrink: 0, display: "flex" }}>
        <AlertTriangle size={14} />
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontSize: "0.7rem",
          lineHeight: 1.4,
          flex: 1,
        }}
      >
        Chats won't be saved unless you sign up or log in.
      </Typography>
    </Box>
  );
}

export function SidebarInset({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {children}
    </Box>
  );
}
