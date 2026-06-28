import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFolderStore } from "@/store/folderStore";
import { Conversation } from "@/types/chat";
import { FolderTree } from "@/features/sidebar/components/FolderTree";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from "@/components/ui/sidebar";
import {
  SidebarSectionHeader,
  sidebarIconButtonClassName,
} from "@/features/sidebar/components/sidebar-utils";

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
    <SidebarGroup className="mb-2">
      <div className="mb-0.5 px-3">
        <SidebarSectionHeader
          label="Folders"
          disclosure={{
            expanded: !isCollapsed,
            onToggle: () => setIsCollapsed(!isCollapsed),
            controlsId: FOLDERS_SECTION_CONTENT_ID,
          }}
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Create folder"
              onClick={folder.openCreateModal}
              className={sidebarIconButtonClassName}
            >
              <Plus />
            </Button>
          }
        />
      </div>
      <div
        id={FOLDERS_SECTION_CONTENT_ID}
        className={`overflow-hidden ${isCollapsed ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100"} ${
          reducedMotion ? "" : "transition-[max-height,opacity] duration-[var(--dur-base)] ease-[var(--ease-premium)]"
        }`}
      >
        <SidebarGroupContent>
          <SidebarMenu>
            {empty ? (
              <div className="px-2 py-2 text-muted-foreground/70">
                <p className="text-xs leading-[1.4]">
                  No folders
                </p>
              </div>
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
      </div>
    </SidebarGroup>
  );
}
