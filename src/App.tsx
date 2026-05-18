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
import "./App.css";

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
    updateSelectedModel,
    addSelectedModel,
    removeSelectedModel,
    setDefaultModel,
    setSelectedModel,
    defaultModel,
  } = useModelStore(
    useShallow((state) => ({
      selectedModels: state.selectedModels,
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
    if (ollama.online && ollama.models.length > 0 && selectedModels.length === 0) {
      const modelNames = ollama.models.map((m) => m.name);
      const preferredModel =
        defaultModel && modelNames.includes(defaultModel)
          ? defaultModel
          : modelNames[0];
      setSelectedModel("ollama", preferredModel);
    }
  }, [ollama.online, ollama.models, selectedModels.length, defaultModel, setSelectedModel]);

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

  const handleNewChat = useCallback((isTemporary = false) => {
    stopStreamingRef.current?.();

    if (isTemporary) {
      void createConversation("Temporary Chat", true);
      return;
    }

    setActiveConversationId(null);
  }, [createConversation, setActiveConversationId]);

  const handleSelectConversation = useCallback((id: string) => {
    const currentId = useChatStore.getState().activeConversationId;
    if (currentId && currentId !== id) {
      retryTitleForConversation(currentId);
    }

    stopStreamingRef.current?.();
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
    setDefaultModel(model);
    notify.success(`${model} set as default`);
  }, [setDefaultModel, notify]);

  const isTemporary = Boolean(conversations.find((c) => c.id === activeConversationId)?.isTemporary);

  const handleToggleTemporaryChat = useCallback(async () => {
    stopStreamingRef.current?.();

    if (isTemporary) {
      setActiveConversationId(null);
      return;
    }

    await createConversation("Temporary Chat", true);
  }, [createConversation, isTemporary, setActiveConversationId]);

  const handleAddModel = useCallback(() => {
    import("@/services/ollama").then(({ useOllamaStore }) => {
      addSelectedModel("ollama", useOllamaStore.getState().models[0]?.name || "");
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

      <SidebarInset>
        <Header
          selectedModels={selectedModels}
          onModelChange={updateSelectedModel}
          onAddModel={handleAddModel}
          onRemoveModel={removeSelectedModel}
          onSetDefault={handleSetDefaultModel}
          isTemporary={isTemporary}
          onToggleTemporaryChat={handleToggleTemporaryChat}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            position: "relative",
            bgcolor: "background.default",
            pt: "56px",
          }}
        >
          <Suspense fallback={<Box sx={{ flex: 1 }} />}>
            <ChatWorkspace
              selectedModels={selectedModels}
              selectedModel={selectedModel}
              systemPromptContent={systemPromptContent}
              userName={user?.fullName || user?.email}
              isTemporary={isTemporary}
              onStopStreamingReady={handleStopStreamingReady}
            />
          </Suspense>
        </Box>
      </SidebarInset>

      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
    </SidebarProvider>
  );
}

export default App;
