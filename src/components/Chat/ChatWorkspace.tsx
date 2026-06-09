import { useCallback, useEffect } from "react";
import { Box } from "@mui/material";
import { useShallow } from "zustand/react/shallow";
import { ChatArea } from "@/components/Chat/ChatArea";
import { ChatInput } from "@/components/Chat/ChatInput";
import { EmptyState } from "@/components/Chat/EmptyState";
import { useChatStream } from "@/hooks/useChatStream";
import { useChatStore } from "@/store/chatStore";
import type { ModelProvider } from "@/store/modelStore";
import { materializeAttachments, releaseImageAttachment } from "@/lib/image-upload/attachments";
import { useFolderStore } from "@/store/folderStore";
import { FolderHome } from "@/components/Folders/FolderHome";
import { useOllama } from "@/services/ollama";
import { useAgentRun } from "@/features/agent/useAgentRun";
import { DRAFT_WORKSPACE_SELECTION_CHAT_ID, defaultWorkspaceSelection, useAgentStore } from "@/features/agent/agentStore";
import { useSettingsStore } from "@/store/settingsStore";
import { buildAgentResolvedContext } from "@/features/agent/context";

type ChatWorkspaceProps = {
  selectedModels: string[];
  selectedProviders: ModelProvider[];
  systemPromptContent: string;
  userName?: string;
  isTemporary: boolean;
  onStopStreamingReady: (stopStreaming: (() => void) | null) => void;
  onOpenConnections: () => void;
};

