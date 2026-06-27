import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useShallow } from "zustand/react/shallow";
import type { ChatMessage, Attachment, Message } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { sanitizeOutput } from "@/lib/chat/sanitize";
import { loggedInvoke } from "@/lib/utils/utils";
import { useNotify } from "@/hooks/useNotify";
import { useOllamaStore } from "@/features/ollama/monitor";
import { buildSystemPrompt } from "@/lib/chat/prompts";
import { isFeatureAIActive } from "@/lib/featureRegistry";
import { defaultPreprocessor } from "@/lib/chat/message-preprocessor";
import { triggerTitleGeneration, type TitleStore } from "@/lib/chat/title-generation";

const titleStore: TitleStore = {
  findConversation: (id) => useChatStore.getState().conversations.find((c) => c.id === id),
  getConversationMessages: (cid) => useChatStore.getState().messages.filter((m) => m.conversationId === cid),
  setTitleGenerationStatus: (id, status) => useChatStore.getState().actions.setTitleGenerationStatus?.(id, status),
  renameConversation: (id, title, source) => useChatStore.getState().actions.renameConversation(id, title, source),
};
import {
  streamEventBus,
  type ChunkPayload,
  type ThinkingPayload,
  type WebSearchPayload,
} from "@/lib/chat/event-bus";
import { StreamSession } from "@/lib/chat/stream-session";
import { getWebSearchConfig } from "@/features/web-search/useWebSearchConfig";
import { getCurrentProviderAccountId } from "@/features/providers";
import { useSettingsStore } from "@/store/settingsStore";
import type { ModelChoice } from "@/lib/models/model-choice";

function validModelChoices(choices: ModelChoice[]): ModelChoice[] {
  return choices.filter((item) => Boolean(item.model && item.provider));
}

async function enqueueMemoryProcessing(conversationId: string, assistantMessageId: string) {
  if (!useSettingsStore.getState().general.experimentalFeatures) return;
  const ownerId = getCurrentProviderAccountId();
  if (!ownerId) return;

  const userMessage = [...useChatStore.getState().messages]
    .reverse()
    .find((message) => message.conversationId === conversationId && message.role === "user");
  if (!userMessage) return;

  try {
    await invoke("memory_enqueue_completed_turn", {
      input: {
        ownerId,
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId,
      },
    });
  } catch (error) {
    console.warn("[Memory] Completed turn enqueue skipped", error);
  }
}

