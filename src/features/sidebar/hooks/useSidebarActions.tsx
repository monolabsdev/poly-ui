import * as React from "react";
import { useConversationActions, type UseConversationActions } from "./useConversationActions";
import { useFolderActions, type UseFolderActions } from "./useFolderActions";
import { Conversation } from "@/types/chat";

interface SidebarActionsArgs {
  conversations: Conversation[];
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onSelectConversation: (id: string) => void;
}

export interface SidebarActions {
  conv: UseConversationActions;
  folder: UseFolderActions;
  onSelectConversation: (id: string) => void;
}

const SidebarActionsContext = React.createContext<SidebarActions | null>(null);

export function SidebarActionsProvider({
  conversations,
  onDeleteConversation,
  onRenameConversation,
  onSelectConversation,
  children,
}: SidebarActionsArgs & { children: React.ReactNode }) {
  const conv = useConversationActions({
    onDeleteConversation,
    onRenameConversation,
  });
  const folder = useFolderActions(conversations);
  const value = React.useMemo(
    () => ({ conv, folder, onSelectConversation }),
    [conv, folder, onSelectConversation],
  );
  return (
    <SidebarActionsContext.Provider value={value}>
      {children}
    </SidebarActionsContext.Provider>
  );
}

export function useSidebarActions(): SidebarActions {
  const ctx = React.useContext(SidebarActionsContext);
  if (!ctx) {
    throw new Error("useSidebarActions must be used within SidebarActionsProvider");
  }
  return ctx;
}
