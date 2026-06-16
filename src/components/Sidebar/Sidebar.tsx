import * as React from "react";
import { Box, useTheme } from "@mui/material";
import { motion } from "motion/react";
import { useTiming } from "@/lib/motion";
import { useFolderStore } from "@/store/folderStore";
import { useChatStore } from "@/store/chatStore";
import { DeleteConversationDialog } from "@/components/Chat/DeleteConversationDialog";
import { ProfileMenu } from "@/components/Profile/ProfileMenu";
import { useAuthStore } from "@/store/authStore";
import { useSidebar } from "@/components/Sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/components/Sidebar/hooks/useReducedMotion";
import { useSidebarActions, SidebarActionsProvider } from "@/components/Sidebar/hooks/useSidebarActions";
import { useConversationGroups } from "@/components/Sidebar/hooks/useConversationGroups";
import type { SettingsTab } from "@/components/Settings/SettingsModal";
import { SidebarBrand } from "@/components/Sidebar/components/SidebarBrand";
import { NewChatButton } from "@/components/Sidebar/components/NewChatButton";
import { SearchButton } from "@/components/Sidebar/components/SearchButton";
import { FoldersSection } from "@/components/Sidebar/components/FoldersSection";
import { ConversationList } from "@/components/Sidebar/components/ConversationList";
import { CreateFolderDialog } from "@/components/Sidebar/components/CreateFolderDialog";
import { GuestFooter } from "@/components/Sidebar/components/GuestFooter";
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSectionLabel,
} from "@/components/Sidebar/components/SidebarPrimitives";
import { Conversation } from "@/types/chat";

interface SidebarProps {
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenCommandPalette: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  conversations: Conversation[];
  activeConversationId: string | null;
  collapsible?: "icon" | "none";
}

function SidebarBody({
  onOpenSettings,
  onOpenCommandPalette,
  onNewChat,
  conversations,
  collapsible,
}: Omit<SidebarProps, "onDeleteConversation" | "onRenameConversation" | "activeConversationId">) {
  const { isCollapsed } = useSidebar();
  const theme = useTheme();
  const timing = useTiming();
  const reducedMotion = useReducedMotion();
  const isGuest = useAuthStore((s) => s.isGuest);
  const conversationsLoading = useChatStore(
    (state) => state.conversationsLoading,
  );
  const streamingConversationId = useChatStore(
    (state) => state.streamingConversationId,
  );
  const loadFolders = useFolderStore((s) => s.actions.loadFolders);
  const { conv, folder } = useSidebarActions();

  const groupedConversations = useConversationGroups(conversations);
  const folderConversations = React.useMemo(
    () =>
      conversations.filter(
        (c) => c.folderId && !c.isArchived && !c.isTemporary,
      ),
    [conversations],
  );

  React.useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const sidebarContent = (
    <>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        <Box sx={{ px: isCollapsed ? 1 : 1.5, pb: 1.5 }}>
          <NewChatButton onClick={onNewChat} />
        </Box>
        <Box sx={{ px: isCollapsed ? 1 : 1.5, pb: isCollapsed ? 1 : 2 }}>
          <SearchButton onClick={onOpenCommandPalette} />
        </Box>

        {!isCollapsed && (
          <Box sx={{ pb: 0 }}>
            <FoldersSection
              folderConversations={folderConversations}
              streamingConversationId={streamingConversationId}
            />
          </Box>
        )}

        {!isCollapsed && (
          <Box sx={{ px: 1.5, pt: 2.5, pb: 1 }}>
            <SidebarSectionLabel>Chats</SidebarSectionLabel>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            opacity: isCollapsed ? 0 : 1,
            visibility: isCollapsed ? "hidden" : "visible",
            transition: reducedMotion ? "none" : "opacity 0.18s ease",
          }}
        >
          <ConversationList
            groupedConversations={groupedConversations}
            conversationsLoading={conversationsLoading}
            streamingConversationId={streamingConversationId}
          />
        </Box>

      </SidebarContent>

      <SidebarFooter>
        {isGuest ? (
          <GuestFooter onOpenSettings={onOpenSettings} />
        ) : (
          <ProfileMenu onOpenSettings={onOpenSettings} />
        )}
      </SidebarFooter>

      <DeleteConversationDialog
        open={conv.isDeleteDialogOpen}
        onOpenChange={conv.setIsDeleteDialogOpen}
        onConfirm={conv.handleConfirmDelete}
        title={conv.deleteTitle}
      />

      <CreateFolderDialog folder={folder} />
    </>
  );

  const width = isCollapsed && collapsible === "icon" ? 60 : 260;

  return (
    <Box
      component={motion.div}
      initial={false}
      animate={{ width }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: timing.duration("base"), ease: timing.ease }
      }
      style={{
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.sidebar,
        borderRight: "1px solid",
        borderColor: theme.palette.divider,
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          width: isCollapsed ? 60 : 260,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "transparent",
        }}
      >
        {sidebarContent}
      </Box>
    </Box>
  );
}

export const Sidebar = React.memo(function Sidebar({
  onOpenSettings,
  onOpenCommandPalette,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  conversations,
  collapsible,
}: SidebarProps) {
  return (
    <SidebarActionsProvider
      conversations={conversations}
      onDeleteConversation={onDeleteConversation}
      onRenameConversation={onRenameConversation}
      onSelectConversation={onSelectConversation}
    >
      <SidebarBody
        onOpenSettings={onOpenSettings}
        onOpenCommandPalette={onOpenCommandPalette}
        onNewChat={onNewChat}
        onSelectConversation={onSelectConversation}
        conversations={conversations}
        collapsible={collapsible}
      />
    </SidebarActionsProvider>
  );
});
