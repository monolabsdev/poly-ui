import { Box, Typography } from "@mui/material";
import { MessageSquare } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { ConversationItem } from "@/features/chat/components/ConversationItem";
import {
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarSectionHeader,
} from "@/features/sidebar/components/SidebarPrimitives";
import { ConversationSkeleton } from "@/features/sidebar/components/ConversationSkeleton";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
import { useChatStore } from "@/store/chatStore";
import { useNotify } from "@/hooks/useNotify";
import { ConversationGroup } from "@/features/sidebar/hooks/useConversationGroups";
import type { Conversation } from "@/types/chat";
import { getRepository } from "@/lib/repositories";

type ConversationRow =
  | { id: string; type: "group"; label: string }
  | { id: string; type: "conversation"; conversation: Conversation };

export interface ConversationListProps {
  groupedConversations: ConversationGroup[];
  conversationsLoading: boolean;
  streamingConversationId: string | null;
}

export function ConversationList({
  groupedConversations,
  conversationsLoading,
  streamingConversationId,
}: ConversationListProps) {
  const { isCollapsed, isMobile, setOpenMobile } = useSidebar();
  const { conv, onSelectConversation } = useSidebarActions();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const notify = useNotify();
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<ConversationRow[]>(
    () =>
      groupedConversations.flatMap((group) => [
        { id: `group-${group.id}`, type: "group" as const, label: group.label },
        ...group.items.map((conversation) => ({
          id: conversation.id,
          type: "conversation" as const,
          conversation,
        })),
      ]),
    [groupedConversations],
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (rows[index]?.type === "group" ? 30 : 42),
    overscan: 8,
  });

  const handleExport = async (c: Conversation) => {
    try {
      const repo = getRepository();
      const messages = await repo.getMessages(c.id, 99999, 0);
      const payload = { conversation: c, messages };
      const json = JSON.stringify(payload, null, 2);
      const fileName = `${(c.title || "untitled").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;

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
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
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

  if (conversationsLoading) {
    return <ConversationSkeleton />;
  }

  if (groupedConversations.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
          px: 2,
          color: "text.secondary",
          textAlign: "center",
        }}
      >
        <MessageSquare size={16} style={{ opacity: 0.5 }} />
        <Typography
          sx={(theme) => ({
            ...theme.typography.caption,
            lineHeight: 1.4,
            color: "text.secondary",
            opacity: 0.75,
          })}
        >
          No chats yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: 0, flex: 1, flexDirection: "column" }}>
      <Box sx={{ px: 1.5, mb: 0.25 }}>
        <SidebarSectionHeader label="Recents" />
      </Box>
      <Box ref={parentRef} sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        <Box
          sx={{
            height: rowVirtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return (
              <Box
                key={row.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === "group" ? (
                  <SidebarGroupLabel>{row.label}</SidebarGroupLabel>
                ) : (
                  <Box sx={{ px: isCollapsed ? 0.5 : 1.5, py: 0.125 }}>
                    <SidebarMenuButton
                      isActive={activeConversationId === row.conversation.id}
                      ariaCurrent={activeConversationId === row.conversation.id}
                      tooltip={row.conversation.title || "Untitled"}
                      onClick={() => {
                        onSelectConversation(row.conversation.id);
                        if (isMobile) setOpenMobile(false);
                      }}
                      sx={{
                        px: 1,
                        "&:hover .conversation-actions, &:focus-within .conversation-actions": { opacity: 1 },
                      }}
                    >
                      <ConversationItem
                        conv={row.conversation}
                        activeConversationId={activeConversationId}
                        isGenerating={streamingConversationId === row.conversation.id}
                        isCollapsed={isCollapsed}
                        editingId={conv.editingId}
                        editValue={conv.editValue}
                        setEditValue={conv.setEditValue}
                        handleConfirmRename={conv.handleConfirmRename}
                        handleCancelRename={conv.handleCancelRename}
                        handleStartRename={conv.handleStartRename}
                        handleArchive={conv.handleArchive}
                        handleStartDelete={conv.handleStartDelete}
                        onExport={handleExport}
                      />
                    </SidebarMenuButton>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
