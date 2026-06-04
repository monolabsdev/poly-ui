import * as React from "react";
import { Box, IconButton } from "@mui/material";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Edit2,
  Download,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConversationItem } from "@/components/Chat/ConversationItem";
import { SidebarMenuButton } from "@/components/Sidebar/components/SidebarPrimitives";
import { useSidebar } from "@/components/Sidebar/hooks/useSidebar";
import { useSidebarActions } from "@/components/Sidebar/hooks/useSidebarActions";
import { useReducedMotion } from "@/components/Sidebar/hooks/useReducedMotion";
import { useFolderStore } from "@/store/folderStore";
import { useChatStore } from "@/store/chatStore";
import { Conversation, Folder as FolderType } from "@/types/chat";

export interface FolderTreeProps {
  folder: FolderType;
  depth?: number;
  folderConversations: Conversation[];
  streamingConversationId: string | null;
}

export function FolderTree({
  folder,
  depth = 0,
  folderConversations,
  streamingConversationId,
}: FolderTreeProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { folder: folderActions, conv } = useSidebarActions();
  const folders = useFolderStore((s) => s.folders);
  const activeFolderId = useFolderStore((s) => s.activeFolderId);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveFolderId = useFolderStore((s) => s.actions.setActiveFolderId);
  const setActiveConversationId = useChatStore(
    (s) => s.actions.setActiveConversationId,
  );

  const chats = folderConversations.filter(
    (conversation) => conversation.folderId === folder.id,
  );
  const children = folders.filter(
    (candidate) => candidate.parentId === folder.id,
  );
  const hasChildren = chats.length > 0 || children.length > 0;
  const containsActiveFolder = (folderId: string): boolean =>
    activeFolderId === folderId ||
    folders.some(
      (candidate) =>
        candidate.parentId === folderId &&
        containsActiveFolder(candidate.id),
    );
  const isOpen =
    containsActiveFolder(folder.id) ||
    chats.some((conversation) => conversation.id === activeConversationId);
  const FolderIcon = isOpen ? FolderOpen : Folder;
  const isEditing = folderActions.folderEditingId === folder.id;
  const reducedMotion = useReducedMotion();

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
        sx={{
          height: 38,
          pl: 1 + depth * 2,
          pr: 1,
          "&:hover .folder-actions": { opacity: 1 },
          gap: 1.5,
        }}
      >
        <ChevronRight
          size={13}
          style={{
            flexShrink: 0,
            opacity: hasChildren ? 0.5 : 0,
            transform: isOpen ? "rotate(90deg)" : undefined,
          }}
        />
        <FolderIcon size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
        {isEditing ? (
          <Box
            sx={{ display: "flex", alignItems: "center", flex: 1, gap: 0.5 }}
          >
            <input
              autoFocus
              value={folderActions.folderEditValue}
              onChange={(e) => folderActions.setFolderEditValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  folderActions.onConfirmRename();
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  folderActions.onCancelRename();
                }
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
            <IconButton
              size="small"
              aria-label="Confirm rename"
              onClick={(e) => {
                e.stopPropagation();
                folderActions.onConfirmRename();
              }}
              sx={{ p: 0.25, color: "text.secondary" }}
            >
              <Check size={13} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Cancel rename"
              onClick={(e) => {
                e.stopPropagation();
                folderActions.onCancelRename();
              }}
              sx={{ p: 0.25, color: "text.secondary" }}
            >
              <X size={13} />
            </IconButton>
          </Box>
        ) : (
          <Box
            component="span"
            sx={{
              fontSize: "13px",
              fontWeight: 450,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {folder.name}
          </Box>
        )}
        <Box
          className="folder-actions"
          sx={{
            display: "flex",
            ml: "auto",
            opacity: 0,
            transition: reducedMotion ? "none" : "opacity 0.12s",
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="small"
                aria-label={`Actions for ${folder.name}`}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0.25 }}
              >
                <MoreHorizontal size={13} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sx={{ minWidth: 170 }}>
              <DropdownMenuItem onClick={() => folderActions.onStartRename(folder)}>
                <Edit2 size={14} /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => folderActions.onOpenEdit(folder)}>
                <FolderPlus size={14} /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => folderActions.openCreateInFolder(folder.id)}
              >
                <FolderPlus size={14} /> Create Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => folderActions.onExport(folder)}>
                <Download size={14} /> Export
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => folderActions.onDelete(folder)}
              >
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      </SidebarMenuButton>
      {isOpen && (
        <Box
          sx={{
            ml: 2.5,
            borderLeft: "1px solid",
            borderColor: "border.light",
          }}
        >
          {children.map((child) => (
            <FolderTree
              key={child.id}
              folder={child}
              depth={depth + 1}
              folderConversations={folderConversations}
              streamingConversationId={streamingConversationId}
            />
          ))}
          {chats.map((chat) => (
            <SidebarMenuButton
              key={chat.id}
              isActive={activeConversationId === chat.id}
              tooltip={chat.title || "Untitled"}
              onClick={() => {
                setActiveFolderId(folder.id);
                setActiveConversationId(chat.id);
                if (isMobile) setOpenMobile(false);
              }}
              sx={{ height: 38, pl: 2 + depth * 2, pr: 1, fontSize: "13px" }}
            >
              <ConversationItem
                conv={chat}
                activeConversationId={activeConversationId}
                isGenerating={streamingConversationId === chat.id}
                variant="folderTree"
                editingId={conv.editingId}
                editValue={conv.editValue}
                setEditValue={conv.setEditValue}
                handleConfirmRename={conv.handleConfirmRename}
                handleCancelRename={conv.handleCancelRename}
                handleStartRename={conv.handleStartRename}
                handleArchive={conv.handleArchive}
                handleStartDelete={conv.handleStartDelete}
              />
            </SidebarMenuButton>
          ))}
        </Box>
      )}
    </React.Fragment>
  );
}
