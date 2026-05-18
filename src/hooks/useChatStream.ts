import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useShallow } from "zustand/react/shallow";
import type { ChatMessage, Attachment } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
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
  const pendingStreamsRef = useRef(0);
  const cancelRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);

  // Stable refs for event handlers so the bus subscription never needs to
  // re-run. Updated on every render via the layout effect below.
  const handleChunkRef = useRef<(p: ChunkPayload) => void>(() => {});
  const handleThinkingRef = useRef<(p: ThinkingPayload) => void>(() => {});

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

  useEffect(() => {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" }),
    );
  }, [messages, streamingMessages]);

  // Merge persisted + live streaming messages for the UI.
  const displayMessages = useMemo<ChatMessage[]>(() => {
    const live = Object.values(streamingMessages);
    if (live.length === 0) return messages;
    const liveIds = new Set(live.map((m) => m.id));
    const persisted = messages.filter((m) => !liveIds.has(m.id));
    return [...persisted, ...live];
  }, [messages, streamingMessages]);

  // -------------------------------------------------------------------------
  // resetStreamState — clears all per-stream bookkeeping.
  // -------------------------------------------------------------------------
  const resetStreamState = useCallback(() => {
    const { streamingMessages: current } = useChatStore.getState();
    Object.keys(requestIdToMessageIdRef.current).forEach((rid) => {
      const mid = requestIdToMessageIdRef.current[rid];
      if (current[mid]) setStreamingMessage(mid, null);
      
      // Cleanup pending token batches
      const batch = pendingBatchesRef.current[rid];
      if (batch?.timer) clearTimeout(batch.timer);
      delete pendingBatchesRef.current[rid];
    });
    contentAccRef.current = {};
    thinkingAccRef.current = {};
    requestIdToMessageIdRef.current = {};
    thinkingStartTimeRef.current = {};
    pendingStreamsRef.current = 0;
  }, [setStreamingMessage]);

  const settlePending = useCallback(() => {
    pendingStreamsRef.current = Math.max(0, pendingStreamsRef.current - 1);
    if (pendingStreamsRef.current === 0) setIsStreaming(false);
  }, []);

  // Token batching: accumulate tokens, update state every ~16ms to reduce re-renders
const pendingBatchesRef = useRef<Record<string, { content: string; timer: number | null }>>({});

const flushTokenBatch = (requestId: string, messageId: string) => {
  const batch = pendingBatchesRef.current[requestId];
  if (!batch || !batch.content) return;
  
  const { patchStreamingMessage } = useChatStore.getState().actions;
  patchStreamingMessage(messageId, { content: batch.content, status: "streaming" });
  batch.content = "";
  batch.timer = null;
};

const queueTokenBatch = (requestId: string, messageId: string, newContent: string) => {
  let batch = pendingBatchesRef.current[requestId];
  if (!batch) {
    batch = { content: "", timer: null };
    pendingBatchesRef.current[requestId] = batch;
  }
  
  batch.content = newContent;
  
  if (!batch.timer) {
    batch.timer = window.setTimeout(() => {
      flushTokenBatch(requestId, messageId);
    }, 16); // ~1 frame at 60fps
  }
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
      const batch = pendingBatchesRef.current[request_id];
      if (batch?.timer) {
        clearTimeout(batch.timer);
        flushTokenBatch(request_id, messageId);
      }

      // Finalize: read model from store at call time, not from closure.
      const { streamingMessages: current } = useChatStore.getState();
      const existing = current[messageId];
      const thinking = thinkingAccRef.current[request_id];
      const completedModel = existing?.model ?? "";
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

  // Keep stable handler refs up to date on every render.
  // Using useLayoutEffect ensures refs are updated before any paint-driven
  // callbacks fire, but a plain useEffect would also be correct here since
  // the event bus is async.
  useEffect(() => {
    handleChunkRef.current = handleChunk;
    handleThinkingRef.current = handleThinking;
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

      const system = buildSystemPrompt(systemPrompt);

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
        }).catch((err) => {
          console.error(err);
          settlePending();
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
  // sendMessage
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      const models = selectedModels.filter(Boolean);
      if (
        (!content.trim() && !attachments?.length) ||
        isStreaming ||
        !models.length
      )
        return;

      const { state } = useOllamaStore.getState();
      if (state !== "online") {
        notify.warn("Cannot send message", "Ollama is currently offline");
        return;
      }

      const conversationId =
        useChatStore.getState().activeConversationId ?? activeConversationId;
      if (!conversationId) return;

      cancelRef.current = false;
      const processed = defaultPreprocessor.preprocess(content.trim());
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

  return {
    messages: displayMessages,
    isStreaming,
    sendMessage,
    regenerateMessage,
    stopStreaming,
    bottomRef,
    hasMessages: displayMessages.length > 0,
  };
}
