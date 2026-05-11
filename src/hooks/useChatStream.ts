import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Attachment } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { useInspectorStore } from "@/store/inspectorStore";
import { useToolStore } from "@/store/toolStore";
import { loggedInvoke } from "@/lib/utils";
import { useNotify } from "@/hooks/useNotify";
import { useOllamaStore } from "@/services/ollama/monitor";
import {
  buildSystemPrompt,
  processTemporalVariables,
} from "@/lib/chat/prompts";
import {
  streamEventBus,
  type ChunkPayload,
  type ThinkingPayload,
  type ToolInvocationPayload,
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

export function useChatStream(selectedModels: string[], systemPrompt = "") {
  const messages = useChatStore((s) => s.messages);
  const streamingMessages = useChatStore((s) => s.streamingMessages);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  const {
    addMessage,
    setStreamingConversationId,
    setStreamingMessage,
    patchStreamingMessage,
  } = useChatStore((s) => s.actions);
  const { addLog } = useInspectorStore((s) => s.actions);
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
  const handleToolRef = useRef<(p: ToolInvocationPayload) => void>(() => {});

  // Keep activeConversationIdRef in sync.
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Sync streaming conversation id into store.
  useEffect(() => {
    setStreamingConversationId(isStreaming ? activeConversationId : null);
  }, [isStreaming, activeConversationId, setStreamingConversationId]);

  // Reset stream state whenever the active conversation changes.
  useEffect(() => {
    cancelRef.current = true;
    resetStreamState();
    setIsStreaming(false);
    // resetStreamState is stable (see useCallback below); safe to omit from
    // deps per the rules of hooks — it never changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Auto-scroll.
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
        patchStreamingMessage(messageId, { content: acc, status: "streaming" });
        return;
      }

      // Finalize: read model from store at call time, not from closure.
      const { streamingMessages: current } = useChatStore.getState();
      const existing = current[messageId];
      const thinking = thinkingAccRef.current[request_id];

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
          model: existing?.model ?? "unknown",
          status: "complete",
        });
      }

      setStreamingMessage(messageId, null);
      settlePending();
    },
    [addMessage, settlePending, patchStreamingMessage, setStreamingMessage],
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

  const handleTool = useCallback(
    (payload: ToolInvocationPayload) => {
      const {
        request_id,
        tool_name,
        tool_args,
        requires_approval,
        invocation_id,
      } = payload;
      const messageId = requestIdToMessageIdRef.current[request_id];
      if (!messageId) return;

      // Read current content from store at call time.
      const { streamingMessages: current } = useChatStore.getState();
      const existing = current[messageId];
      const label = `\n\nTool: **${tool_name}**`;
      if (existing && !existing.content.includes(label)) {
        patchStreamingMessage(messageId, { content: existing.content + label });
      }

      if (requires_approval) {
        useToolStore.getState().actions.setPendingApproval({
          invocationId: invocation_id,
          requestId: request_id,
          toolName: tool_name,
          toolArgs: tool_args,
        });
      }
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
    handleToolRef.current = handleTool;
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
      onTool: (p) => handleToolRef.current(p),
    });
    return () => {
      streamEventBus.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Always read the latest conversation id from the store, not the
      // potentially-stale closure value.
      const conversationId =
        useChatStore.getState().activeConversationId ?? activeConversationId;
      if (!conversationId) return;

      cancelRef.current = false;
      const processed = processTemporalVariables(content.trim());
      await addMessage({
        conversationId,
        role: "user",
        content: processed,
        attachments,
      });

      // Read history after the user message has been committed.
      const history = useChatStore.getState().messages.map((m) => ({
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

        // Create the placeholder once. All subsequent updates go through
        // patchStreamingMessage so there is never a second placeholder.
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

        addLog({
          id: rid,
          model,
          request: {
            url: "tauri://chat_stream",
            method: "POST",
            headers: {},
            body: {
              requestId: rid,
              model,
              messages: history,
              systemPrompt: system,
            },
          },
          timing: { startTime: Date.now() },
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

          // Attach the error to the existing placeholder message rather than
          // creating a new assistant message for the error text.
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
      selectedModels,
      isStreaming,
      activeConversationId,
      systemPrompt,
      addMessage,
      addLog,
      resetStreamState,
      settlePending,
      setStreamingMessage,
      patchStreamingMessage,
      notify,
    ],
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

  return {
    messages: displayMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    bottomRef,
    hasMessages: displayMessages.length > 0,
  };
}
