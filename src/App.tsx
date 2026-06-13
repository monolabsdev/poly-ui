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
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/Sidebar";
import { Box } from "@mui/material";
import { useChatStore } from "@/store/chatStore";
import { useAuthStore } from "@/store/authStore";
import { useNotify } from "@/hooks/useNotify";
import { useShallow } from "zustand/react/shallow";
import { retryTitleForConversation, type TitleStore } from "@/lib/chat/title-generation";
import { useFeatures } from "@/lib/featureRegistry";
import { IS_MAC } from "@/lib/platform";

const titleStore: TitleStore = {
  findConversation: (id) => useChatStore.getState().conversations.find((c) => c.id === id),
  getConversationMessages: (cid) => useChatStore.getState().messages.filter((m) => m.conversationId === cid),
  setTitleGenerationStatus: (id, status) => useChatStore.getState().actions.setTitleGenerationStatus?.(id, status),
  renameConversation: (id, title, source) => useChatStore.getState().actions.renameConversation(id, title, source),
};
import {
  findDefaultModelChoice,
  modelChoiceId,
} from "@/lib/models/model-choice";
import { shouldLoadExternalDefault } from "@/lib/models/model-selector";
import { useFolderStore } from "@/store/folderStore";
import { SettingsModal } from "./components/Settings/SettingsModal";
import type { SettingsTab } from "./components/Settings/SettingsModal";
import { ArchivedChatsDialog } from "@/components/Chat/ArchivedChatsDialog";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { useRegisteredCommandPaletteActions } from "@/features/command-palette/actionRegistry";
import { useSettingsCommands } from "@/features/command-palette/settingsRegistry";
import {
  exportConversation,
  importConversations,
} from "@/features/command-palette/chatDataActions";
import type { CommandPaletteItem } from "@/features/command-palette/types";
import {
  Archive,
  Download,
  FileInput,
  MessageSquare,
  Settings,
  SquarePen,
} from "lucide-react";

