import { Box, IconButton, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import { useFolderStore } from "@/store/folderStore";
import { Conversation } from "@/types/chat";
import { FolderTree } from "@/features/sidebar/components/FolderTree";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarSectionHeader,
  sidebarIconButtonSx,
} from "@/features/sidebar/components/SidebarPrimitives";

export interface FoldersSectionProps {
  folderConversations: Conversation[];
  streamingConversationId: string | null;
}

export function FoldersSection({
  folderConversations,
  streamingConversationId,
}: FoldersSectionProps) {
  const folders = useFolderStore((s) => s.folders);
  const { folder } = useSidebarActions();
  const rootFolders = folders.filter((f) => !f.parentId);
  const empty = rootFolders.length === 0;
  const reducedMotion = useReducedMotion();

  return (
    <SidebarGroup sx={{ mb: 0 }}>
      <Box sx={{ px: 1.5, mb: 0.5 }}>
        <SidebarSectionHeader
          label="Folders"
          action={
            <IconButton
              size="small"
              aria-label="Create folder"
              onClick={folder.openCreateModal}
              sx={(theme) => sidebarIconButtonSx(theme, reducedMotion)}
            >
              <Plus />
            </IconButton>
          }
        />
      </Box>
      <SidebarGroupContent>
        <SidebarMenu>
          {empty ? (
            <Box
              sx={{
                px: 1.5,
                py: 1.5,
                color: "text.secondary",
                opacity: 0.7,
              }}
            >
              <Typography
                sx={(theme) => ({
                  ...theme.typography.caption,
                  lineHeight: 1.4,
                })}
              >
                No folders
              </Typography>
            </Box>
          ) : (
            rootFolders.map((f) => (
              <FolderTree
                key={f.id}
                folder={f}
                folderConversations={folderConversations}
                streamingConversationId={streamingConversationId}
              />
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
