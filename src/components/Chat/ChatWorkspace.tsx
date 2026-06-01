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

type ChatWorkspaceProps = {
  selectedModels: string[];
  selectedProviders: ModelProvider[];
  selectedModel: string;
  systemPromptContent: string;
  userName?: string;
  isTemporary: boolean;
  onStopStreamingReady: (stopStreaming: (() => void) | null) => void;
};

export default function ChatWorkspace({
  selectedModels,
  selectedProviders,
  selectedModel,
  systemPromptContent,
  userName,
  isTemporary,
  onStopStreamingReady,
}: ChatWorkspaceProps) {
  const activeFolder = useFolderStore((state) => state.folders.find((folder) => folder.id === state.activeFolderId));
  const effectiveSystemPrompt = activeFolder?.systemPrompt
    ? `${systemPromptContent}\n${activeFolder.systemPrompt}`
    : systemPromptContent;
  const { messages, streamingMessagesList, isStreaming, sendMessage, regenerateMessage, stopStreaming, bottomRef, hasMessages } =
    useChatStream(selectedModels, selectedProviders, effectiveSystemPrompt, userName);

  const { activeConversationId, currentAttachments } = useChatStore(
    useShallow((state) => ({
      activeConversationId: state.activeConversationId,
      currentAttachments: state.currentAttachments,
    })),
  );
  const {
    createConversation,
    deleteMessagesAfter,
    clearCurrentAttachments,
  } = useChatStore((state) => state.actions);

  useEffect(() => {
    onStopStreamingReady(stopStreaming);
    return () => onStopStreamingReady(null);
  }, [onStopStreamingReady, stopStreaming]);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (activeConversationId) return activeConversationId;
    const created = await createConversation("New Chat", false, activeFolder?.id);
    return created.id;
  }, [activeConversationId, activeFolder?.id, createConversation]);

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed && currentAttachments.length === 0) return;
      if (!selectedModel) return;
      await ensureConversation();
      const attachments = await materializeAttachments([
        ...(activeFolder?.contextFiles ?? []),
        ...currentAttachments,
      ]);
      await sendMessage(trimmed, attachments);
      currentAttachments.forEach(releaseImageAttachment);
      clearCurrentAttachments();
    },
    [
      selectedModel,
      activeFolder?.contextFiles,
      currentAttachments,
      ensureConversation,
      sendMessage,
      clearCurrentAttachments,
    ],
  );

  const handleRegenerate = useCallback(
    async (messageIndex: number) => {
      if (isStreaming || !activeConversationId) return;

      const targetMessage = messages[messageIndex];
      if (targetMessage?.role !== "assistant") return;

      await deleteMessagesAfter(activeConversationId, targetMessage.id);
      regenerateMessage(activeConversationId);
    },
    [
      activeConversationId,
      deleteMessagesAfter,
      isStreaming,
      messages,
      regenerateMessage,
    ],
  );

  return (
    <>
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
          <FolderHome folder={activeFolder} onSubmit={handleSend} onStop={stopStreaming} isStreaming={isStreaming} selectedModel={selectedModel} />
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
          >
            <ChatInput
              onSubmit={handleSend}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              selectedModel={selectedModel}
              hasMessages={hasMessages}
              isTemporary={isTemporary}
            />
          </EmptyState>
        )}

        {hasMessages ? (
          <ChatInput
            onSubmit={handleSend}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            selectedModel={selectedModel}
            hasMessages={hasMessages}
            isTemporary={isTemporary}
          />
        ) : null}
      </Box>
    </>
  );
}
