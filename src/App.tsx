import {
  lazy,
  Suspense,
  useRef,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import { useModelStore } from "@/store/modelStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getPresetContent } from "@/lib/constants/promptPresets";
import { useOllama } from "@/features/ollama";
import { Sidebar, SidebarInset, SidebarProvider } from "@/features/sidebar";
import { ChatPanel } from "@/components/Layout/ChatPanel";
import { Box } from "@mui/material";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { useNotify } from "@/hooks/useNotify";
import { useShallow } from "zustand/react/shallow";
import {
  retryTitleForConversation,
  titleStore,
} from "@/lib/chat/title-generation";
import { useFeatures } from "@/lib/featureRegistry";
import { disableMemoryForOwner } from "@/features/memory/memoryClient";
import { getCurrentProviderAccountId } from "@/features/providers";
import { useFolderStore } from "@/store/folderStore";
import { SettingsModal } from "./features/settings/SettingsModal";
import type { SettingsTab } from "./features/settings/SettingsModal";
import { ArchivedChatsDialog } from "@/features/chat/components/ArchivedChatsDialog";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { useRegisteredCommandPaletteActions } from "@/features/command-palette/actionRegistry";
import { useSettingsCommands } from "@/features/command-palette/settingsRegistry";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAutoSelectModel } from "@/hooks/useAutoSelectModel";
import { useChatActionHandlers } from "@/hooks/useChatActionHandlers";
import { useCommandPaletteItems } from "@/hooks/useCommandPaletteItems";
import ChatWorkspace from "@/features/chat/components/ChatWorkspace";
import "@/features/models";
import { GlobalConfirmDialog } from "./components/ui/GlobalConfirmDialog";

