import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useShallow } from "zustand/react/shallow";
import type { ChatMessage, Attachment, Message } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { sanitizeOutput } from "@/lib/chat/sanitize";
import { loggedInvoke } from "@/lib/utils";
import { useNotify } from "@/hooks/useNotify";
import { useOllamaStore } from "@/services/ollama/monitor";
import { buildSystemPrompt } from "@/lib/chat/prompts";
import { isFeatureAIActive } from "@/lib/featureRegistry";
import { defaultPreprocessor } from "@/lib/chat/message-preprocessor";
import { triggerTitleGeneration } from "@/lib/chat/title-generation";
import {
  streamEventBus,
  type ChunkPayload,
  type ThinkingPayload,
  type WebSearchPayload,
} from "@/lib/chat/event-bus";
import { StreamAccumulator } from "@/lib/chat/stream-accumulator";
import type { ModelProvider } from "@/store/modelStore";
import { getWebSearchConfig } from "@/features/web-search/useWebSearchConfig";
import { clearRequestBookkeeping } from "@/lib/chat/stream-cleanup";
import { getCurrentProviderAccountId } from "@/services/providers";

type SelectedModel = { model: string; provider: ModelProvider };

function toSelectedModels(models: string[], providers: ModelProvider[]): SelectedModel[] {
  return models
    .map((model, index) => ({ model, provider: providers[index] }))
    .filter((item): item is SelectedModel => Boolean(item.model && item.provider));
}

