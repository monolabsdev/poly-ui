import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
  Stack,
} from "@mui/material";
import { Trash2, Archive, Download, AlertTriangle } from "lucide-react";
import { SettingCard, SectionHeader } from "../SettingComponents";
import { useChatStore } from "@/store/chatStore";
import { useNotify } from "@/hooks/useNotify";

function toCsvCell(value: unknown): string {
  const normalized = value === null || value === undefined ? "" : String(value);
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildChatsCsv(
  rows: Array<{
    conversationId: string;
    conversationTitle: string;
    conversationCreatedAt: string;
    conversationUpdatedAt: string;
    messageRole: string;
    messageContent: string;
    messageCreatedAt: string;
    messageModel: string;
  }>,
): string {
  const header = [
    "conversation_id",
    "conversation_title",
    "conversation_created_at",
    "conversation_updated_at",
    "message_role",
    "message_content",
    "message_created_at",
    "message_model",
  ];

  const lines = rows.map((row) =>
    [
      row.conversationId,
      row.conversationTitle,
      row.conversationCreatedAt,
      row.conversationUpdatedAt,
      row.messageRole,
      row.messageContent,
      row.messageCreatedAt,
      row.messageModel,
    ]
      .map(toCsvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export function DataControlsTab() {
  const notify = useNotify();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const { deleteAllConversations } = useChatStore.getState().actions;
      await deleteAllConversations();
      notify.success("All chats deleted");
      setDeleteOpen(false);
    } catch (err) {
      notify.error("Failed to delete chats", err as string);
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveAll = async () => {
    setArchiving(true);
    try {
      const { conversations, actions } = useChatStore.getState();
      for (const conv of conversations) {
        await actions.archiveConversation(conv.id);
      }
      notify.success("All chats archived");
      setArchiveOpen(false);
    } catch (err) {
      notify.error("Failed to archive chats", err as string);
    } finally {
      setArchiving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const repoModule = await import("@/lib/repositories");
      const repo = repoModule.getRepository();
      const conversations = await repo.getConversations();
      const exportRows: Array<{
        conversationId: string;
        conversationTitle: string;
        conversationCreatedAt: string;
        conversationUpdatedAt: string;
        messageRole: string;
        messageContent: string;
        messageCreatedAt: string;
        messageModel: string;
      }> = [];

      for (const conv of conversations) {
        const messages = await repo.getMessages(conv.id, 9999, 0);
        if (messages.length === 0) {
          exportRows.push({
            conversationId: conv.id,
            conversationTitle: conv.title ?? "Untitled",
            conversationCreatedAt: conv.createdAt,
            conversationUpdatedAt: conv.updatedAt,
            messageRole: "",
            messageContent: "",
            messageCreatedAt: "",
            messageModel: "",
          });
          continue;
        }

        for (const message of messages) {
          exportRows.push({
            conversationId: conv.id,
            conversationTitle: conv.title ?? "Untitled",
            conversationCreatedAt: conv.createdAt,
            conversationUpdatedAt: conv.updatedAt,
            messageRole: message.role,
            messageContent: message.content,
            messageCreatedAt: message.createdAt,
            messageModel: message.model ?? "",
          });
        }
      }

      const csv = buildChatsCsv(exportRows);
      const date = new Date().toISOString().slice(0, 10);
      const defaultFileName = `polyui-export-${date}.csv`;

      if ("showSaveFilePicker" in window) {
        const fileHandle = await (
          window as Window & {
            showSaveFilePicker?: (options?: {
              suggestedName?: string;
              types?: Array<{
                description?: string;
                accept: Record<string, string[]>;
              }>;
            }) => Promise<{
              createWritable: () => Promise<{
                write: (data: string) => Promise<void>;
                close: () => Promise<void>;
              }>;
            }>;
          }
        ).showSaveFilePicker?.({
          suggestedName: defaultFileName,
          types: [
            {
              description: "CSV file",
              accept: { "text/csv": [".csv"] },
            },
          ],
        });

        if (fileHandle) {
          const writable = await fileHandle.createWritable();
          await writable.write(csv);
          await writable.close();
          notify.success(
            `Exported ${conversations.length} conversations as CSV`,
          );
          return;
        }
      }

      // Fallback for environments without File System Access API
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = defaultFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      notify.success(`Exported ${conversations.length} conversations as CSV`);
    } catch (err) {
      notify.error("Failed to export chats", err as string);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Data Controls"
        description="Manage your conversation data."
      />

      <SettingCard
        title="Export Chats"
        description="Choose a location and export all conversations as CSV."
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={handleExport}
            disabled={exporting}
            startIcon={
              exporting ? <CircularProgress size={14} /> : <Download size={14} />
            }
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {exporting ? "Exporting..." : "Export"}
          </Button>
        }
      />

      <SettingCard
        title="Archive All Chats"
        description="Move all conversations to the archived state."
        action={
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={() => setArchiveOpen(true)}
            startIcon={<Archive size={14} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Archive All
          </Button>
        }
      />

      <SettingCard
        title="Delete All Chats"
        description="Permanently remove all conversations and messages."
        action={
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => setDeleteOpen(true)}
            startIcon={<Trash2 size={14} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Delete All
          </Button>
        }
      />

      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
      >
        <DialogTitle>Delete all chats?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
              This will permanently delete all conversations and messages. This
              action cannot be undone.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            size="small"
            variant="text"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            disableElevation
            onClick={handleDeleteAll}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete All"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={archiveOpen}
        onClose={() => !archiving && setArchiveOpen(false)}
      >
        <DialogTitle>Archive all chats?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            All conversations will be archived. You can view archived chats from
            the profile menu.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            size="small"
            variant="text"
            onClick={() => setArchiveOpen(false)}
            disabled={archiving}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="warning"
            disableElevation
            onClick={handleArchiveAll}
            disabled={archiving}
          >
            {archiving ? "Archiving..." : "Archive All"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