export function useChatStream(modelChoices: ModelChoice[], systemPrompt = "") {
  const { messages, streamingMessages, activeConversationId } = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      streamingMessages: s.streamingMessages,
      activeConversationId: s.activeConversationId,
    }))
  );

  const addMessage = useChatStore((s) => s.actions.addMessage);
  const setStreamingConversationId = useChatStore((s) => s.actions.setStreamingConversationId);
  const setStreamingMessage = useChatStore((s) => s.actions.setStreamingMessage);
  const patchStreamingMessage = useChatStore((s) => s.actions.patchStreamingMessage);
  const clearQueue = useChatStore((s) => s.actions.clearQueue);
  const notify = useNotify();

  const [isStreaming, setIsStreaming] = useState(false);

  const sessionRef = useRef(new StreamSession());
  const cancelRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const processingQueueRef = useRef(false);
  const modelChoicesRef = useRef(modelChoices);
  useEffect(() => { modelChoicesRef.current = modelChoices; }, [modelChoices]);

  const handleChunkRef = useRef<(p: ChunkPayload) => void>(() => {});
  const handleThinkingRef = useRef<(p: ThinkingPayload) => void>(() => {});
  const handleWebSearchRef = useRef<(p: WebSearchPayload) => void>(() => {});

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const streamingMessagesList = useMemo<ChatMessage[]>(
    () => Object.values(streamingMessages).filter((m) => m.conversationId === activeConversationId),
    [activeConversationId, streamingMessages],
  );

  // Wire accumulator flush → store
  useEffect(() => {
    const session = sessionRef.current;
    session.onFlush((updates) => {
      const storeUpdates: Record<string, Partial<Message>> = {};
      for (const [messageId, content] of Object.entries(updates)) {
        if (content) {
          storeUpdates[messageId] = { content, status: "streaming" };
        }
      }
      if (Object.keys(storeUpdates).length > 0) {
        useChatStore.getState().actions.patchStreamingMessages(storeUpdates);
      }
    });
  }, []);

  const resetStreamState = useCallback(() => {
    const { streamingMessages: current } = useChatStore.getState();
    sessionRef.current.allMessageIds().forEach((mid) => {
      if (current[mid]) setStreamingMessage(mid, null);
    });
    sessionRef.current.reset();
  }, [setStreamingMessage]);

  const settlePending = useCallback((requestId?: string) => {
    if (requestId) sessionRef.current.finish(requestId);
    if (sessionRef.current.isComplete()) {
      setIsStreaming(false);
      setStreamingConversationId(null);
    }
  }, [setStreamingConversationId]);

  const handleChunk = useCallback(
    async (payload: ChunkPayload) => {
      if (cancelRef.current) return;
      const completed = sessionRef.current.applyChunk(payload);
      if (!completed) return;

      const { streamingMessages: current } = useChatStore.getState();
      const existing = current[completed.messageId];
      if (!existing) return;

      const completedModel = existing.model ?? "";
      const completedProvider = existing.provider ?? "OllamaLocal";
      const finalizedWebSearch =
        existing.webSearch && existing.webSearch.status === "searching"
          ? { ...existing.webSearch, status: "complete" as const }
          : existing.webSearch;

      if (completed.error) {
        await addMessage({
          id: completed.messageId,
          conversationId: completed.conversationId,
          role: "assistant",
          content: sanitizeOutput(completed.content || ""),
          thinking: completed.thinking,
          model: completedModel || "unknown",
          provider: completedProvider,
          status: "error",
          errorMessage: completed.error,
          webSearch: finalizedWebSearch,
        });
      } else {
        await addMessage({
          id: completed.messageId,
          conversationId: completed.conversationId,
          role: "assistant",
          content: sanitizeOutput(completed.content || ""),
          thinking: completed.thinking,
          thinkingDuration: sessionRef.current.thinkingDuration(completed.requestId),
          isThinking: false,
          createdAt: new Date().toISOString(),
          model: completedModel || "unknown",
          provider: completedProvider,
          status: "complete",
          webSearch: finalizedWebSearch,
        });
        void enqueueMemoryProcessing(completed.conversationId, completed.messageId);
      }

      setStreamingMessage(completed.messageId, null);
      settlePending(completed.requestId);

      if (sessionRef.current.isComplete()) {
        if (completedModel && !completed.error) triggerTitleGeneration(titleStore, completed.conversationId);
        processNextInQueueRef.current?.(completed.conversationId);
      }
    },
    [addMessage, settlePending, setStreamingMessage],
  );

  const handleThinking = useCallback(
    (payload: ThinkingPayload) => {
      if (cancelRef.current) return;
      const update = sessionRef.current.applyThinking(payload);
      if (!update) return;
      patchStreamingMessage(update.messageId, update.patch);
    },
    [patchStreamingMessage],
  );

  const handleWebSearch = useCallback(
    (payload: WebSearchPayload) => {
      if (cancelRef.current) return;
      const messageId = sessionRef.current.messageIdForRequest(payload.request_id);
      if (!messageId) return;
      const existing = useChatStore.getState().streamingMessages[messageId];
      const update = sessionRef.current.applyWebSearch(payload, existing);
      if (!update) return;

      patchStreamingMessage(update.messageId, {
        webSearch: update.webSearch,
        status: "streaming",
      });
    },
    [patchStreamingMessage],
  );

  useEffect(() => {
    handleChunkRef.current = handleChunk;
    handleThinkingRef.current = handleThinking;
    handleWebSearchRef.current = handleWebSearch;
  });

  useEffect(() => {
    streamEventBus.subscribe({
      onChunk: (p) => handleChunkRef.current(p),
      onThinking: (p) => handleThinkingRef.current(p),
      onWebSearch: (p) => handleWebSearchRef.current(p),
    });
    return () => {
      streamEventBus.unsubscribe();
    };
  }, []);

  const startStream = useCallback(
    (conversationId: string, models: ModelChoice[]) => {
      if (!conversationId || !models.length) return;

      const history = useChatStore.getState().messages
        .filter((m) => m.conversationId === conversationId)
        .map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments ?? [],
        }));

      setIsStreaming(true);
      setStreamingConversationId(conversationId);
      resetStreamState();
      sessionRef.current.start(models.length);

      const webSearchConfig = getWebSearchConfig();
      const webSearchAI = isFeatureAIActive("web_search");
      const reasoningAI = isFeatureAIActive("reasoning");
      const activeWebSearchConfig = webSearchAI ? webSearchConfig : undefined;
      const system = buildSystemPrompt(systemPrompt, Boolean(activeWebSearchConfig), webSearchAI);

      for (const { model, provider, providerConfigId } of models) {
        const rid = crypto.randomUUID();
        const mid = crypto.randomUUID();
        sessionRef.current.register({ requestId: rid, messageId: mid, conversationId });

        setStreamingMessage(mid, {
          id: mid,
          conversationId,
          role: "assistant",
          content: "",
          model,
          provider,
          createdAt: new Date().toISOString(),
          status: "streaming",
          isStreaming: true,
        });

        (async () => {
          try {
            await invoke("chat_stream", {
              requestId: rid,
              conversationId,
              model,
              messages: history,
              systemPrompt: system,
              webSearchConfig: activeWebSearchConfig ?? null,
              reasoningEnabled: reasoningAI,
              providerType: provider,
              providerConfigId: providerConfigId ?? null,
              accountId: getCurrentProviderAccountId(),
            });
          } catch (err) {
            const errMsg = typeof err === "string" ? err : (err as Error).message || "Unknown error";
            if (useChatStore.getState().streamingMessages[mid]) {
              await addMessage({
                id: mid,
                conversationId,
                role: "assistant",
                content: "",
                model,
                provider,
                status: "error",
                errorMessage: errMsg,
              });
              setStreamingMessage(mid, null);
            }
            settlePending(rid);
            notify.error(`Chat error (${model})`, errMsg);
            if (sessionRef.current.isComplete()) {
              processNextInQueueRef.current?.(conversationId);
            }
          }
        })();
      }
    },
    [systemPrompt, resetStreamState, settlePending, setStreamingMessage, addMessage, notify],
  );

  const processNextInQueue = useCallback(async (completedConversationId?: string) => {
    if (processingQueueRef.current) return;
    const conversationId = completedConversationId ?? activeConversationIdRef.current;
    if (!conversationId) return;

    const next = useChatStore.getState().actions.getNextQueued(conversationId);
    if (!next) return;

    processingQueueRef.current = true;
    try {
      const models = validModelChoices(modelChoicesRef.current);
      if (!models.length) return;

      useChatStore.getState().actions.dequeueMessage(next.id);
      cancelRef.current = false;
      await addMessage({
        conversationId: next.conversationId,
        role: "user",
        content: next.content,
        attachments: next.attachments,
      });

      startStream(next.conversationId, models);
    } catch (err) {
      console.error("processNextInQueue failed — message may be lost", err);
    } finally {
      processingQueueRef.current = false;
    }
  }, [addMessage, startStream]);

  const processNextInQueueRef = useRef<(conversationId?: string) => Promise<void>>(processNextInQueue);
  useEffect(() => { processNextInQueueRef.current = processNextInQueue; });

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      const models = validModelChoices(modelChoices);
      if ((!content.trim() && !attachments?.length) || !models.length) return;

      const { state } = useOllamaStore.getState();
      if (state !== "online") {
        notify.warn("Cannot send message", "No LLM provider is currently online");
        return;
      }

      const conversationId = useChatStore.getState().activeConversationId ?? activeConversationId;
      if (!conversationId) return;

      const processed = defaultPreprocessor.preprocess(content.trim());

      if (isStreaming) {
        useChatStore.getState().actions.enqueueMessage({
          id: crypto.randomUUID(),
          conversationId,
          content: processed,
          attachments,
        });
        return;
      }

      cancelRef.current = false;
      await addMessage({ conversationId, role: "user", content: processed, attachments });

      startStream(conversationId, models);
    },
    [modelChoices, isStreaming, activeConversationId, addMessage, startStream],
  );

  const stopStreaming = useCallback(async () => {
    if (!isStreaming) return;
    cancelRef.current = true;
    sessionRef.current.cancel();

    try {
      await loggedInvoke("cancel_chat");
    } catch (err) {
      console.error(err);
    }

    const { streamingMessages: snapshot } = useChatStore.getState();
    for (const [mid, msg] of Object.entries(snapshot)) {
      const rid = sessionRef.current.requestIdForMessage(mid);
      await addMessage({
        ...msg,
        content: sanitizeOutput(msg.content || ""),
        isThinking: false,
        thinkingDuration: sessionRef.current.thinkingDuration(rid),
        status: "aborted",
      });
      setStreamingMessage(mid, null);
    }

    const queueConversationId =
      useChatStore.getState().streamingConversationId ??
      activeConversationIdRef.current;
    if (queueConversationId) {
      clearQueue(queueConversationId);
    }
    resetStreamState();
    setIsStreaming(false);
    setStreamingConversationId(null);
  }, [isStreaming, addMessage, clearQueue, resetStreamState, setStreamingConversationId, setStreamingMessage]);

  const regenerateMessage = useCallback(
    (conversationId: string) => {
      const models = validModelChoices(modelChoices);
      if (isStreaming || !models.length || !conversationId) return;
      startStream(conversationId, models);
    },
    [modelChoices, isStreaming, startStream],
  );

  const messageQueue = useChatStore((s) => s.messageQueue);
  const queuedCount = useMemo(
    () => messageQueue.filter((m) => m.conversationId === activeConversationId).length,
    [messageQueue, activeConversationId],
  );
  const activeConversationIsStreaming = streamingMessagesList.length > 0;

  return {
    messages,
    streamingMessagesList,
    isStreaming: activeConversationIsStreaming,
    sendMessage,
    regenerateMessage,
    stopStreaming,
    bottomRef,
    hasMessages: messages.length > 0 || streamingMessagesList.length > 0,
    queuedCount,
    processNextInQueue,
  };
}
