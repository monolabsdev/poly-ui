import * as React from "react";
import { Box, Collapse, IconButton, Typography } from "@mui/material";
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

const FOLDERS_COLLAPSED_STORAGE_KEY = "polyui:sidebar:folders-collapsed";
const FOLDERS_SECTION_CONTENT_ID = "sidebar-folders-section-content";

function readFoldersCollapsedPreference() {
  try {
    return localStorage.getItem(FOLDERS_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function useFoldersSectionCollapsed() {
  const [isCollapsed, setIsCollapsed] = React.useState(readFoldersCollapsedPreference);

  const setPersistedCollapsed = React.useCallback((next: boolean) => {
    setIsCollapsed(next);
    try {
      localStorage.setItem(FOLDERS_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // Ignore unavailable storage; disclosure remains usable for this session.
    }
  }, []);

  return [isCollapsed, setPersistedCollapsed] as const;
}

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
  const [isCollapsed, setIsCollapsed] = useFoldersSectionCollapsed();

  return (
    <SidebarGroup sx={{ mb: 1 }}>
      <Box sx={{ px: 1.5, mb: 0.25 }}>
        <SidebarSectionHeader
          label="Folders"
          disclosure={{
            expanded: !isCollapsed,
            onToggle: () => setIsCollapsed(!isCollapsed),
            controlsId: FOLDERS_SECTION_CONTENT_ID,
          }}
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
      <Collapse
        id={FOLDERS_SECTION_CONTENT_ID}
        in={!isCollapsed}
        timeout={reducedMotion ? 0 : "auto"}
        unmountOnExit
      >
        <SidebarGroupContent>
          <SidebarMenu>
            {empty ? (
              <Box
                sx={{
                  px: 1,
                  py: 1,
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
      </Collapse>
    </SidebarGroup>
  );
}