export function useChatStream(selectedModels: string[], selectedProviders: ModelProvider[], systemPrompt = "") {
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

  // Accumulator — pure logic, no React deps
  const accRef = useRef(new StreamAccumulator());
  const requestIdToMessageIdRef = useRef<Record<string, string>>({});
  const requestIdToConversationIdRef = useRef<Record<string, string>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const webSearchRef = useRef<Record<string, WebSearchPayload>>({});
  const pendingStreamsRef = useRef(0);
  const cancelRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const processingQueueRef = useRef(false);
  const selectedModelsRef = useRef(selectedModels);
  const selectedProvidersRef = useRef(selectedProviders);
  useEffect(() => { selectedModelsRef.current = selectedModels; }, [selectedModels]);
  useEffect(() => { selectedProvidersRef.current = selectedProviders; }, [selectedProviders]);

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
    const acc = accRef.current;
    acc.onFlush((updates) => {
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
    Object.keys(requestIdToMessageIdRef.current).forEach((rid) => {
      const mid = requestIdToMessageIdRef.current[rid];
      if (current[mid]) setStreamingMessage(mid, null);
    });
    accRef.current.reset();
    webSearchRef.current = {};
    requestIdToMessageIdRef.current = {};
    requestIdToConversationIdRef.current = {};
    thinkingStartTimeRef.current = {};
    pendingStreamsRef.current = 0;
  }, [setStreamingMessage]);

  const settlePending = useCallback((requestId?: string) => {
    pendingStreamsRef.current = requestId
      ? clearRequestBookkeeping(
          requestId,
          requestIdToMessageIdRef.current,
          requestIdToConversationIdRef.current,
          pendingStreamsRef.current,
        )
      : Math.max(0, pendingStreamsRef.current - 1);
    if (pendingStreamsRef.current === 0) {
      setIsStreaming(false);
      setStreamingConversationId(null);
    }
  }, [setStreamingConversationId]);

  const handleChunk = useCallback(
    async (payload: ChunkPayload) => {
      const conversationId = requestIdToConversationIdRef.current[payload.request_id];
      if (cancelRef.current || !conversationId) return;

      const { request_id, content, done, error } = payload;
      const messageId = requestIdToMessageIdRef.current[request_id];
      if (!messageId) return;

      const acc = accRef.current;
      const prev = acc.content[request_id] ?? "";
      const updated = prev + content;
      acc.content[request_id] = updated;

      if (!done) {
        acc.queueTokenBatch(messageId, updated);
        return;
      }

      const { streamingMessages: current } = useChatStore.getState();
      const existing = current[messageId];
      if (!existing) return;

      const thinking = acc.thinking[request_id];
      const completedModel = existing.model ?? "";
      const completedProvider = existing.provider ?? "OllamaLocal";

      if (error) {
        await addMessage({
          id: messageId,
          conversationId,
          role: "assistant",
          content: sanitizeOutput(updated || ""),
          model: completedModel || "unknown",
          provider: completedProvider,
          status: "error",
          errorMessage: error,
          webSearch: existing.webSearch,
        });
      } else if (updated.trim() || thinking?.trim()) {
        const startTime = thinkingStartTimeRef.current[request_id];
        const thinkingDuration = startTime ? (Date.now() - startTime) / 1000 : undefined;
        await addMessage({
          id: messageId,
          conversationId,
          role: "assistant",
          content: sanitizeOutput(updated),
          thinking,
          thinkingDuration,
          isThinking: false,
          createdAt: new Date().toISOString(),
          model: completedModel || "unknown",
          provider: completedProvider,
          status: "complete",
          webSearch: existing.webSearch,
        });
      }

      setStreamingMessage(messageId, null);
      settlePending(request_id);

      if (pendingStreamsRef.current === 0) {
        if (completedModel && !error) triggerTitleGeneration(conversationId);
        processNextInQueueRef.current?.(conversationId);
      }
    },
    [addMessage, settlePending, setStreamingMessage],
  );

  const handleThinking = useCallback(
    (payload: ThinkingPayload) => {
      if (cancelRef.current) return;
      const { request_id, thinking, is_thinking } = payload;
      const messageId = requestIdToMessageIdRef.current[request_id];
      if (!messageId) return;

      accRef.current.thinking[request_id] = thinking;
      if (is_thinking && !thinkingStartTimeRef.current[request_id]) {
        thinkingStartTimeRef.current[request_id] = Date.now();
      }

      patchStreamingMessage(messageId, {
        thinking,
        isThinking: is_thinking,
        status: "streaming",
      });
    },
    [patchStreamingMessage],
  );

  const handleWebSearch = useCallback(
    (payload: WebSearchPayload) => {
      if (cancelRef.current) return;
      const { request_id, query, status, results } = payload;
      const messageId = requestIdToMessageIdRef.current[request_id];
      if (!messageId) return;

      webSearchRef.current[request_id] = payload;

      const existing = useChatStore.getState().streamingMessages[messageId];
      const prevResults = existing?.webSearch?.results ?? [];
      const merged = results
        ? [...prevResults, ...results.filter((r) => !prevResults.some((p) => p.url === r.url))]
        : prevResults;

      patchStreamingMessage(messageId, {
        webSearch: { request_id, query, status, results: merged },
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
    (conversationId: string, models: SelectedModel[]) => {
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
      pendingStreamsRef.current = models.length;

      const webSearchConfig = getWebSearchConfig();
      const webSearchAI = isFeatureAIActive("web_search");
      const reasoningAI = isFeatureAIActive("reasoning");
      const activeWebSearchConfig = webSearchAI ? webSearchConfig : undefined;
      const system = buildSystemPrompt(systemPrompt, Boolean(activeWebSearchConfig), webSearchAI);

      for (const { model, provider } of models) {
        const rid = crypto.randomUUID();
        const mid = crypto.randomUUID();
        requestIdToMessageIdRef.current[rid] = mid;
        requestIdToConversationIdRef.current[rid] = conversationId;

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

        invoke("chat_stream", {
          requestId: rid,
          model,
          messages: history,
          systemPrompt: system,
          webSearchConfig: activeWebSearchConfig ?? null,
          reasoningEnabled: reasoningAI,
          providerType: provider,
          accountId: getCurrentProviderAccountId(),
        }).catch(async (err) => {
          console.error(err);
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
          if (pendingStreamsRef.current === 0) {
            processNextInQueueRef.current?.(conversationId);
          }
        });
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
      const models = toSelectedModels(selectedModelsRef.current, selectedProvidersRef.current);
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
      const models = toSelectedModels(selectedModels, selectedProviders);
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
    [selectedModels, selectedProviders, isStreaming, activeConversationId, addMessage, startStream],
  );

  const stopStreaming = useCallback(async () => {
    if (!isStreaming) return;
    cancelRef.current = true;

    try {
      await loggedInvoke("cancel_chat");
    } catch (err) {
      console.error(err);
    }

    const { streamingMessages: snapshot } = useChatStore.getState();
    for (const [mid, msg] of Object.entries(snapshot)) {
      if (!msg.content.trim() && !msg.thinking?.trim()) {
        setStreamingMessage(mid, null);
        continue;
      }
      const rid = Object.keys(requestIdToMessageIdRef.current).find(
        (key) => requestIdToMessageIdRef.current[key] === mid,
      );
      const startTime = rid ? thinkingStartTimeRef.current[rid] : undefined;
      await addMessage({
        ...msg,
        isThinking: false,
        thinkingDuration: startTime ? (Date.now() - startTime) / 1000 : undefined,
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
      const models = toSelectedModels(selectedModels, selectedProviders);
      if (isStreaming || !models.length || !conversationId) return;
      startStream(conversationId, models);
    },
    [selectedModels, selectedProviders, isStreaming, startStream],
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
