import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Attachment } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import { useInspectorStore } from "@/store/inspectorStore";
import { useToolStore } from "@/store/toolStore";
import { loggedInvoke } from "@/lib/utils";
import { useNotify } from "@/hooks/useNotify";
import { useOllamaStore } from "@/services/ollama/monitor";
import { buildSystemPrompt, processTemporalVariables } from "@/lib/chat/prompts";
import { StreamEventBus, type ChunkPayload, type ThinkingPayload, type ToolInvocationPayload } from "@/lib/chat/event-bus";

type StreamingMessage = ChatMessage & { isStreaming: true };

export function useChatStream(selectedModels: string[], systemPrompt = "") {
  const messages = useChatStore((s) => s.messages);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const { addMessage, setStreamingConversationId } =
    useChatStore((s) => s.actions);
  const { addLog } = useInspectorStore((s) => s.actions);
  const notify = useNotify();

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<Record<string, StreamingMessage>>({});

  const contentAccRef = useRef<Record<string, string>>({});
  const thinkingAccRef = useRef<Record<string, string>>({});
  const messageIdsRef = useRef<Record<string, string>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const thinkingEndTimeRef = useRef<Record<string, number>>({});
  const pendingStreamsRef = useRef(0);
  const cancelRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const streamingMessagesRef = useRef<Record<string, StreamingMessage>>({});
  const flushFrameRef = useRef<number | null>(null);

  // Sync refs
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { setStreamingConversationId(isStreaming ? activeConversationId : null); }, [isStreaming, activeConversationId, setStreamingConversationId]);
  useEffect(() => { cancelRef.current = true; resetStreamState(); setIsStreaming(false); }, [activeConversationId]);
  useEffect(() => { requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" })); }, [messages, streamingMessages]);

  const displayMessages = useMemo<ChatMessage[]>(() => {
    const live = Object.values(streamingMessages);
    if (live.length === 0) return messages;
    const liveIds = new Set(live.map((m) => m.id));
    const persisted = messages.filter((m) => !liveIds.has(m.id));
    return [...persisted, ...live];
  }, [messages, streamingMessages]);

  const resetStreamState = useCallback(() => {
    if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
    streamingMessagesRef.current = {};
    setStreamingMessages({});
    contentAccRef.current = {};
    thinkingAccRef.current = {};
    messageIdsRef.current = {};
    thinkingStartTimeRef.current = {};
    thinkingEndTimeRef.current = {};
    pendingStreamsRef.current = 0;
  }, []);

  const flush = useCallback(() => {
    if (flushFrameRef.current) return;
    flushFrameRef.current = requestAnimationFrame(() => {
      flushFrameRef.current = null;
      startTransition(() => setStreamingMessages({ ...streamingMessagesRef.current }));
    });
  }, []);

  const updateStreamingMessage = useCallback((requestId: string, updater: (m?: StreamingMessage) => StreamingMessage | undefined) => {
    const next = updater(streamingMessagesRef.current[requestId]);
    if (next) streamingMessagesRef.current[requestId] = next;
    else delete streamingMessagesRef.current[requestId];
    flush();
  }, [flush]);

  const settlePending = useCallback(() => {
    pendingStreamsRef.current = Math.max(0, pendingStreamsRef.current - 1);
    if (pendingStreamsRef.current === 0) setIsStreaming(false);
  }, []);

  const handleChunk = useCallback(async (payload: ChunkPayload) => {
    const conversationId = activeConversationIdRef.current;
    if (cancelRef.current || !conversationId) return;

    const { request_id, content, done } = payload;
    const acc = (contentAccRef.current[request_id] ?? "") + content;
    contentAccRef.current[request_id] = acc;

    if (!done) {
      updateStreamingMessage(request_id, (existing) => {
        if (existing) return { ...existing, content: acc };
        const id = messageIdsRef.current[request_id] ?? crypto.randomUUID();
        messageIdsRef.current[request_id] = id;
        const log = useInspectorStore.getState().logs.find(l => l.id === request_id);
        
        return {
          id, role: "assistant", content: acc, isStreaming: true, conversationId,
          createdAt: new Date().toISOString(), model: log?.model ?? "unknown",
          thinking: thinkingAccRef.current[request_id], isThinking: true
        };
      });
      return;
    }

    // Finalize
    const id = messageIdsRef.current[request_id];
    const log = useInspectorStore.getState().logs.find(l => l.id === request_id);
    const thinking = thinkingAccRef.current[request_id];
    
    if (acc.trim() || thinking?.trim()) {
      const startTime = thinkingStartTimeRef.current[request_id];
      const thinkingDuration = startTime ? (Date.now() - startTime) / 1000 : undefined;
      await addMessage({
        id, conversationId, role: "assistant", content: acc, thinking,
        thinkingDuration, isThinking: false, createdAt: new Date().toISOString(),
        model: log?.model ?? "unknown"
      });
    }
    
    settlePending();
    updateStreamingMessage(request_id, () => undefined);
  }, [addMessage, settlePending, updateStreamingMessage]);

  const handleThinking = useCallback((payload: ThinkingPayload) => {
    const conversationId = activeConversationIdRef.current;
    if (cancelRef.current || !conversationId) return;

    const { request_id, thinking, is_thinking } = payload;
    thinkingAccRef.current[request_id] = thinking;

    updateStreamingMessage(request_id, (existing) => {
      if (!is_thinking && !thinkingEndTimeRef.current[request_id]) thinkingEndTimeRef.current[request_id] = Date.now();
      if (existing) return { ...existing, thinking, isThinking: is_thinking };
      
      thinkingStartTimeRef.current[request_id] = Date.now();
      const id = messageIdsRef.current[request_id] ?? crypto.randomUUID();
      messageIdsRef.current[request_id] = id;
      const log = useInspectorStore.getState().logs.find(l => l.id === request_id);
      
      return {
        id, role: "assistant", content: "", thinking, isThinking: is_thinking,
        isStreaming: true, conversationId, createdAt: new Date().toISOString(),
        model: log?.model ?? "unknown"
      };
    });
  }, [updateStreamingMessage]);

  const handleTool = useCallback((payload: ToolInvocationPayload) => {
    const { request_id, tool_name, tool_args, requires_approval, invocation_id } = payload;
    updateStreamingMessage(request_id, (existing) => {
      if (!existing) return existing;
      const label = `\n\nTool: **${tool_name}**`;
      return { ...existing, content: existing.content.includes(label) ? existing.content : existing.content + label };
    });

    if (requires_approval) {
      useToolStore.getState().actions.setPendingApproval({
        invocationId: invocation_id, requestId: request_id, toolName: tool_name, toolArgs: tool_args
      });
    }
  }, [updateStreamingMessage]);

  useEffect(() => {
    const bus = new StreamEventBus();
    bus.subscribe({ onChunk: handleChunk, onThinking: handleThinking, onTool: handleTool });
    return () => bus.unsubscribe();
  }, [handleChunk, handleThinking, handleTool]);

  const sendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    const models = selectedModels.filter(Boolean);
    if ((!content.trim() && !attachments?.length) || isStreaming || !models.length) return;

    const { state } = useOllamaStore.getState();
    if (state !== "online") {
      notify.warn("Cannot send message", "Ollama is currently offline");
      return;
    }

    const conversationId = useChatStore.getState().activeConversationId ?? activeConversationId;
    if (!conversationId) return;

    cancelRef.current = false;
    const processed = processTemporalVariables(content.trim());
    await addMessage({ conversationId, role: "user", content: processed, attachments });

    const history = useChatStore.getState().messages.map(m => ({ role: m.role, content: m.content, attachments: m.attachments ?? [] }));
    setIsStreaming(true);
    resetStreamState();
    pendingStreamsRef.current = models.length;

    const system = buildSystemPrompt(systemPrompt);
    for (const model of models) {
      const rid = crypto.randomUUID();
      addLog({ id: rid, model, request: { url: "tauri://chat_stream", method: "POST", headers: {}, body: { requestId: rid, model, messages: history, systemPrompt: system } }, timing: { startTime: Date.now() } });
      invoke("chat_stream", { requestId: rid, model, messages: history, systemPrompt: system }).catch(err => {
        console.error(err); settlePending();
        const errMsg = typeof err === "string" ? err : (err as any).message || "Unknown error";
        notify.error(`Chat error (${model})`, errMsg);
        addMessage({ id: crypto.randomUUID(), conversationId, role: "assistant", content: `Error: ${errMsg}`, createdAt: new Date().toISOString(), model });
      });
    }
  }, [selectedModels, isStreaming, activeConversationId, systemPrompt, addMessage, addLog, resetStreamState, settlePending]);

  const stopStreaming = useCallback(async () => {
    if (!isStreaming) return;
    cancelRef.current = true;
    try { await loggedInvoke("cancel_chat"); } catch (err) { console.error(err); }
    
    // Save snapshots
    const snapshot = { ...streamingMessagesRef.current };
    for (const [rid, msg] of Object.entries(snapshot)) {
      if (!msg.content.trim() && !msg.thinking?.trim()) continue;
      const startTime = thinkingStartTimeRef.current[rid];
      addMessage({ ...msg, isThinking: false, thinkingDuration: startTime ? (Date.now() - startTime) / 1000 : undefined });
    }
    resetStreamState();
    setIsStreaming(false);
  }, [isStreaming, addMessage, resetStreamState]);

  return { messages: displayMessages, isStreaming, sendMessage, stopStreaming, bottomRef, hasMessages: displayMessages.length > 0 };
}
