import * as React from "react";
import { Box, Typography } from "@mui/material";
import { Folder } from "lucide-react";
import { ChatInput } from "@/components/Chat/ChatInput";
import { ConversationItem } from "@/components/Chat/ConversationItem";
import { DeleteConversationDialog } from "@/components/Chat/DeleteConversationDialog";
import { useChatStore } from "@/store/chatStore";
import { useNotify } from "@/hooks/useNotify";
import { getRepository } from "@/lib/repositories";
import type { Folder as FolderType, Conversation } from "@/types/chat";

type FolderHomeProps = {
  folder: FolderType;
  onSubmit: (value: string) => void | Promise<void>;
  onStop: () => void;
  isStreaming: boolean;
  selectedModel: string;
};

export function FolderHome({ folder, onSubmit, onStop, isStreaming, selectedModel }: FolderHomeProps) {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.actions.setActiveConversationId);
  const streamingConversationId = useChatStore((state) => state.streamingConversationId);
  const deleteConversation = useChatStore((state) => state.actions.deleteConversation);
  const renameConversation = useChatStore((state) => state.actions.renameConversation);
  const archiveConversation = useChatStore((state) => state.actions.archiveConversation);
  const notify = useNotify();

  const chats = conversations.filter((conversation) => conversation.folderId === folder.id && !conversation.isArchived);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = React.useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

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

  const handleExport = async (conv: Conversation) => {
    try {
      const repo = await getRepository();
      const messages = await repo.getMessages(conv.id, 99999, 0);
      const payload = { conversation: conv, messages };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(conv.title || "untitled").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify.success("Conversation exported");
    } catch (err) {
      notify.error("Failed to export conversation", err as string);
    }
  };

  return (
    <Box sx={{ flex: 1, width: "100%", maxWidth: 720, mx: "auto", px: 2, pt: { xs: 5, sm: 9 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Folder size={20} />
        <Typography variant="h6" sx={{ fontSize: "18px", fontWeight: 500 }}>{folder.name}</Typography>
      </Box>
      <ChatInput
        onSubmit={onSubmit}
        onStop={onStop}
        isStreaming={isStreaming}
        selectedModel={selectedModel}
        hasMessages={false}
      />
      <Box sx={{ display: "flex", gap: 1, mt: 1.5, mb: 5 }}>
        <Box sx={{ px: 1.5, py: 0.75, borderRadius: "16px", bgcolor: "action.selected", fontSize: "12px" }}>Chats</Box>
      </Box>
      {chats.length === 0 ? (
        <Box sx={{ textAlign: "center", color: "text.secondary", pt: 7 }}>
          <Typography sx={{ fontSize: "13px", color: "text.primary" }}>No chats yet</Typography>
          <Typography sx={{ fontSize: "12px", mt: 0.5 }}>Chats in {folder.name} will live here</Typography>
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
    </Box>
  );
}
