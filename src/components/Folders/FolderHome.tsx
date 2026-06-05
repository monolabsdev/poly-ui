import * as React from "react";
import { Box, Button, ButtonBase, Typography, IconButton } from "@mui/material";
import { Folder, MessageSquare, Trash2, X } from "lucide-react";
import { ChatInput } from "@/components/Chat/ChatInput";
import { ConversationItem } from "@/components/Chat/ConversationItem";
import { DeleteConversationDialog } from "@/components/Chat/DeleteConversationDialog";
import { useChatStore } from "@/store/chatStore";
import { useNotify } from "@/hooks/useNotify";
import { getRepository } from "@/lib/repositories";
import type { Folder as FolderType, Conversation } from "@/types/chat";
import { FolderSources } from "./FolderSources";

type FolderHomeProps = {
  folder: FolderType;
  onSubmit: (value: string) => void | Promise<void>;
  onStop: () => void;
  isStreaming: boolean;
  providerOnline: boolean;
  onOpenConnections: () => void;
};

export function FolderHome({ folder, onSubmit, onStop, isStreaming, providerOnline, onOpenConnections }: FolderHomeProps) {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.actions.setActiveConversationId);
  const streamingConversationId = useChatStore((state) => state.streamingConversationId);
  const deleteConversation = useChatStore((state) => state.actions.deleteConversation);
  const deleteConversations = useChatStore((state) => state.actions.deleteConversations);
  const renameConversation = useChatStore((state) => state.actions.renameConversation);
  const archiveConversation = useChatStore((state) => state.actions.archiveConversation);
  const notify = useNotify();

  const chats = conversations.filter((conversation) => conversation.folderId === folder.id && !conversation.isArchived);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = React.useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"chats" | "sources">("chats");

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
        await renameConversation(id, editValue.trim());
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

  const handleStartDelete = (conv: Conversation) => {
    setDeleteId(conv.id);
    setDeleteTitle(conv.title || "Untitled");
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      try {
        await deleteConversation(deleteId);
        notify.success("Conversation deleted");
      } catch {
        notify.error("Failed to delete conversation");
      }
      setDeleteId(null);
      setDeleteTitle("");
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleSelectAll = () => {
    setSelectedIds(new Set(chats.map((c) => c.id)));
  };

  const handleBatchDelete = () => {
    setIsBatchDeleteDialogOpen(true);
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteConversations(Array.from(selectedIds));
      notify.success(`Deleted ${selectedIds.size} conversation${selectedIds.size > 1 ? "s" : ""}`);
    } catch {
      notify.error("Failed to delete conversations");
    }
    setSelectedIds(new Set());
  };

  const handleExport = async (conv: Conversation) => {
    try {
      const repo = await getRepository();
      const messages = await repo.getMessages(conv.id, 99999, 0);
      const payload = { conversation: conv, messages };
      const json = JSON.stringify(payload, null, 2);
      const fileName = `${(conv.title || "untitled").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;

      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({
          filters: [{ name: "JSON", extensions: ["json"] }],
          defaultPath: fileName,
        });
        if (!filePath) return;
        await writeTextFile(filePath, json);
      } catch {
        const url = URL.createObjectURL(
          new Blob([json], { type: "application/json" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      notify.success("Conversation exported");
    } catch (err) {
      notify.error("Failed to export conversation", String(err));
    }
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, width: "100%", overflowY: "auto", px: 2 }}>
      <Box sx={{ width: "100%", maxWidth: 720, mx: "auto", pt: { xs: 4, sm: 6 }, pb: 5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Folder size={20} />
        <Typography variant="h6" sx={{ fontSize: "18px", fontWeight: 500 }}>{folder.name}</Typography>
      </Box>
      <ChatInput
        onSubmit={onSubmit}
        onStop={onStop}
        isStreaming={isStreaming}
      />
      {!providerOnline && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: "12px" }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>No provider connected</Typography>
            <Typography sx={{ mt: 0.25, fontSize: 12, color: "text.secondary" }}>Start Ollama, then connect it to chat in this folder.</Typography>
          </Box>
          <Button variant="outlined" onClick={onOpenConnections} sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700 }}>
            Open Connections
          </Button>
        </Box>
      )}
      <Box role="tablist" aria-label="Folder content" sx={{ display: "flex", gap: 1, mt: 1.5, mb: 2.5 }}>
        {(["chats", "sources"] as const).map((tab) => (
          <ButtonBase
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: "9999px",
              justifyContent: "flex-start",
              bgcolor: activeTab === tab ? "action.selected" : "transparent",
              color: activeTab === tab ? "text.primary" : "text.secondary",
              fontFamily: "inherit",
              fontSize: "12px",
              textTransform: "capitalize",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {tab}
          </ButtonBase>
        ))}
      </Box>
      {activeTab === "sources" ? (
        <Box role="tabpanel"><FolderSources folder={folder} /></Box>
      ) : (
      <Box role="tabpanel" sx={{ width: "100%" }}>
      {selectedIds.size > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: 1.5,
            px: 1,
            py: 1,
            borderRadius: "8px",
            bgcolor: "action.selected",
          }}
        >
          <Typography sx={{ fontSize: "13px", flex: 1 }}>
            {selectedIds.size} selected
          </Typography>
          <Typography
            component="button"
            onClick={selectedIds.size === chats.length ? handleClearSelection : handleSelectAll}
            sx={{
              fontSize: "12px",
              color: "primary.main",
              cursor: "pointer",
              bgcolor: "transparent",
              border: "none",
              p: 0,
              fontFamily: "inherit",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {selectedIds.size === chats.length ? "Deselect all" : "Select all"}
          </Typography>
          <IconButton
            size="small"
            aria-label="Delete selected conversations"
            onClick={handleBatchDelete}
            sx={{ color: "error.main", p: 0.5 }}
          >
            <Trash2 size={16} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Clear selection"
            onClick={handleClearSelection}
            sx={{ color: "text.secondary", p: 0.5 }}
          >
            <X size={16} />
          </IconButton>
        </Box>
      )}
      {chats.length === 0 ? (
        <Box sx={{ textAlign: "center", pt: 9 }}>
          <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <Typography sx={{ fontSize: "13px", color: "text.primary" }}>Start a chat in this folder</Typography>
          <Typography sx={{ fontSize: "12px", mt: 0.5, color: "text.secondary" }}>New conversations will stay grouped in {folder.name}.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {chats.map((chat) => (
            <ConversationItem
              key={chat.id}
              conv={chat}
              activeConversationId={activeConversationId}
              isGenerating={streamingConversationId === chat.id}
              onClick={() => setActiveConversationId(chat.id)}
              variant="folder"
              selected={selectedIds.has(chat.id)}
              onToggleSelect={toggleSelect}
              editingId={editingId}
              editValue={editValue}
              setEditValue={setEditValue}
              handleConfirmRename={handleConfirmRename}
              handleCancelRename={handleCancelRename}
              handleStartRename={handleStartRename}
              handleArchive={handleArchive}
              handleStartDelete={handleStartDelete}
              onExport={handleExport}
            />
          ))}
        </Box>
      )}

      <DeleteConversationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={deleteTitle}
      />
      <DeleteConversationDialog
        open={isBatchDeleteDialogOpen}
        onOpenChange={setIsBatchDeleteDialogOpen}
        onConfirm={handleConfirmBatchDelete}
        count={selectedIds.size}
      />
      </Box>
      )}
      </Box>
    </Box>
  );
}
