import * as React from "react";
import { useFolderStore } from "@/store/folderStore";
import { collectDescendantFolderIds } from "@/lib/folders";
import { Conversation, Folder } from "@/types/chat";

function slugifyFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "folder";
}

export interface UseFolderActions {
  folderEditingId: string | null;
  folderEditValue: string;
  editingFolder: Folder | null;
  folderParentId: string | undefined;
  isFolderModalOpen: boolean;
  openCreateModal: () => void;
  openCreateInFolder: (folderId: string) => void;
  closeModal: (open: boolean) => void;
  onStartRename: (folder: Folder) => void;
  onConfirmRename: () => Promise<void>;
  onCancelRename: () => void;
  onOpenEdit: (folder: Folder) => void;
  onDelete: (folder: { id: string; name: string }) => Promise<void>;
  onExport: (folder: { id: string; name: string }) => void;
  setFolderEditValue: (value: string) => void;
}

export function useFolderActions(conversations: Conversation[]): UseFolderActions {
  const folders = useFolderStore((s) => s.folders);
  const updateFolder = useFolderStore((s) => s.actions.updateFolder);
  const deleteFolder = useFolderStore((s) => s.actions.deleteFolder);

  const [folderEditingId, setFolderEditingId] = React.useState<string | null>(
    null,
  );
  const [folderEditValue, setFolderEditValue] = React.useState("");
  const [editingFolder, setEditingFolder] = React.useState<Folder | null>(null);
  const [folderParentId, setFolderParentId] = React.useState<
    string | undefined
  >();
  const [isFolderModalOpen, setIsFolderModalOpen] = React.useState(false);

  const openCreateModal = () => {
    setFolderParentId(undefined);
    setIsFolderModalOpen(true);
  };

  const openCreateInFolder = (folderId: string) => {
    setFolderParentId(folderId);
    setIsFolderModalOpen(true);
  };

  const closeModal = (open: boolean) => {
    setIsFolderModalOpen(open);
    if (!open) setEditingFolder(null);
  };

  const onStartRename = (folder: Folder) => {
    setFolderEditingId(folder.id);
    setFolderEditValue(folder.name);
  };

  const onConfirmRename = async () => {
    if (!folderEditingId) return;
    const trimmed = folderEditValue.trim();
    if (trimmed) {
      await updateFolder(folderEditingId, { name: trimmed });
    }
    setFolderEditingId(null);
  };

  const onCancelRename = () => {
    setFolderEditingId(null);
  };

  const onOpenEdit = (folder: Folder) => {
    setEditingFolder(folder);
    setFolderParentId(folder.parentId);
    setIsFolderModalOpen(true);
  };

  const onDelete = async (folder: { id: string; name: string }) => {
    if (!window.confirm(`Delete folder "${folder.name}"? Chats stay saved.`))
      return;
    await deleteFolder(folder.id);
  };

  const onExport = async (folder: { id: string; name: string }) => {
    const folderIds = collectDescendantFolderIds(folders, folder.id);
    const payload = {
      folder,
      folders: folders.filter((candidate) => folderIds.has(candidate.id)),
      conversations: conversations.filter(
        (conversation) =>
          conversation.folderId && folderIds.has(conversation.folderId),
      ),
    };
    const json = JSON.stringify(payload, null, 2);
    const fileName = `${slugifyFilename(folder.name)}.json`;

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
        new Blob([json], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return {
    folderEditingId,
    folderEditValue,
    editingFolder,
    folderParentId,
    isFolderModalOpen,
    openCreateModal,
    openCreateInFolder,
    closeModal,
    onStartRename,
    onConfirmRename,
    onCancelRename,
    onOpenEdit,
    onDelete,
    onExport,
    setFolderEditValue,
  };
}
