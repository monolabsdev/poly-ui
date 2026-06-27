import { Box, Typography } from "@mui/material";
import { MessageSquare } from "lucide-react";
import { ConversationItem } from "@/features/chat/components/ConversationItem";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
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

  const handleExport = async (c: Conversation) => {
    try {
      const { getRepository } = await import("@/lib/repositories");
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
    <Box>
      <Box sx={{ px: 1.5, mb: 0.5 }}>
        <SidebarSectionHeader label="Chats" />
      </Box>
      {groupedConversations.map((group) => (
        <Box key={group.id} sx={{ mb: 0.5 }}>
          <SidebarGroup sx={{ mb: 0 }}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((c) => (
                  <SidebarMenuButton
                    key={c.id}
                    isActive={activeConversationId === c.id}
                    ariaCurrent={activeConversationId === c.id}
                    tooltip={c.title || "Untitled"}
                    onClick={() => {
                      onSelectConversation(c.id);
                      if (isMobile) setOpenMobile(false);
                    }}
                    sx={{
                      "&:hover .conversation-actions": { opacity: 1 },
                    }}
                  >
                    <ConversationItem
                      conv={c}
                      activeConversationId={activeConversationId}
                      isGenerating={streamingConversationId === c.id}
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </Box>
      ))}
    </Box>
  );
}
