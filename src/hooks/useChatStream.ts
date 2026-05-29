import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useShallow } from "zustand/react/shallow";
import type { ChatMessage, Attachment, Message } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { loggedInvoke } from "@/lib/utils";
import { useNotify } from "@/hooks/useNotify";
import { useOllamaStore } from "@/services/ollama/monitor";
import { buildSystemPrompt } from "@/lib/chat/prompts";
import { defaultPreprocessor } from "@/lib/chat/message-preprocessor";
import { queueTitleGeneration } from "@/lib/chat/title-generation";
import {
  streamEventBus,
  type ChunkPayload,
  type ThinkingPayload,
  type WebSearchPayload,
} from "@/lib/chat/event-bus";

// ---------------------------------------------------------------------------
// Stable handler refs pattern:
//
// The core bug was that handleChunk/handleThinking/handleTool closed over
// `streamingMessages` from the render cycle that created them. Because those
// callbacks were in the streamEventBus.subscribe() useEffect's dep array,
// every render (including the ones triggered by streaming patches) caused a
// re-subscribe, meaning multiple concurrent handlers drained the same events.
//
// Fix: keep a single subscription for the lifetime of the hook. Each handler
// is stored in a ref so the subscription callback always calls the latest
// version without needing to re-subscribe. Store state is always read via
// useChatStore.getState() (Zustand escape hatch) instead of closed-over
// reactive values.
// ---------------------------------------------------------------------------

