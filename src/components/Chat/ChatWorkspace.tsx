import { useCallback, useDeferredValue, useEffect } from "react";
import { Box } from "@mui/material";
import { useShallow } from "zustand/react/shallow";
import { ChatArea } from "@/components/Chat/ChatArea";
import { ChatInput } from "@/components/Chat/ChatInput";
import { EmptyState } from "@/components/Chat/EmptyState";
import { useChatStream } from "@/hooks/useChatStream";
import { useChatStore } from "@/store/chatStore";
import type { ChatMessage } from "@/types/chat";

type ChatWorkspaceProps = {
  selectedModels: string[];
  selectedModel: string;
  systemPromptContent: string;
  userName?: string;
  isTemporary: boolean;
  onStopStreamingReady: (stopStreaming: (() => void) | null) => void;
};

function measureAsyncInteraction<T>(
  _name: string,
  _metadata: Record<string, unknown> | undefined,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(fn());
}

export default function ChatWorkspace({
  selectedModels,
  selectedModel,
  systemPromptContent,
  userName,
  isTemporary,
  onStopStreamingReady,
}: ChatWorkspaceProps) {
  const { messages, isStreaming, sendMessage, stopStreaming, bottomRef, hasMessages } =
    useChatStream(selectedModels, systemPromptContent);
  const deferredMessages = useDeferredValue(messages);

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
      await measureAsyncInteraction(
        "app.handleRegenerate",
        { messageIndex },
        async () => {
          if (isStreaming || !activeConversationId) return;

          const targetMessage = messages[messageIndex];
          if (targetMessage?.role !== "assistant") return;

          let previousUserMessage: ChatMessage | null = null;
          for (let i = messageIndex - 1; i >= 0; i--) {
            if (messages[i]?.role === "user") {
              previousUserMessage = messages[i];
              break;
            }
          }

          if (!previousUserMessage) return;

          await deleteMessagesAfter(activeConversationId, targetMessage.id);
          sendMessage(previousUserMessage.content);
        },
      );
    },
    [
      activeConversationId,
      deleteMessagesAfter,
      isStreaming,
      messages,
      sendMessage,
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
            messages={deferredMessages}
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

        {hasMessages && (
          <ChatInput
            onSubmit={handleSend}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            selectedModel={selectedModel}
            hasMessages={hasMessages}
            isTemporary={isTemporary}
          />
        )}
      </Box>
    </>
  );
}
