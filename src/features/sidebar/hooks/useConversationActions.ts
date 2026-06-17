import * as React from "react";
import { useNotify } from "@/hooks/useNotify";
import { useChatStore } from "@/store/chatStore";
import { Conversation } from "@/types/chat";

export interface UseConversationActions {
  editingId: string | null;
  editValue: string;
  deleteId: string | null;
  deleteTitle: string;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setEditValue: (value: string) => void;
  handleStartDelete: (conv: Conversation) => void;
  handleConfirmDelete: () => Promise<void>;
  handleStartRename: (e: React.MouseEvent, conv: Conversation) => void;
  handleConfirmRename: (e: React.MouseEvent, id: string) => Promise<void>;
  handleCancelRename: (e: React.MouseEvent) => void;
  handleArchive: (id: string) => Promise<void>;
}

interface UseConversationActionsArgs {
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
}

export function useConversationActions({
  onDeleteConversation,
  onRenameConversation,
}: UseConversationActionsArgs): UseConversationActions {
  const notify = useNotify();
  const archiveConversation = useChatStore(
    (state) => state.actions.archiveConversation,
  );

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = React.useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const handleStartDelete = (conv: Conversation) => {
    setDeleteId(conv.id);
    setDeleteTitle(conv.title || "Untitled");
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await onDeleteConversation(deleteId);
      notify.success("Conversation deleted");
    } catch {
      notify.error("Failed to delete conversation");
    }
    setDeleteId(null);
    setDeleteTitle("");
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
    const trimmed = editValue.trim();
    if (trimmed) {
      try {
        await onRenameConversation(id, trimmed);
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

  return {
    editingId,
    editValue,
    deleteId,
    deleteTitle,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    setEditValue,
    handleStartDelete,
    handleConfirmDelete,
    handleStartRename,
    handleConfirmRename,
    handleCancelRename,
    handleArchive,
  };
}