export function useChatStream(selectedModels: string[], systemPrompt = "", userName?: string) {
  // Use useShallow to prevent re-renders when other messages in the store change
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
  const notify = useNotify();

  const [isStreaming, setIsStreaming] = useState(false);

  // Accumulator refs — never read from reactive state inside stream handlers.
  const contentAccRef = useRef<Record<string, string>>({});
  const thinkingAccRef = useRef<Record<string, string>>({});
  const requestIdToMessageIdRef = useRef<Record<string, string>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const webSearchRef = useRef<Record<string, WebSearchPayload>>({});
  const pendingStreamsRef = useRef(0);
  const cancelRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const processingQueueRef = useRef(false);
  const selectedModelsRef = useRef(selectedModels);
  useEffect(() => { selectedModelsRef.current = selectedModels; }, [selectedModels]);

  // Stable refs for event handlers so the bus subscription never needs to
  // re-run. Updated on every render via the layout effect below.
  const handleChunkRef = useRef<(p: ChunkPayload) => void>(() => {});
  const handleThinkingRef = useRef<(p: ThinkingPayload) => void>(() => {});
  const handleWebSearchRef = useRef<(p: WebSearchPayload) => void>(() => {});

  // Keep activeConversationIdRef in sync.
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    setStreamingConversationId(isStreaming ? activeConversationId : null);
  }, [isStreaming, activeConversationId, setStreamingConversationId]);

  useEffect(() => {
    cancelRef.current = true;
    resetStreamState();
    setIsStreaming(false);
    // resetStreamState is stable (see useCallback below); safe to omit from
    // deps per the rules of hooks — it never changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Streaming messages rendered separately (bottom) so persisted messages
  // array never changes identity during streaming. This prevents ALL
  // Message components from re-rendering on every streaming chunk.
  const streamingMessagesList = useMemo<ChatMessage[]>(
    () => Object.values(streamingMessages),
    [streamingMessages],
  );

  // -------------------------------------------------------------------------
  // resetStreamState — clears all per-stream bookkeeping.
  // -------------------------------------------------------------------------
  const resetStreamState = useCallback(() => {
    const { streamingMessages: current } = useChatStore.getState();
    Object.keys(requestIdToMessageIdRef.current).forEach((rid) => {
      const mid = requestIdToMessageIdRef.current[rid];
      if (current[mid]) setStreamingMessage(mid, null);
      delete pendingBatchesRef.current[mid];
    });
    contentAccRef.current = {};
    thinkingAccRef.current = {};
    webSearchRef.current = {};
    requestIdToMessageIdRef.current = {};
    thinkingStartTimeRef.current = {};
    pendingStreamsRef.current = 0;
  }, [setStreamingMessage]);

  const settlePending = useCallback(() => {
    pendingStreamsRef.current = Math.max(0, pendingStreamsRef.current - 1);
    if (pendingStreamsRef.current === 0) setIsStreaming(false);
  }, []);

  // Token batching: single rAF loop flushes ALL pending streams every frame.
  // Eliminates multiple setTimeout timers and their GC/timer-overhead.
  const pendingBatchesRef = useRef<Record<string, string>>({});
  const hasScheduledFlushRef = useRef(false);

  const flushAllBatches = useCallback(() => {
    hasScheduledFlushRef.current = false;
    const batches = pendingBatchesRef.current;
    if (Object.keys(batches).length === 0) return;

    const updates: Record<string, Partial<Message>> = {};
    for (const [messageId, content] of Object.entries(batches)) {
      if (content) {
        updates[messageId] = { content, status: "streaming" };
      }
    }
    if (Object.keys(updates).length > 0) {
      useChatStore.getState().actions.patchStreamingMessages(updates);
    }
    pendingBatchesRef.current = {};
  }, []);

  const scheduleBatchFlush = useCallback(() => {
    if (hasScheduledFlushRef.current) return;
    hasScheduledFlushRef.current = true;
    requestAnimationFrame(flushAllBatches);
  }, [flushAllBatches]);

  const queueTokenBatch = (_requestId: string, messageId: string, newContent: string) => {
    pendingBatchesRef.current[messageId] = newContent;
    scheduleBatchFlush();
  };

  // -------------------------------------------------------------------------
  // Stream event handlers.
  //
  // These are plain functions (not useCallback) because they are only ever
  // called through the stable ref wrappers registered on the bus. They read
  // all state via useChatStore.getState() to avoid stale closure problems.
  // -------------------------------------------------------------------------

  const handleChunk = useCallback(
    async (payload: ChunkPayload) => {
      const conversationId = activeConversationIdRef.current;
      if (cancelRef.current || !conversationId) return;

      const { request_id, content, done } = payload;
      const messageId = requestIdToMessageIdRef.current[request_id];
      if (!messageId) return;

      // Always build content from the ref accumulator — never from reactive
      // store state — to avoid stale-closure corruption.
      const acc = (contentAccRef.current[request_id] ?? "") + content;
      contentAccRef.current[request_id] = acc;

      if (!done) {
        // Batch token updates to reduce re-renders
        queueTokenBatch(request_id, messageId, acc);
        return;
      }

      // Flush any pending batch before finalizing
      delete pendingBatchesRef.current[messageId];

      // Finalize: read model from store at call time, not from closure.
      const { streamingMessages: current } = useChatStore.getState();
      const existing = current[messageId];
      if (!existing) return; // Already finalized by another path (e.g. error)
      const thinking = thinkingAccRef.current[request_id];
      const completedModel = existing.model ?? "";
      const shouldStartTitleGeneration = pendingStreamsRef.current <= 1;

      if (acc.trim() || thinking?.trim()) {
        const startTime = thinkingStartTimeRef.current[request_id];
        const thinkingDuration = startTime
          ? (Date.now() - startTime) / 1000
          : undefined;
        await addMessage({
          id: messageId,
          conversationId,
          role: "assistant",
          content: acc,
          thinking,
          thinkingDuration,
          isThinking: false,
          createdAt: new Date().toISOString(),
          model: completedModel || "unknown",
          status: "complete",
          webSearch: existing.webSearch,
        });
      }

      setStreamingMessage(messageId, null);
      settlePending();

      if (shouldStartTitleGeneration) {
        queueTitleGeneration({
          conversationId,
          model: completedModel,
          userName,
        });
      }

      if (pendingStreamsRef.current === 0) {
        processNextInQueueRef.current?.();
      }
    },
    [addMessage, settlePending, setStreamingMessage, userName],
    // NOTE: streamingMessages intentionally excluded. We use getState() above.
  );

  const handleThinking = useCallback(
    (payload: ThinkingPayload) => {
      if (cancelRef.current) return;

      const { request_id, thinking, is_thinking } = payload;
      const messageId = requestIdToMessageIdRef.current[request_id];
      if (!messageId) return;

      thinkingAccRef.current[request_id] = thinking;
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

      // Accumulate results across multiple sequential searches for the same
      // message (the model may search, get results, then search again).
      // Each "complete" event merges new results (deduped by URL) into the
      // existing set so the disclosure never shows stale "0 sources".
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

  // Keep stable handler refs up to date on every render.
  // Using useLayoutEffect ensures refs are updated before any paint-driven
  // callbacks fire, but a plain useEffect would also be correct here since
  // the event bus is async.
  useEffect(() => {
    handleChunkRef.current = handleChunk;
    handleThinkingRef.current = handleThinking;
    handleWebSearchRef.current = handleWebSearch;
  });

  // -------------------------------------------------------------------------
  // Single, stable bus subscription for the lifetime of the hook.
  //
  // The empty dep array means this runs once on mount and cleans up on
  // unmount. The ref wrappers ensure the latest handler versions are always
  // invoked without triggering a re-subscribe.
  // -------------------------------------------------------------------------
  useEffect(() => {
    streamEventBus.subscribe({
      onChunk: (p) => handleChunkRef.current(p),
      onThinking: (p) => handleThinkingRef.current(p),
      onWebSearch: (p) => handleWebSearchRef.current(p),
    });
    return () => {
      streamEventBus.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // startStream — shared streaming logic, reused by sendMessage and regenerate
  // -------------------------------------------------------------------------
  const startStream = useCallback(
    (conversationId: string, models: string[]) => {
      if (!conversationId || !models.length) return;

      // Read current conversation history from the store
      const history = useChatStore.getState().messages
        .filter((m) => m.conversationId === conversationId)
        .map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments ?? [],
        }));

      setIsStreaming(true);
      resetStreamState();
      pendingStreamsRef.current = models.length;

      const { exaApiKey, webSearchEnabled, reasoningEnabled } = useSettingsStore.getState().general;
      const system = buildSystemPrompt(systemPrompt, exaApiKey, webSearchEnabled);

      for (const model of models) {
        const rid = crypto.randomUUID();
        const mid = crypto.randomUUID();
        requestIdToMessageIdRef.current[rid] = mid;

        setStreamingMessage(mid, {
          id: mid,
          conversationId,
          role: "assistant",
          content: "",
          model,
          createdAt: new Date().toISOString(),
          status: "streaming",
          isStreaming: true,
        });

        invoke("chat_stream", {
          requestId: rid,
          model,
          messages: history,
          systemPrompt: system,
          exaApiKey: exaApiKey || null,
          reasoningEnabled,
        }).catch((err) => {
          console.error(err);
          settlePending();

          // Check if handleChunk already finalised this message (done:true event
          // raced ahead of the Promise rejection). If so, don't overwrite.
          if (!useChatStore.getState().streamingMessages[mid]) return;

          const errMsg =
            typeof err === "string"
              ? err
              : (err as Error).message || "Unknown error";

          patchStreamingMessage(mid, {
            status: "error",
            errorMessage: errMsg,
            isStreaming: false,
          });

          notify.error(`Chat error (${model})`, errMsg);
        });
      }
    },
    [
      systemPrompt,
      resetStreamState,
      settlePending,
      setStreamingMessage,
      patchStreamingMessage,
      notify,
    ],
  );

  // -------------------------------------------------------------------------
  // processNextInQueue — drain queued messages after stream completes.
  // Last-queued wins (LIFO) so rapid sends always prioritize the latest input.
  // -------------------------------------------------------------------------
  const processNextInQueue = useCallback(async () => {
    if (processingQueueRef.current) return;
    const conversationId = activeConversationIdRef.current;
    if (!conversationId) return;

    const next = useChatStore.getState().actions.getNextQueued(conversationId);
    if (!next) return;

    processingQueueRef.current = true;
    try {
      const models = selectedModelsRef.current.filter(Boolean);
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

  const processNextInQueueRef = useRef(processNextInQueue);
  useEffect(() => { processNextInQueueRef.current = processNextInQueue; });

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      const models = selectedModels.filter(Boolean);
      if ((!content.trim() && !attachments?.length) || !models.length) return;

      const { state } = useOllamaStore.getState();
      if (state !== "online") {
        notify.warn("Cannot send message", "Ollama is currently offline");
        return;
      }

      const conversationId =
        useChatStore.getState().activeConversationId ?? activeConversationId;
      if (!conversationId) return;

      const processed = defaultPreprocessor.preprocess(content.trim());

      // Backpressure: enqueue instead of blocking when already streaming.
      // Processes newest-first after current stream completes.
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
      await addMessage({
        conversationId,
        role: "user",
        content: processed,
        attachments,
      });

      startStream(conversationId, models);
    },
    [selectedModels, isStreaming, activeConversationId, addMessage, startStream],
  );

  // -------------------------------------------------------------------------
  // stopStreaming
  // -------------------------------------------------------------------------
  const stopStreaming = useCallback(async () => {
    if (!isStreaming) return;
    cancelRef.current = true;

    try {
      await loggedInvoke("cancel_chat");
    } catch (err) {
      console.error(err);
    }

    // Snapshot the streaming messages at call time via getState() to avoid
    // acting on a stale closure.
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
        thinkingDuration: startTime
          ? (Date.now() - startTime) / 1000
          : undefined,
        status: "aborted",
      });
      setStreamingMessage(mid, null);
    }

    setIsStreaming(false);
  }, [isStreaming, addMessage, setStreamingMessage]);
  // NOTE: streamingMessages removed from deps; we use getState() above.

  const regenerateMessage = useCallback(
    (conversationId: string) => {
      const models = selectedModels.filter(Boolean);
      if (isStreaming || !models.length || !conversationId) return;
      startStream(conversationId, models);
    },
    [selectedModels, isStreaming, startStream],
  );

  const messageQueue = useChatStore((s) => s.messageQueue);
  const queuedCount = useMemo(
    () => messageQueue.filter((m) => m.conversationId === activeConversationId).length,
    [messageQueue, activeConversationId],
  );

  return {
    messages,
    streamingMessagesList,
    isStreaming,
    sendMessage,
    regenerateMessage,
    stopStreaming,
    bottomRef,
    hasMessages: messages.length > 0 || streamingMessagesList.length > 0,
    queuedCount,
    processNextInQueue,
  };
}
