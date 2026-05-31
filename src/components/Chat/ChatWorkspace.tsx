import { useCallback, useEffect } from "react";
import { Box } from "@mui/material";
import { useShallow } from "zustand/react/shallow";
import { ChatArea } from "@/components/Chat/ChatArea";
import { ChatInput } from "@/components/Chat/ChatInput";
import { EmptyState } from "@/components/Chat/EmptyState";
import { useChatStream } from "@/hooks/useChatStream";
import { useChatStore } from "@/store/chatStore";
import type { ModelProvider } from "@/store/modelStore";

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
  const { messages, streamingMessagesList, isStreaming, sendMessage, regenerateMessage, stopStreaming, bottomRef, hasMessages } =
    useChatStream(selectedModels, selectedProviders, systemPromptContent, userName);

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
    const created = await createConversation("New Chat", false);
    return created.id;
  }, [activeConversationId, createConversation]);

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed && currentAttachments.length === 0) return;
      if (!selectedModel) return;
      await ensureConversation();
      sendMessage(trimmed, currentAttachments);
      clearCurrentAttachments();
    },
    [
      selectedModel,
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
        {hasMessages ? (
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