export default function ChatWorkspace({
  selectedModels,
  selectedProviders,
  systemPromptContent,
  userName,
  isTemporary,
  onStopStreamingReady,
  onOpenConnections,
}: ChatWorkspaceProps) {
  const ollama = useOllama();
  const activeFolder = useFolderStore((state) => state.folders.find((folder) => folder.id === state.activeFolderId));
  const effectiveSystemPrompt = activeFolder?.systemPrompt
    ? `${systemPromptContent}\n${activeFolder.systemPrompt}`
    : systemPromptContent;
  const { messages, streamingMessagesList, isStreaming, sendMessage, regenerateMessage, stopStreaming, bottomRef, hasMessages } =
    useChatStream(selectedModels, selectedProviders, effectiveSystemPrompt);
  const experimentalFeatures = useSettingsStore((state) => state.general.experimentalFeatures);
  const agentEnabled = useAgentStore((state) => state.enabled) && experimentalFeatures;
  const workspaces = useAgentStore((state) => state.workspaces);
  const workspaceSelections = useAgentStore((state) => state.workspaceSelections);
  const setWorkspaceSelection = useAgentStore((state) => state.actions.setSelectedWorkspaceSelection);
  const permissionPreset = useAgentStore((state) => state.permissionPreset);
  const { startAgentRun, cancelAgentRun, agentStatus } = useAgentRun({
    selectedModels,
    selectedProviders,
  });
  const isAgentStreaming = ["running", "waiting_for_approval", "cancelling"].includes(agentStatus);
  const effectiveStreaming = isStreaming || isAgentStreaming;

  const { activeConversationId, currentAttachments, storeMessages } = useChatStore(
    useShallow((state) => ({
      activeConversationId: state.activeConversationId,
      currentAttachments: state.currentAttachments,
      storeMessages: state.messages,
    })),
  );
  const {
    createConversation,
    deleteMessagesAfter,
    clearCurrentAttachments,
    addMessage,
  } = useChatStore((state) => state.actions);

  useEffect(() => {
    onStopStreamingReady(agentEnabled ? cancelAgentRun : stopStreaming);
    return () => onStopStreamingReady(null);
  }, [agentEnabled, cancelAgentRun, onStopStreamingReady, stopStreaming]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (activeConversationId) return activeConversationId;
    const created = await createConversation("New Chat", false, activeFolder?.id);
    return created.id;
  }, [activeConversationId, activeFolder?.id, createConversation]);

  type SubmitMode = "chat" | "agent" | "agent_requires_workspace";

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed && currentAttachments.length === 0) return;
      const conversationId = await ensureConversation();

      const submitMode: SubmitMode = (() => {
        if (!agentEnabled) return "chat";
        const ws =
          workspaceSelections[conversationId] ??
          workspaceSelections[DRAFT_WORKSPACE_SELECTION_CHAT_ID] ??
          defaultWorkspaceSelection(workspaces);
        if (!ws) return "agent_requires_workspace";
        return "agent";
      })();

      if (submitMode === "agent_requires_workspace") {
        if (!trimmed) return;
        await addMessage({ conversationId, role: "user", content: trimmed });
        await addMessage({
          conversationId,
          role: "assistant",
          content: "Poly Agent needs a workspace. Select a project or use a chat sandbox.",
          model: "Poly Agent",
          status: "error",
        });
        return;
      }

      if (submitMode === "agent") {
        if (!trimmed) return;
        const ws =
          workspaceSelections[conversationId] ??
          workspaceSelections[DRAFT_WORKSPACE_SELECTION_CHAT_ID] ??
          defaultWorkspaceSelection(workspaces)!;
        if (!workspaceSelections[conversationId]) {
          setWorkspaceSelection(
            conversationId,
            ws.type === "sandbox"
              ? { type: "sandbox", chatId: conversationId }
              : ws,
          );
        }
        const runSelection =
          ws.type === "sandbox"
            ? { type: "sandbox" as const, chatId: conversationId }
            : ws;
        const workspacePath =
          runSelection.type === "project" ? runSelection.path : undefined;
        const resolvedContext = buildAgentResolvedContext({
          messages: storeMessages,
          prompt: trimmed,
          workspacePath: workspacePath ?? `sandbox:${conversationId}`,
        });
        await addMessage({ conversationId, role: "user", content: trimmed });
        await startAgentRun({
          conversationId,
          prompt: trimmed,
          workspacePath,
          workspaceSelection: runSelection,
          permissionPreset,
          resolvedContext,
        });
        return;
      }

      const attachments = await materializeAttachments([
        ...(activeFolder?.contextFiles ?? []),
        ...currentAttachments,
      ]);
      await sendMessage(trimmed, attachments);
      currentAttachments.forEach(releaseImageAttachment);
      clearCurrentAttachments();
    },
    [
      activeFolder?.contextFiles,
      currentAttachments,
      ensureConversation,
      agentEnabled,
      workspaceSelections,
      workspaces,
      setWorkspaceSelection,
      permissionPreset,
      storeMessages,
      addMessage,
      startAgentRun,
      sendMessage,
      clearCurrentAttachments,
    ],
  );

  const handleRegenerate = useCallback(
    async (messageIndex: number) => {
      if (effectiveStreaming || !activeConversationId) return;

      const targetMessage = messages[messageIndex];
      if (targetMessage?.role !== "assistant") return;

      await deleteMessagesAfter(activeConversationId, targetMessage.id);
      regenerateMessage(activeConversationId);
    },
    [
      activeConversationId,
      deleteMessagesAfter,
      effectiveStreaming,
      messages,
      regenerateMessage,
    ],
  );

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        justifyContent: "flex-start",
        width: "100%",
      }}
    >
      {activeFolder && !activeConversationId ? (
        <FolderHome
          folder={activeFolder}
          onSubmit={handleSend}
          onStop={agentEnabled ? cancelAgentRun : stopStreaming}
          isStreaming={effectiveStreaming}
          providerOnline={ollama.online}
          onOpenConnections={onOpenConnections}
        />
      ) : hasMessages ? (
        <ChatArea
          key={activeConversationId ?? "no-conv"}
          messages={messages}
          streamingMessagesList={streamingMessagesList}
          bottomRef={bottomRef}
          onRegenerate={handleRegenerate}
          isTemporary={isTemporary}
        />
      ) : (
        <EmptyState
          selectedModels={selectedModels}
          userName={userName}
          isTemporary={isTemporary}
          providerOnline={ollama.online}
          onOpenConnections={onOpenConnections}
        >
          <ChatInput
            onSubmit={handleSend}
            onStop={agentEnabled ? cancelAgentRun : stopStreaming}
            isStreaming={effectiveStreaming}
            isTemporary={isTemporary}
            conversationId={activeConversationId}
          />
        </EmptyState>
      )}

      {hasMessages ? (
        <ChatInput
          onSubmit={handleSend}
          onStop={agentEnabled ? cancelAgentRun : stopStreaming}
          isStreaming={effectiveStreaming}
          isTemporary={isTemporary}
          conversationId={activeConversationId}
        />
      ) : null}
    </Box>
  );
}
