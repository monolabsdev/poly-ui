import {
  Suspense,
  lazy,
  useRef,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import { Header } from "@/components/Chat/Header";
import { useModelStore } from "@/store/modelStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getPresetContent } from "@/constants/promptPresets";
import { useOllama } from "@/services/ollama";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/Layout/Sidebar";
import { Box } from "@mui/material";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { useNotify } from "@/hooks/useNotify";
import { useShallow } from "zustand/react/shallow";
import { retryTitleForConversation } from "@/lib/chat/title-generation";
import { findDefaultModelChoice, modelChoiceId } from "@/lib/models/model-choice";
import { shouldLoadExternalDefault } from "@/lib/models/model-selector";
import { useFolderStore } from "@/store/folderStore";

const AuthModal = lazy(() =>
  import("@/components/Auth/AuthModal").then((module) => ({
    default: module.AuthModal,
  })),
);
const ChatWorkspace = lazy(() => import("@/components/Chat/ChatWorkspace"));
const SettingsModal = lazy(() =>
  import("@/components/Settings/SettingsModal").then((module) => ({
    default: module.SettingsModal,
  })),
);
function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const stopStreamingRef = useRef<(() => void) | null>(null);
  const notify = useNotify();
  const {
    selectedModels,
    selectedProviders,
    updateSelectedModel,
    addSelectedModel,
    removeSelectedModel,
    setDefaultModel,
    setSelectedModel,
    defaultModel,
  } = useModelStore(
    useShallow((state) => ({
      selectedModels: state.selectedModels,
      selectedProviders: state.selectedProviders,
      updateSelectedModel: state.updateSelectedModel,
      addSelectedModel: state.addSelectedModel,
      removeSelectedModel: state.removeSelectedModel,
      setDefaultModel: state.actions.setDefaultModel,
      setSelectedModel: state.setSelectedModel,
      defaultModel: state.defaultModel,
    })),
  );

  const ollama = useOllama();

  const selectedModel = selectedModels[0] ?? "";

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleStopStreamingReady = useCallback((stopStreaming: (() => void) | null) => {
    stopStreamingRef.current = stopStreaming;
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!ollama.online || selectedModels.length > 0) return;

    if (
      shouldLoadExternalDefault(
        defaultModel,
        ollama.externalModelsLoaded,
        ollama.externalModelsLoading,
      )
    ) {
      void ollama.actions.loadExternalModels();
      return;
    }

    const preferredModel =
      findDefaultModelChoice(ollama.models, defaultModel) ?? ollama.models[0];
    if (preferredModel) {
      setSelectedModel(preferredModel.provider_type, preferredModel.name);
    }
  }, [
    defaultModel,
    ollama.actions,
    ollama.externalModelsLoaded,
    ollama.externalModelsLoading,
    ollama.models,
    ollama.online,
    selectedModels.length,
    setSelectedModel,
  ]);

  const { selectedPromptPreset, general } = useSettingsStore(
    useShallow((s) => ({
      selectedPromptPreset: s.selectedPromptPreset,
      general: s.general,
    })),
  );

  const systemPromptContent = useMemo(() => {
    const preset = getPresetContent(selectedPromptPreset);
    return general.systemPrompt
      ? `${preset}\n${general.systemPrompt}`
      : preset;
  }, [selectedPromptPreset, general.systemPrompt]);
  const { conversations, activeConversationId } = useChatStore(
    useShallow((state) => ({
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
    })),
  );
  const user = useAuthStore((state) => state.user);
  const {
    createConversation,
    setActiveConversationId,
    deleteConversation,
    renameConversation,
  } = useChatStore((state) => state.actions);

  const handleNewChat = useCallback(() => {
    useFolderStore.getState().actions.setActiveFolderId(null);
    setActiveConversationId(null);
  }, [setActiveConversationId]);

  const handleSelectConversation = useCallback((id: string) => {
    useFolderStore.getState().actions.setActiveFolderId(null);
    const currentId = useChatStore.getState().activeConversationId;
    if (currentId && currentId !== id) {
      retryTitleForConversation(currentId);
    }

    setActiveConversationId(id);
  }, [setActiveConversationId]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    stopStreamingRef.current?.();
    await deleteConversation(id);
  }, [deleteConversation]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    await renameConversation(id, newTitle);
  }, [renameConversation]);

  const handleSetDefaultModel = useCallback((model: string) => {
    const provider = selectedProviders[0];
    if (!provider) return;
    setDefaultModel(modelChoiceId(provider, model));
    notify.success(`${model} set as default`);
  }, [selectedProviders, setDefaultModel, notify]);

  const isTemporary = Boolean(conversations.find((c) => c.id === activeConversationId)?.isTemporary);
  const activeFolderBackground = useFolderStore((state) =>
    state.folders.find((folder) => folder.id === state.activeFolderId)?.backgroundImage,
  );

  const handleToggleTemporaryChat = useCallback(async () => {
    if (isTemporary) {
      setActiveConversationId(null);
      return;
    }

    await createConversation("Temporary Chat", true);
  }, [createConversation, isTemporary, setActiveConversationId]);

  const handleAddModel = useCallback(() => {
    import("@/services/ollama").then(({ useOllamaStore }) => {
      const first = useOllamaStore.getState().models[0];
      if (first) addSelectedModel(first.provider_type, first.name);
    });
  }, [addSelectedModel]);

  return (
    <SidebarProvider>
      <Sidebar
        onOpenSettings={handleOpenSettings}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        conversations={conversations}
        activeConversationId={activeConversationId}
        collapsible="icon"
      />

      <SidebarInset backgroundImage={activeFolderBackground}>
        <Header
          selectedModels={selectedModels}
          selectedProviders={selectedProviders}
          onModelChange={updateSelectedModel}
          onAddModel={handleAddModel}
          onRemoveModel={removeSelectedModel}
          onSetDefault={handleSetDefaultModel}
          isTemporary={isTemporary}
          onToggleTemporaryChat={handleToggleTemporaryChat}
          transparent={Boolean(activeFolderBackground)}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            position: "relative",
            bgcolor: activeFolderBackground ? "transparent" : "background.default",
            pt: { xs: "64px", sm: "56px" },
          }}
        >
          <Suspense fallback={<Box sx={{ flex: 1 }} />}>
            <ChatWorkspace
              selectedModels={selectedModels}
              selectedProviders={selectedProviders}
              selectedModel={selectedModel}
              systemPromptContent={systemPromptContent}
              userName={user?.fullName || user?.email}
              isTemporary={isTemporary}
              onStopStreamingReady={handleStopStreamingReady}
            />
          </Suspense>
        </Box>
      </SidebarInset>

      {isSettingsOpen ? (
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
    </SidebarProvider>
  );
}

export default App;
