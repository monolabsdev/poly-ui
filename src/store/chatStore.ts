import { create } from "zustand";
import { getRepository } from "@/lib/repositories";
import { Message, Conversation, Attachment } from "@/types/chat";
import { startTransition } from "react";

async function getRepo() {
  return getRepository();
}

// Perf stub
function perfLog(..._args: unknown[]): void {}

export type { Conversation, Message };

type ChatStore = {
  conversations: Conversation[];
  activeConversationId: string | null;
  streamingConversationId: string | null;
  messages: Message[];
  streamingMessages: Record<string, Message>;
  hasMoreMessages: boolean;
  currentAttachments: Attachment[];
  actions: {
    createConversation: (title?: string, isTemporary?: boolean) => Promise<Conversation>;
    setActiveConversationId: (id: string | null) => Promise<void>;
    setStreamingConversationId: (id: string | null) => void;
    setMessages: (messages: Message[]) => void;
    setStreamingMessage: (id: string, message: Message | null) => void;
    patchStreamingMessage: (id: string, update: Partial<Message>) => void;
    loadMoreMessages: () => Promise<void>;
    addMessage: (message: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
      id?: string;
      createdAt?: string;
      attachments?: Attachment[];
      model?: string;
      thinking?: string;
      thinkingDuration?: number;
      isThinking?: boolean;
      isStreaming?: boolean;
      status?: Message["status"];
      errorMessage?: string;
    }) => Promise<Message>;
    loadConversations: () => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;
    archiveConversation: (id: string) => Promise<void>;
    unarchiveConversation: (id: string) => Promise<void>;
    renameConversation: (id: string, newTitle: string) => Promise<void>;
    deleteMessagesAfter: (
      conversationId: string,
      messageId: string,
    ) => Promise<void>;
    addCurrentAttachment: (attachment: Attachment) => void;
    removeCurrentAttachment: (id: string) => void;
    clearCurrentAttachments: () => void;
  };
};
export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  activeConversationId: null,
  streamingConversationId: null,
  messages: [],
  streamingMessages: {},
  hasMoreMessages: false,
  currentAttachments: [],
  actions: {
    loadConversations: async () => {
      const r = await getRepo();
      const conversations = await r.getConversations();
      set({ conversations });
    },
    setStreamingConversationId: (id) => set({ streamingConversationId: id }),
    setStreamingMessage: (id, message) => set((state) => {
      const next = { ...state.streamingMessages };
      if (message) next[id] = message;
      else delete next[id];
      return { streamingMessages: next };
    }),
    patchStreamingMessage: (id, update) => set((state) => {
      const existing = state.streamingMessages[id];
      if (!existing) return state;
      return {
        streamingMessages: {
          ...state.streamingMessages,
          [id]: { ...existing, ...update }
        }
      };
    }),
    createConversation: async (title = "New Chat", isTemporary = false) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id,
        title,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
        isTemporary,
      };
      startTransition(() => {
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
          messages: [],
          hasMoreMessages: false,
        }));
      });
      perfLog("store", "chatStore.createConversation.optimistic", {
        id,
        isTemporary,
      });
      if (!isTemporary) {
        try {
          const r = await getRepo();
          await r.createConversation(id, title);
        } catch (error) {
          console.error("Failed to persist conversation:", error);
        }
      }
      return conversation;
    },
    // Set active conversation and load its messages
    setActiveConversationId: async (id) => {
      set({ activeConversationId: id });

      if (!id) {
        set({ messages: [], hasMoreMessages: false });
        return;
      }

      const pageSize = 50;
      const r = await getRepo();
      const messages = await r.getMessages(id, pageSize, 0);
      startTransition(() => {
        set({ messages, hasMoreMessages: messages.length === pageSize });
      });
    },
    loadMoreMessages: async () => {
      const { activeConversationId, messages } = useChatStore.getState();
      if (!activeConversationId) return;

      const pageSize = 50;
      const offset = messages.length;
      const r = await getRepo();
      const newMessages = await r.getMessages(activeConversationId, pageSize, offset);

      if (newMessages.length === 0) {
        set({ hasMoreMessages: false });
        return;
      }
      set({
        messages: [...newMessages, ...messages],
        hasMoreMessages: newMessages.length === pageSize,
      });
    },
    setMessages: (messages) => set({ messages }),
    addMessage: async (message) => {
      const now = message.createdAt ?? new Date().toISOString();
      const payload: Message = {
        id: message.id ?? crypto.randomUUID(),
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        createdAt: now,
        attachments: message.attachments,
        model: message.model,
        thinking: message.thinking,
        thinkingDuration: message.thinkingDuration,
        isThinking: message.isThinking,
        isStreaming: false,
        status: message.status,
        errorMessage: message.errorMessage,
      };

      const { conversations } = useChatStore.getState();
      const conversation = conversations.find(c => c.id === message.conversationId);
      const isTemporary = conversation?.isTemporary ?? true;

      set((state) => {
        const exists = state.messages.some(m => m.id === payload.id);
        const nextMessages = exists 
          ? state.messages.map(m => m.id === payload.id ? payload : m)
          : [...state.messages, payload];

        return {
          messages: nextMessages,
          conversations: state.conversations.map((c) =>
            c.id === payload.conversationId
              ? { ...c, updatedAt: payload.createdAt }
              : c,
          ),
        };
      });

      perfLog("store", "chatStore.addMessage.optimistic", {
        id: payload.id,
        role: payload.role,
      });

      if (!isTemporary) {
        try {
          const r = await getRepo();
          await r.addMessage(payload);
        } catch (error) {
          console.error("Failed to persist message:", error);
        }
      }
      return payload;
    },
    deleteConversation: async (id) => {
      const { conversations } = useChatStore.getState();
      const conversation = conversations.find((c) => c.id === id);
      const shouldPersist = conversation && !conversation.isTemporary;

      if (shouldPersist) {
        const r = await getRepo();
        await r.deleteConversation(id);
      }

      set((state) => {
        const newConversations = state.conversations.filter((c) => c.id !== id);
        const wasActive = state.activeConversationId === id;
        const newActiveId = wasActive
          ? (newConversations.find((c) => !c.isArchived)?.id ?? null)
          : state.activeConversationId;
        const newMessages = wasActive ? [] : state.messages;

        return {
          conversations: newConversations,
          activeConversationId: newActiveId,
          messages: newMessages,
        };
      });
    },
    archiveConversation: async (id) => {
      const { conversations } = useChatStore.getState();
      const conversation = conversations.find((c) => c.id === id);
      const shouldPersist = conversation && !conversation.isTemporary;

      if (shouldPersist) {
        const r = await getRepo();
        await r.updateConversation(id, { isArchived: true });
      }

      set((state) => {
        const newConversations = state.conversations.map((c) =>
          c.id === id ? { ...c, isArchived: true } : c,
        );
        const wasActive = state.activeConversationId === id;
        const newActiveId = wasActive
          ? (newConversations.find((c) => !c.isArchived)?.id ?? null)
          : state.activeConversationId;
        const newMessages = wasActive ? [] : state.messages;

        return {
          conversations: newConversations,
          activeConversationId: newActiveId,
          messages: newMessages,
        };
      });
    },
    unarchiveConversation: async (id) => {
      const { conversations } = useChatStore.getState();
      const conversation = conversations.find((c) => c.id === id);
      const shouldPersist = conversation && !conversation.isTemporary;

      if (shouldPersist) {
        const r = await getRepo();
        await r.updateConversation(id, { isArchived: false });
      }

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, isArchived: false } : c,
        ),
      }));
    },
    renameConversation: async (id, newTitle) => {
      const now = new Date().toISOString();
      const conversation = useChatStore.getState().conversations.find((c) => c.id === id);
      const shouldPersist = conversation && !conversation.isTemporary;

      if (shouldPersist) {
        const r = await getRepo();
        await r.updateConversation(id, { title: newTitle, updatedAt: now });
      }

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: newTitle, updatedAt: now } : c,
        ),
      }));
    },
    // Delete messages after a specific message ID (inclusive)
    deleteMessagesAfter: async (conversationId, messageId) => {
      const { conversations } = useChatStore.getState();
      const conversation = conversations.find((c) => c.id === conversationId);
      const shouldPersist = conversation && !conversation.isTemporary;

      if (shouldPersist) {
        const r = await getRepo();
        await r.deleteMessagesAfter(conversationId, messageId);
      }

      set((state) => {
        const index = state.messages.findIndex((m) => m.id === messageId);
        if (index === -1) return state;
        return { messages: state.messages.slice(0, index) };
      });
    },
    addCurrentAttachment: (attachment) =>
      set((state) => ({
        currentAttachments: [...state.currentAttachments, attachment],
      })),
    removeCurrentAttachment: (id) =>
      set((state) => ({
        currentAttachments: state.currentAttachments.filter((a) => a.id !== id),
      })),
    clearCurrentAttachments: () => set({ currentAttachments: [] }),
  },
}));
