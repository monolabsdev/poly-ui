import { Box, Typography } from "@mui/material";
import { MessageSquare } from "lucide-react";
import { ConversationItem } from "@/components/Chat/ConversationItem";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
} from "@/components/Sidebar/components/SidebarPrimitives";
import { ConversationSkeleton } from "@/components/Sidebar/components/ConversationSkeleton";
import { useSidebar } from "@/components/Sidebar/hooks/useSidebar";
import { useSidebarActions } from "@/components/Sidebar/hooks/useSidebarActions";
import { useChatStore } from "@/store/chatStore";
import { ConversationGroup } from "@/components/Sidebar/hooks/useConversationGroups";

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
          sx={{
            fontSize: "12px",
            lineHeight: 1.4,
            color: "text.secondary",
            opacity: 0.75,
          }}
        >
          No chats yet
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {groupedConversations.map((group) => (
        <Box key={group.id} sx={{ mb: 1 }}>
          <SidebarGroup sx={{ mb: 0 }}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent sx={{ mt: 0.5 }}>
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
                      contentVisibility: "auto",
                      containIntrinsicSize: "1px 36px",
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
                    />
                  </SidebarMenuButton>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </Box>
      ))}
    </>
  );
}
