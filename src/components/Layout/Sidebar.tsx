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
  AlertTriangle,
  Search,
  MessageSquare,
  Folder,
  FolderOpen,
  FolderPlus,
  Download,
  ChevronRight,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { useTiming } from "@/lib/motion";
import { useNotify } from "@/hooks/useNotify";
import { useDevStore } from "@/store/devStore";
import { useAuthStore } from "@/store/authStore";
import { useFolderStore } from "@/store/folderStore";
import { CreateFolderModal } from "@/components/Folders/CreateFolderModal";
import { Conversation, useChatStore } from "@/store/chatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConversationDialog } from "@/components/Chat/DeleteConversationDialog";
import { ConversationItem } from "@/components/Chat/ConversationItem";
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

interface SidebarProps {
  onOpenSettings: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  conversations: Conversation[];
  activeConversationId: string | null;
  collapsible?: "icon" | "none";
}

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

  const conversationsLoading = useChatStore(
    (state) => state.conversationsLoading,
  );
  const streamingConversationId = useChatStore((state) => state.streamingConversationId);
  const archiveConversation = useChatStore(
    (state) => state.actions.archiveConversation,
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = React.useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const devTapCount = React.useRef(0);
  const setDevMode = useDevStore((s) => s.actions.setDevMode);
  const [isFolderModalOpen, setIsFolderModalOpen] = React.useState(false);
  const [folderParentId, setFolderParentId] = React.useState<string | undefined>();
  const [folderEditingId, setFolderEditingId] = React.useState<string | null>(null);
  const [folderEditValue, setFolderEditValue] = React.useState("");
  const [editingFolder, setEditingFolder] = React.useState<(typeof folders)[number] | null>(null);
  const folders = useFolderStore((s) => s.folders);
  const createFolder = useFolderStore((s) => s.actions.createFolder);
  const loadFolders = useFolderStore((s) => s.actions.loadFolders);
  const activeFolderId = useFolderStore((s) => s.activeFolderId);
  const setActiveFolderId = useFolderStore((s) => s.actions.setActiveFolderId);
  const updateFolder = useFolderStore((s) => s.actions.updateFolder);
  const deleteFolder = useFolderStore((s) => s.actions.deleteFolder);
  const setActiveConversationId = useChatStore((s) => s.actions.setActiveConversationId);
  const folderConversations = React.useMemo(
    () => conversations.filter((conversation) => conversation.folderId && !conversation.isArchived && !conversation.isTemporary),
    [conversations],
  );

  React.useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleStartFolderRename = (folder: (typeof folders)[number]) => {
    setFolderEditingId(folder.id);
    setFolderEditValue(folder.name);
  };

  const handleConfirmFolderRename = async () => {
    if (!folderEditingId) return;
    const trimmed = folderEditValue.trim();
    if (trimmed) {
      await updateFolder(folderEditingId, { name: trimmed });
    }
    setFolderEditingId(null);
  };

  const handleCancelFolderRename = () => {
    setFolderEditingId(null);
  };

  const handleOpenFolderEdit = (folder: (typeof folders)[number]) => {
    setEditingFolder(folder);
    setFolderParentId(folder.parentId);
    setIsFolderModalOpen(true);
  };

  const handleDeleteFolder = async (folder: { id: string; name: string }) => {
    if (!window.confirm(`Delete folder "${folder.name}"? Chats stay saved.`)) return;
    await deleteFolder(folder.id);
  };

  const handleExportFolder = (folder: { id: string; name: string }) => {
    const folderIds = new Set<string>([folder.id]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((candidate) => {
        if (candidate.parentId && folderIds.has(candidate.parentId) && !folderIds.has(candidate.id)) {
          folderIds.add(candidate.id);
          changed = true;
        }
      });
    }
    const payload = {
      folder,
      folders: folders.filter((candidate) => folderIds.has(candidate.id)),
      conversations: conversations.filter((conversation) => conversation.folderId && folderIds.has(conversation.folderId)),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${folder.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "folder"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderFolder = (folder: (typeof folders)[number], depth = 0): React.ReactNode => {
    const chats = folderConversations.filter((conversation) => conversation.folderId === folder.id);
    const children = folders.filter((candidate) => candidate.parentId === folder.id);
    const hasChildren = chats.length > 0 || children.length > 0;
    const containsActiveFolder = (folderId: string): boolean =>
      activeFolderId === folderId || folders.some((candidate) => candidate.parentId === folderId && containsActiveFolder(candidate.id));
    const isOpen = containsActiveFolder(folder.id) || chats.some((conversation) => conversation.id === activeConversationId);
    const FolderIcon = isOpen ? FolderOpen : Folder;
    const isEditing = folderEditingId === folder.id;
    return (
      <React.Fragment key={folder.id}>
        <SidebarMenuButton
          isActive={activeFolderId === folder.id && !activeConversationId}
          tooltip={folder.name}
          onClick={() => {
            if (isEditing) return;
            setActiveFolderId(folder.id);
            setActiveConversationId(null);
            if (isMobile) setOpenMobile(false);
          }}
          sx={{ height: 38, pl: 1 + depth * 2, pr: 1, "&:hover .folder-actions": { opacity: 1 }, gap: 1.5 }}
        >
          <ChevronRight size={13} style={{ flexShrink: 0, opacity: hasChildren ? 0.5 : 0, transform: isOpen ? "rotate(90deg)" : undefined }} />
          <FolderIcon size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
          {isEditing ? (
            <Box sx={{ display: "flex", alignItems: "center", flex: 1, gap: 0.5 }}>
              <input
                autoFocus
                value={folderEditValue}
                onChange={(e) => setFolderEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.stopPropagation(); handleConfirmFolderRename(); }
                  if (e.key === "Escape") { e.stopPropagation(); handleCancelFolderRename(); }
                }}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  outline: "none",
                  fontSize: "13px",
                  padding: 0,
                  width: "100%",
                }}
              />
              <IconButton size="small" aria-label="Confirm rename" onClick={(e) => { e.stopPropagation(); handleConfirmFolderRename(); }} sx={{ p: 0.25, color: "text.secondary" }}><Check size={13} /></IconButton>
              <IconButton size="small" aria-label="Cancel rename" onClick={(e) => { e.stopPropagation(); handleCancelFolderRename(); }} sx={{ p: 0.25, color: "text.secondary" }}><X size={13} /></IconButton>
            </Box>
          ) : (
            <Box component="span" sx={{ fontSize: "13px", fontWeight: 450, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{folder.name}</Box>
          )}
          <Box className="folder-actions" sx={{ display: "flex", ml: "auto", opacity: 0, transition: "opacity 0.12s" }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="small" aria-label={`Actions for ${folder.name}`} onClick={(e) => e.stopPropagation()} sx={{ p: 0.25 }}><MoreHorizontal size={13} /></IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sx={{ minWidth: 170 }}>
                <DropdownMenuItem onClick={() => handleStartFolderRename(folder)}><Edit2 size={14} /> Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenFolderEdit(folder)}><FolderPlus size={14} /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setFolderParentId(folder.id); setIsFolderModalOpen(true); }}><FolderPlus size={14} /> Create Folder</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFolder(folder)}><Download size={14} /> Export</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => handleDeleteFolder(folder)}><Trash2 size={14} /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Box>
        </SidebarMenuButton>
        {isOpen && (
          <Box sx={{ ml: 2.5, borderLeft: "1px solid", borderColor: "border.light" }}>
            {children.map((child) => renderFolder(child, depth + 1))}
            {chats.map((chat) => (
              <SidebarMenuButton
                key={chat.id}
                isActive={activeConversationId === chat.id}
                tooltip={chat.title || "Untitled"}
                onClick={() => { setActiveFolderId(folder.id); setActiveConversationId(chat.id); if (isMobile) setOpenMobile(false); }}
                sx={{ height: 38, pl: 2 + depth * 2, pr: 1, fontSize: "13px" }}
              >
                <ConversationItem
                  conv={chat}
                  activeConversationId={activeConversationId}
                  isGenerating={streamingConversationId === chat.id}
                  variant="folderTree"
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
          </Box>
        )}
      </React.Fragment>
    );
  };

  const handleDevTap = React.useCallback(() => {
    devTapCount.current += 1;
    if (devTapCount.current >= 10) {
      devTapCount.current = 0;
      setDevMode(true);
      notify.success("Dev mode activated", "Tap the PolyUI logo 10 more times to deactivate.");
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

    const q = searchQuery.toLowerCase().trim();
    const filtered = conversations
      .filter((c) => !c.isArchived && !c.isTemporary)
      .filter((c) => !c.folderId)
      .filter((c) => !q || c.title?.toLowerCase().includes(q));

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
  }, [conversations, searchQuery]);

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
              pointerEvents: isCollapsed ? "none" : "auto",
            }}
          >
            <Typography
              variant="subtitle2"
              onClick={handleDevTap}
              sx={{
                fontWeight: 600,
                color: "primary.main",
                letterSpacing: "-0.02em",
                fontSize: "14px",
                whiteSpace: "nowrap",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              PolyUI
            </Typography>
          </Box>
          <SidebarTrigger />
        </Box>
      </SidebarHeader>

      <SidebarContent>
        {!isCollapsed && (
          <>
            <Box sx={{ px: 1.5, mb: 1 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <SidebarMenuButton
                  onClick={() => onNewChat()}
                  isActive={false}
                  tooltip="New Chat"
                  sx={{
                    height: 38,
                    bgcolor: isCollapsed ? "transparent" : "background.paper",
                    border: isCollapsed ? "none" : "1px solid",
                    borderColor: "divider",
                    "&:hover": {
                      bgcolor: "action.hover",
                      borderColor: "border.main",
                    },
                  }}
                >
                  <Edit2 size={16} />
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      opacity: isCollapsed ? 0 : 1,
                      width: isCollapsed ? 0 : "auto",
                      overflow: "hidden",
                      transition: "opacity 0.18s ease",
                    }}
                  >
                    New Chat
                  </Box>
                </SidebarMenuButton>
              </Box>
            </Box>

            <Box sx={{ px: 1.5, mb: 2.25 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 1.5,
                  height: 38,
                  borderRadius: "8px",
                  bgcolor: "action.hover",
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "border-color 0.15s",
                  "&:focus-within": {
                    borderColor: "primary.main",
                  },
                }}
              >
                <Search size={16} style={{ flexShrink: 0, opacity: 0.4 }} />
                <input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchQuery("")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    outline: "none",
                    fontSize: "13px",
                    width: "100%",
                  }}
                />
                {searchQuery && (
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery("")}
                    sx={{
                      p: 0.25,
                      color: "text.secondary",
                      opacity: 0.65,
                      "&:hover": { opacity: 1, color: "text.primary" },
                    }}
                  >
                    <X size={14} />
                  </IconButton>
                )}
              </Box>
            </Box>
          </>
        )}

        {!isCollapsed && (
          <Box sx={{ mb: 2.5 }}>
            <SidebarGroup sx={{ mb: 0 }}>
              <Box
                className="folders-header"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.5,
                  minHeight: 28,
                  mb: 1,
                }}
              >
                <SidebarSectionLabel>Folders</SidebarSectionLabel>
                <IconButton
                  size="small"
                  aria-label="Create folder"
                  onClick={() => { setFolderParentId(undefined); setIsFolderModalOpen(true); }}
                  sx={{
                    p: 0.25,
                    color: "text.secondary",
                    "&:hover": { color: "text.primary" },
                  }}
                >
                  <Plus size={16} />
                </IconButton>
              </Box>
              <SidebarGroupContent>
                <SidebarMenu>
                  {folders.filter((folder) => !folder.parentId).map((folder) => renderFolder(folder))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Box>
        )}

        {!isCollapsed && (
          <Box sx={{ px: 1.5, mt: 2.5, mb: 0.75 }}>
            <SidebarSectionLabel>Chats</SidebarSectionLabel>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            opacity: isCollapsed ? 0 : 1,
            visibility: isCollapsed ? "hidden" : "visible",
            transition: "opacity 0.18s ease",
          }}
        >
          {conversationsLoading ? (
            <ConversationSkeleton />
          ) : groupedConversations.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.5,
                px: 3,
                py: 5,
                color: "text.secondary",
                opacity: 0.5,
              }}
            >
              <MessageSquare size={18} />
              <Typography
                variant="caption"
                sx={{ fontSize: "12px", textAlign: "center", lineHeight: 1.4 }}
              >
                {searchQuery
                  ? "No conversations match your search"
                  : "No conversations yet"}
              </Typography>
            </Box>
          ) : (
            groupedConversations.map((group) => (
              <Box key={group.id} sx={{ mb: 1 }}>
                <SidebarGroup sx={{ mb: 0 }}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent sx={{ mt: 0.5 }}>
                    <SidebarMenu>
                      {group.items.map((conv) => (
                        <SidebarMenuButton
                          key={conv.id}
                          isActive={activeConversationId === conv.id}
                          ariaCurrent={activeConversationId === conv.id}
                          tooltip={conv.title || "Untitled"}
                          onClick={() => {
                            onSelectConversation(conv.id);
                            if (isMobile) setOpenMobile(false);
                          }}
                          sx={{
                            "&:hover .conversation-actions": { opacity: 1 },
                            contentVisibility: "auto",
                            containIntrinsicSize: "1px 36px",
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
                            isGenerating={streamingConversationId === conv.id}
                            isCollapsed={isCollapsed}
                          />
                        </SidebarMenuButton>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </Box>
            ))
          )}
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

      <CreateFolderModal
        open={isFolderModalOpen}
        onOpenChange={(open) => {
          setIsFolderModalOpen(open);
          if (!open) setEditingFolder(null);
        }}
        onSave={(data) => {
          if (editingFolder) {
            updateFolder(editingFolder.id, {
              name: data.name,
              parentId: folderParentId,
              backgroundImage: data.backgroundImage,
              systemPrompt: data.systemPrompt,
              contextFiles: data.contextFiles,
            });
          } else {
            createFolder(data.name, {
              parentId: folderParentId,
              backgroundImage: data.backgroundImage,
              systemPrompt: data.systemPrompt,
              contextFiles: data.contextFiles,
            });
          }
          setEditingFolder(null);
        }}
        initialData={editingFolder ? {
          name: editingFolder.name,
          backgroundImage: editingFolder.backgroundImage,
          systemPrompt: editingFolder.systemPrompt,
          contextFiles: editingFolder.contextFiles,
        } : undefined}
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
        minHeight: 56,
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
        p: isCollapsed ? 1 : 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
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
    <Box sx={{ pl: 3, pr: 1.5, mb: 0.5, mt: 1.75 }}>
      <Box
        component="span"
        sx={{
          fontSize: "10px",
          fontWeight: 500,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.45,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "11px",
        fontWeight: 700,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        opacity: 0.8,
      }}
    >
      {children}
    </Typography>
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
        gap: 0.75,
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
  ariaCurrent,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  sx?: CSSObject;
  tooltip?: string;
  ariaCurrent?: boolean;
}) {
  const { isCollapsed } = useSidebar();

  const content = (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-current={ariaCurrent ? "page" : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? 0 : 1.5,
        px: isCollapsed ? 0 : 1.5,
        width: "100%",
        height: 38,
        borderRadius: "8px",
        cursor: "pointer",
        bgcolor: isActive ? "action.selected" : "transparent",
        color: isActive ? "text.primary" : "text.secondary",
        fontSize: "13px",
        fontWeight: isActive ? 500 : 400,
        overflow: "hidden",
        position: "relative",
        "&:hover": {
          bgcolor: "action.hover",
          color: "text.primary",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: "2px",
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );

  if (isCollapsed && tooltip) {
    return (
      <Tooltip title={tooltip} placement="right">
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
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={handleClick}
        size="small"
        sx={{
          color: "text.secondary",
          width: 36,
          height: 36,
          borderRadius: "8px",
          bgcolor: isCollapsed ? "action.hover" : "transparent",
          "&:hover": {
            color: "text.primary",
            bgcolor: "action.selected",
          },
          ...sx,
        }}
      >
        <PanelLeft size={18} />
      </IconButton>
    </Tooltip>
  );
}

function GuestWarning() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const openAuth = useAuthStore((s) => s.actions.openAuth);
  const { isCollapsed } = useSidebar();

  if (!isGuest || isCollapsed) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: "8px",
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        component="span"
        sx={{ flexShrink: 0, display: "flex", color: "text.secondary", opacity: 0.5 }}
      >
        <AlertTriangle size={12} />
      </Box>
      <Typography
        variant="caption"
        sx={{ flex: 1, color: "text.secondary", fontSize: "0.7rem", lineHeight: 1.3 }}
      >
        Guest chats won't be saved.
      </Typography>
      <IconButton
        size="small"
        aria-label="Sign in"
        onClick={() => openAuth()}
        sx={{
          p: 0.25,
          color: "text.secondary",
          "&:hover": { color: "text.primary", bgcolor: "action.selected" },
        }}
      >
        <Box component="span" sx={{ fontSize: "11px", fontWeight: 600, px: 0.5 }}>Sign in</Box>
      </IconButton>
    </Box>
  );
}

function ConversationSkeleton() {
  const { isCollapsed } = useSidebar();
  if (isCollapsed) return null;
  return (
    <Box sx={{ px: 1.5 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Box
          key={i}
          sx={{
            height: 36,
            borderRadius: "8px",
            mb: 0.5,
            bgcolor: "action.hover",
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 0.6 },
              "50%": { opacity: 0.3 },
            },
          }}
        />
      ))}
    </Box>
  );
}

export function SidebarInset({ children, backgroundImage }: { children: React.ReactNode; backgroundImage?: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        bgcolor: backgroundImage ? "transparent" : undefined,
        "&::before": backgroundImage ? {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(16px)",
          opacity: 0.25,
          zIndex: 0,
        } : undefined,
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          bgcolor: backgroundImage ? "rgba(0,0,0,0.4)" : undefined,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