const AuthModal = lazy(() =>
  import("@/components/Auth/AuthModal").then((module) => ({
    default: module.AuthModal,
  })),
);
const ReleaseNotesModal = lazy(() =>
  import("@/features/release-notes/ReleaseNotesModal").then((module) => ({
    default: module.ReleaseNotesModal,
  })),
);
const ChatWorkspace = lazy(() => import("@/components/Chat/ChatWorkspace"));

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
      selectedModelChoices: state.selectedModelChoices,
      updateSelectedModel: state.updateSelectedModel,
      addSelectedModel: state.addSelectedModel,
      removeSelectedModel: state.removeSelectedModel,
      setDefaultModel: state.actions.setDefaultModel,
      setSelectedModel: state.setSelectedModel,
      defaultModel: state.defaultModel,
    })),
  );

  const ollama = useOllama();

  const handleOpenSettings = useCallback((tab: SettingsTab = "general") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);
  const handleOpenConnections = useCallback(() => {
    setSettingsInitialTab("connections");
    setIsSettingsOpen(true);
  }, []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleStopStreamingReady = useCallback(
    (stopStreaming: (() => void) | null) => {
      stopStreamingRef.current = stopStreaming;
    },
    [],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        handleOpenSettings("general");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenSettings]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
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
    return general.systemPrompt ? `${preset}\n${general.systemPrompt}` : preset;
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

  const handleSetDefaultModel = useCallback(
    (model: string) => {
      const provider = selectedProviders[0];
      if (!provider) return;
      setDefaultModel(modelChoiceId(provider, model));
      notify.success(`${model} set as default`);
    },
    [selectedProviders, setDefaultModel, notify],
  );

  const isTemporary = Boolean(
    conversations.find((c) => c.id === activeConversationId)?.isTemporary,
  );
  const activeFolderBackground = useFolderStore(
    (state) =>
      state.folders.find((folder) => folder.id === state.activeFolderId)
        ?.backgroundImage,
  );

  const handleToggleTemporaryChat = useCallback(async () => {
    if (isTemporary) {
      setActiveConversationId(null);
      return;
    }

    await createConversation("Temporary Chat", true);
  }, [createConversation, isTemporary, setActiveConversationId]);

  const handleAddModel = useCallback(() => {
    addSelectedModel("OllamaLocal", "");
  }, [addSelectedModel]);

  const features = useFeatures();
  const registeredActions = useRegisteredCommandPaletteActions();
  const settingsCommands = useSettingsCommands({ openSettings: handleOpenSettings });

  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    const sortedConversations = [...conversations].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );

    const conversationItems: CommandPaletteItem[] = sortedConversations.map(
      (conversation, index) => ({
        id: `conversation:${conversation.id}`,
        title: conversation.title || "Untitled",
        description: conversation.isArchived
          ? "Archived conversation"
          : index < 10
            ? "Recent conversation"
            : "Conversation",
        category: "conversation",
        keywords: [
          "chat",
          "conversation",
          conversation.isArchived ? "archived" : "recent",
        ],
        icon: <MessageSquare size={16} />,
        execute: () => handleSelectConversation(conversation.id),
      }),
    );

    const coreActions: CommandPaletteItem[] = [
      {
        id: "action:new-conversation",
        title: "New Conversation",
        description: "Start a blank chat",
        category: "action",
        keywords: ["new", "chat", "compose"],
        icon: <SquarePen size={16} />,
        shortcut: IS_MAC ? "Cmd N" : "Ctrl N",
        execute: handleNewChat,
      },
      {
        id: "action:open-settings",
        title: "Open Settings",
        description: "Open Poly UI settings",
        category: "action",
        keywords: ["settings", "preferences", "sett"],
        icon: <Settings size={16} />,
        shortcut: IS_MAC ? "Cmd ," : "Ctrl ,",
        execute: () => handleOpenSettings("general"),
      },
      {
        id: "action:archived-conversations",
        title: "Archived Conversations",
        description: "View archived chats",
        category: "action",
        keywords: ["archive", "archived", "old chats"],
        icon: <Archive size={16} />,
        execute: () => setIsArchivedOpen(true),
      },
      {
        id: "action:import-chat",
        title: "Import Chat",
        description: "Import a Poly UI chat JSON file",
        category: "action",
        keywords: ["import", "restore", "json"],
        icon: <FileInput size={16} />,
        execute: () => void importConversations(notify),
      },
      {
        id: "action:export-current-chat",
        title: "Export Current Chat",
        description: activeConversation
          ? `Export ${activeConversation.title || "Untitled"}`
          : "No active chat selected",
        category: "action",
        keywords: ["export", "download", "backup", "json"],
        icon: <Download size={16} />,
        execute: () => {
          if (activeConversation) void exportConversation(activeConversation, notify);
        },
      },
    ];

    const featureItems: CommandPaletteItem[] = features.map((feature) => {
      const Icon = feature.icon;
      const active = feature.active;
      const title =
        feature.id === "poly-agent"
          ? "Experimental Agent Mode"
          : feature.name;
      return {
        id: `feature:${feature.id}`,
        title: `${active ? "\u2713" : "\u2715"} ${title}`,
        description: feature.warning
          ? `${feature.description ?? "Feature toggle"} - ${feature.warning}`
          : feature.description,
        category: "feature",
        keywords: [
          feature.id,
          feature.name,
          title,
          feature.experimental ? "experimental" : "",
          "toggle",
          active ? "enabled" : "disabled",
        ],
        icon: <Icon size={16} />,
        execute: feature.toggle,
      };
    });

    return [
      ...conversationItems,
      ...coreActions,
      ...registeredActions,
      ...featureItems,
      ...settingsCommands,
    ];
  }, [
    activeConversationId,
    conversations,
    features,
    handleNewChat,
    handleOpenSettings,
    handleSelectConversation,
    notify,
    registeredActions,
    settingsCommands,
  ]);

  return (
    <SidebarProvider>
      <Sidebar
        onOpenSettings={handleOpenSettings}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
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
            bgcolor: activeFolderBackground
              ? "transparent"
              : "background.default",
          }}
        >
          <Suspense fallback={<Box sx={{ flex: 1 }} />}>
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
          </Suspense>
        </Box>
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
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        items={commandPaletteItems}
      />
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
      <Suspense fallback={null}>
        <ReleaseNotesModal />
      </Suspense>
    </SidebarProvider>
  );
}

export default App;
