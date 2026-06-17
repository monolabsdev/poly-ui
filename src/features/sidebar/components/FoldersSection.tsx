import { Box, IconButton, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import { useFolderStore } from "@/store/folderStore";
import { Conversation } from "@/types/chat";
import { FolderTree } from "@/features/sidebar/components/FolderTree";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarSectionLabel,
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

  return (
    <SidebarGroup sx={{ mb: 0 }}>
      <Box
        className="folders-header"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          minHeight: 28,
          pb: 1,
        }}
      >
        <SidebarSectionLabel>Folders</SidebarSectionLabel>
        <IconButton
          size="small"
          aria-label="Create folder"
          onClick={folder.openCreateModal}
          sx={{
            p: 0.25,
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
          }}
        >
          <Plus size={16} />
        </IconButton>
      </Box>
      <SidebarGroupContent>
        <SidebarMenu>
          {empty ? (
            <Box
              sx={{
                pl: 1.5,
                pr: 1.5,
                py: 1.5,
                color: "text.secondary",
                opacity: 0.7,
              }}
            >
              <Typography sx={{ fontSize: "12px", lineHeight: 1.4 }}>
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
