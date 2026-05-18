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
      const exportData: Record<string, unknown>[] = [];

      for (const conv of conversations) {
        const messages = await repo.getMessages(conv.id, 9999, 0);
        exportData.push({
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            model: m.model,
          })),
        });
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `openbench-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success(`Exported ${exportData.length} conversations`);
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
        description="Download all conversations as a JSON file."
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