const AuthModalLazy = lazy(() =>
  import("@/features/auth/AuthModal").then((module) => ({
    default: module.AuthModal,
  })),
);
const ReleaseNotesModalLazy = lazy(() =>
  import("@/features/release-notes/ReleaseNotesModal").then((module) => ({
    default: module.ReleaseNotesModal,
  })),
);
function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<SettingsTab>("general");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const stopStreamingRef = useRef<(() => void) | null>(null);
  const notify = useNotify();
  const {
    selectedModels,
    selectedProviders,
    selectedModelChoices,
    setSelectedModel,
    defaultModel,
  } = useModelStore(
    useShallow((state) => ({
      selectedModels: state.selectedModels,
      selectedProviders: state.selectedProviders,
      selectedModelChoices: state.selectedModelChoices,
      setSelectedModel: state.setSelectedModel,
      defaultModel: state.defaultModel,
    })),
  );

  const ollama = useOllama();
  const { user, isAuthenticated, isAuthLoading, isGuest } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      isAuthLoading: state.isLoading,
      isGuest: state.isGuest,
    })),
  );
  const isAuthGateOpen = !isAuthenticated && !isAuthLoading && !isGuest;

  const handleOpenSettings = useCallback((tab: SettingsTab = "general") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);
  const handleOpenConnections = useCallback(() => {
    setSettingsInitialTab("connections");
    setIsSettingsOpen(true);
  }, []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleOpenCommandPalette = useCallback(() => {
    if (isAuthGateOpen) return;
    setIsCommandPaletteOpen(true);
  }, [isAuthGateOpen]);
  const handleStopStreamingReady = useCallback(
    (stopStreaming: (() => void) | null) => {
      stopStreamingRef.current = stopStreaming;
    },
    [],
  );

  useKeyboardShortcuts({
    onOpenSettings: handleOpenSettings,
    isAuthGateOpen,
    setIsCommandPaletteOpen,
  });

  useEffect(() => {
    if (isAuthGateOpen) setIsCommandPaletteOpen(false);
  }, [isAuthGateOpen]);

  useAutoSelectModel({
    online: ollama.online,
    models: ollama.models,
    externalModelsLoaded: ollama.externalModelsLoaded,
    externalModelsLoading: ollama.externalModelsLoading,
    loadExternalModels: ollama.actions.loadExternalModels,
    selectedModelsLength: selectedModels.length,
    defaultModel,
    setSelectedModel,
  });

  const { selectedPromptPreset, general } = useSettingsStore(
    useShallow((s) => ({
      selectedPromptPreset: s.selectedPromptPreset,
      general: s.general,
    })),
  );

  const systemPromptContent = useMemo(() => {
    const preset = getPresetContent(selectedPromptPreset);
    return general.systemPrompt ? `${preset}\n${general.systemPrompt}` : preset;
  }, [selectedPromptPreset, general.systemPrompt]);

  useEffect(() => {
    if (general.experimentalFeatures) return;
    void disableMemoryForOwner(getCurrentProviderAccountId()).catch(
      () => undefined,
    );
  }, [general.experimentalFeatures]);

  const { conversations, activeConversationId } = useChatStore(
    useShallow((state) => ({
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
    })),
  );
  const {
    setActiveConversationId,
    deleteConversation,
    deleteAllConversations,
    renameConversation,
  } = useChatStore((state) => state.actions);

  const handleNewChat = useCallback(() => {
    useFolderStore.getState().actions.setActiveFolderId(null);
    setActiveConversationId(null);
  }, [setActiveConversationId]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      useFolderStore.getState().actions.setActiveFolderId(null);
      const currentId = useChatStore.getState().activeConversationId;
      if (currentId && currentId !== id) {
        retryTitleForConversation(titleStore, currentId);
      }
      setActiveConversationId(id);
    },
    [setActiveConversationId],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      stopStreamingRef.current?.();
      await deleteConversation(id);
    },
    [deleteConversation],
  );

  const handleRenameConversation = useCallback(
    async (id: string, newTitle: string) => {
      await renameConversation(id, newTitle, "manual");
    },
    [renameConversation],
  );

  const isTemporary = Boolean(
    conversations.find((c) => c.id === activeConversationId)?.isTemporary,
  );
  const activeFolderBackground = useFolderStore(
    (state) =>
      state.folders.find((folder) => folder.id === state.activeFolderId)
        ?.backgroundImage,
  );

  const {
    handleDeleteAllConversations,
    handleRenameCurrentChat,
    handleSetTheme,
  } = useChatActionHandlers({
    stopStreamingRef,
    notify,
    renameConversation,
    deleteAllConversations,
    activeConversationId,
  });

  const features = useFeatures();
  const registeredActions = useRegisteredCommandPaletteActions();
  const settingsCommands = useSettingsCommands({
    openSettings: handleOpenSettings,
  });

  const handleOpenArchived = useCallback(() => setIsArchivedOpen(true), []);

  const commandPaletteItems = useCommandPaletteItems({
    conversations,
    activeConversationId,
    features,
    onNewChat: handleNewChat,
    onDeleteAllConversations: handleDeleteAllConversations,
    onOpenSettings: handleOpenSettings as (tab?: string) => void,
    onRenameCurrentChat: handleRenameCurrentChat,
    onSetTheme: handleSetTheme,
    onSelectConversation: handleSelectConversation,
    onOpenArchived: handleOpenArchived,
    notify,
    registeredActions,
    settingsCommands,
  });

  return (
    <SidebarProvider>
      <Sidebar
        onOpenSettings={handleOpenSettings}
        onOpenCommandPalette={handleOpenCommandPalette}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        conversations={conversations}
        activeConversationId={activeConversationId}
        collapsible="icon"
      />

      <SidebarInset>
        <ChatPanel backgroundImage={activeFolderBackground}>
          <Box
            component="main"
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "row",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <ChatWorkspace
              selectedModels={selectedModels}
              selectedProviders={selectedProviders}
              selectedModelChoices={selectedModelChoices}
              systemPromptContent={systemPromptContent}
              userName={user?.fullName || user?.email}
              isTemporary={isTemporary}
              onStopStreamingReady={handleStopStreamingReady}
              onOpenConnections={handleOpenConnections}
            />
          </Box>
        </ChatPanel>
      </SidebarInset>

      {isSettingsOpen ? (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          initialTab={settingsInitialTab}
        />
      ) : null}
      <ArchivedChatsDialog
        open={isArchivedOpen}
        onOpenChange={setIsArchivedOpen}
      />
      <CommandPalette
        open={!isAuthGateOpen && isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        items={commandPaletteItems}
      />
      <GlobalConfirmDialog />
      <Suspense fallback={null}>
        <AuthModalLazy />
      </Suspense>
      <Suspense fallback={null}>
        <ReleaseNotesModalLazy />
      </Suspense>
    </SidebarProvider>
  );
}

export default App;
