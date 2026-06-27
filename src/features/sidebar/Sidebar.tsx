import * as React from "react";
import { Box } from "@mui/material";
import { useFolderStore } from "@/store/folderStore";
import { useChatStore } from "@/store/chatStore";
import { DeleteConversationDialog } from "@/features/chat/components/DeleteConversationDialog";
import { ProfileMenu } from "@/features/profile/ProfileMenu";
import { useAuthStore } from "@/store/authStore";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import {
  useSidebarActions,
  SidebarActionsProvider,
} from "@/features/sidebar/hooks/useSidebarActions";
import { useConversationGroups } from "@/features/sidebar/hooks/useConversationGroups";
import type { SettingsTab } from "@/features/settings/SettingsModal";
import { SidebarBrand } from "@/features/sidebar/components/SidebarBrand";
import { NewChatButton } from "@/features/sidebar/components/NewChatButton";
import { SearchButton } from "@/features/sidebar/components/SearchButton";
import { FoldersSection } from "@/features/sidebar/components/FoldersSection";
import { ConversationList } from "@/features/sidebar/components/ConversationList";
import { CreateFolderDialog } from "@/features/sidebar/components/CreateFolderDialog";
import { GuestFooter } from "@/features/sidebar/components/GuestFooter";
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "@/features/sidebar/components/SidebarPrimitives";
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

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 64;

function SidebarBody({
  onOpenSettings,
  onOpenCommandPalette,
  onNewChat,
  conversations,
  collapsible,
}: Omit<
  SidebarProps,
  "onDeleteConversation" | "onRenameConversation" | "activeConversationId"
>) {
  const { isCollapsed } = useSidebar();
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
        <Box sx={{ px: isCollapsed ? 0 : 1.5, pb: 0.5 }}>
          <NewChatButton onClick={onNewChat} />
        </Box>
        <Box sx={{ px: isCollapsed ? 0 : 1.5, pb: 1.5 }}>
          <SearchButton onClick={onOpenCommandPalette} />
        </Box>

        {!isCollapsed && (
          <Box sx={{ pb: 0.5 }}>
            <FoldersSection
              folderConversations={folderConversations}
              streamingConversationId={streamingConversationId}
            />
          </Box>
        )}

        <Box
          sx={(theme) => ({
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            opacity: isCollapsed ? 0 : 1,
            visibility: isCollapsed ? "hidden" : "visible",
            transition: reducedMotion
              ? "none"
              : theme.transitions.create("opacity", {
                  duration: theme.transitions.duration.shorter,
                  easing: theme.transitions.easing.easeOut,
                }),
          })}
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

  const width =
    isCollapsed && collapsible === "icon" ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Box
      sx={(theme) => ({
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.sidebar,
        borderTopLeftRadius: theme.shape.borderRadius,
        overflowX: "hidden",
        position: "relative",
        width,
        transition: reducedMotion
          ? "none"
          : theme.transitions.create("width", {
              duration: theme.transitions.duration.shorter,
              easing: theme.transitions.easing.easeOut,
            }),
      })}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: EXPANDED_WIDTH,
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
