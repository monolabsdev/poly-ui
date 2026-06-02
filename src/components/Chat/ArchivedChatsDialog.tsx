// Design: Quiet instrument panel — fixed-width shell, soft contrast, precise spacing.
import {
  AppDialogBody,
  AppDialogFrame,
  AppDialogHeader,
  appPanelSx,
} from "@/components/ui/appDialog";
import { useChatStore } from "@/store/chatStore";
import { Box, IconButton, InputBase, Stack, Tooltip, Typography } from "@mui/material";
import { ArchiveRestore, MessageSquare, Search, Trash2 } from "lucide-react";
import { useState } from "react";

interface ArchivedChatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedChatsDialog({
  open,
  onOpenChange,
}: ArchivedChatsDialogProps) {
  const conversations = useChatStore((s) => s.conversations);
  const actions = useChatStore((s) => s.actions);
  const [searchQuery, setSearchQuery] = useState("");

  const archivedConversations = conversations
    .filter((conversation) => conversation.isArchived)
    .filter((conversation) =>
      (conversation.title || "Untitled").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <AppDialogFrame open={open} onOpenChange={onOpenChange}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <AppDialogHeader
          title="Archived Chats"
          onClose={() => onOpenChange(false)}
        />

        <AppDialogBody>
          <Stack spacing={2}>
            <SearchField value={searchQuery} onChange={setSearchQuery} />

            {archivedConversations.length === 0 ? (
              <EmptyArchivedState hasSearch={searchQuery.length > 0} />
            ) : (
              <Stack spacing={1}>
                {archivedConversations.map((conversation) => (
                  <Box key={conversation.id} sx={chatRowSx}>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={chatIconSx}>
                        <MessageSquare size={17} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "text.primary",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {conversation.title || "Untitled"}
                        </Typography>
                        <Typography sx={{ mt: 0.35, color: "text.secondary", fontSize: 12 }}>
                          Archived on{" "}
                          {new Date(conversation.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <Tooltip title="Restore">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            actions.unarchiveConversation(conversation.id);
                          }}
                          sx={actionButtonSx}
                        >
                          <ArchiveRestore size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            actions.deleteConversation(conversation.id);
                          }}
                          sx={{
                            ...actionButtonSx,
                            "&:hover": { bgcolor: "error.main", color: "error.contrastText" },
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </AppDialogBody>
      </Box>
    </AppDialogFrame>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Box sx={searchShellSx}>
      <Search size={17} />
      <InputBase
        placeholder="Search archived chats..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        sx={{
          flex: 1,
          fontSize: 14,
          color: "text.primary",
          "& .MuiInputBase-input::placeholder": {
            color: "text.secondary",
            opacity: 0.7,
          },
        }}
      />
    </Box>
  );
}

function EmptyArchivedState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <Stack
      spacing={1.25}
      sx={{
        ...appPanelSx,
        minHeight: 240,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Box sx={emptyIconSx}>
        <ArchiveRestore size={24} />
      </Box>
      <Typography sx={{ fontWeight: 800, color: "text.primary", fontSize: 14 }}>
        {hasSearch ? "No matching chats" : "No archived chats"}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
        {hasSearch ? "Try a different search term" : "Your archived conversations will appear here"}
      </Typography>
    </Stack>
  );
}

const searchShellSx = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  px: 1.5,
  height: 40,
  bgcolor: "transparent",
  color: "text.secondary",
  border: "none",
  borderBottom: "1px solid",
  borderRadius: 0,
  borderColor: "divider",
  transition: "border-color 160ms ease",
  "&:focus-within": {
    borderColor: "text.secondary",
  },
} as const;

const chatRowSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1.5,
  p: 1.5,
  borderBottom: "1px solid",
  borderColor: "divider",
  transition: "background 100ms ease",
  "&:hover": {
    bgcolor: "action.hover",
  },
} as const;

const chatIconSx = {
  width: 32,
  height: 32,
  borderRadius: "8px",
  bgcolor: "transparent",
  color: "text.secondary",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
} as const;

const emptyIconSx = {
  width: 48,
  height: 48,
  borderRadius: "8px",
  bgcolor: "transparent",
  display: "grid",
  placeItems: "center",
  color: "text.secondary",
} as const;

const actionButtonSx = {
  width: 32,
  height: 32,
  color: "text.secondary",
  "&:hover": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
  },
} as const;
