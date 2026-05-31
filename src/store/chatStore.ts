import { create } from "zustand";
import { getRepository } from "@/lib/repositories";
import { Message, Conversation, Attachment, WebSearchEvent } from "@/types/chat";
import { useAuthStore } from "@/store/authStore";

async function getRepo() {
  return getRepository();
}

export type { Conversation, Message };

export type QueuedMessage = {
  id: string;
  conversationId: string;
  content: string;
  attachments?: Attachment[];
};

type ChatStore = {
  conversations: Conversation[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  streamingConversationId: string | null;
  messages: Message[];
  streamingMessages: Record<string, Message>;
  hasMoreMessages: boolean;
  currentAttachments: Attachment[];
  messageQueue: QueuedMessage[];
  actions: {
    createConversation: (title?: string, isTemporary?: boolean) => Promise<Conversation>;
    setActiveConversationId: (id: string | null) => Promise<void>;
    setStreamingConversationId: (id: string | null) => void;
    setMessages: (messages: Message[]) => void;
    setStreamingMessage: (id: string, message: Message | null) => void;
    patchStreamingMessage: (id: string, update: Partial<Message>) => void;
    patchStreamingMessages: (updates: Record<string, Partial<Message>>) => void;
    loadMoreMessages: () => Promise<void>;
    addMessage: (message: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
      id?: string;
      createdAt?: string;
      attachments?: Attachment[];
      model?: string;
      provider?: Message["provider"];
      thinking?: string;
      thinkingDuration?: number;
      isThinking?: boolean;
      isStreaming?: boolean;
      status?: Message["status"];
      errorMessage?: string;
      webSearch?: WebSearchEvent;
    }) => Promise<Message>;
    loadConversations: () => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;
    deleteAllConversations: () => Promise<void>;
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
    enqueueMessage: (msg: QueuedMessage) => void;
    dequeueMessage: (id: string) => void;
    clearQueue: (conversationId: string) => void;
    getNextQueued: (conversationId: string) => QueuedMessage | undefined;
  };
};
export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  conversationsLoading: false,
  activeConversationId: null,
  streamingConversationId: null,
  messages: [],
  streamingMessages: {},
  hasMoreMessages: false,
  currentAttachments: [],
  messageQueue: [],
  actions: {
    loadConversations: async () => {
      const auth = useAuthStore.getState();
      const userId = auth.user?.id || auth.guestId;
      if (!userId) {
        set({ conversations: [], conversationsLoading: false, messages: [], hasMoreMessages: false, activeConversationId: null });
        return;
      }
      set({ conversationsLoading: true });
      try {
        const r = await getRepo();
        const conversations = await r.getConversations(userId);
        set({ conversations, conversationsLoading: false });
      } catch {
        set({ conversationsLoading: false });
      }
    },
    setStreamingConversationId: (id) => set({ streamingConversationId: id }),
    setStreamingMessage: (id, message) => set((state) => {
      if (message) {
        state.streamingMessages[id] = message;
      } else {
        delete state.streamingMessages[id];
      }
      return { streamingMessages: { ...state.streamingMessages } };
    }),
    patchStreamingMessage: (id, update) => set((state) => {
      const existing = state.streamingMessages[id];
      if (!existing) return state;
      Object.assign(existing, update);
      return { streamingMessages: { ...state.streamingMessages } };
    }),
    patchStreamingMessages: (updates: Record<string, Partial<Message>>) => set((state) => {
      let changed = false;
      for (const [id, update] of Object.entries(updates)) {
        const existing = state.streamingMessages[id];
        if (existing) {
          Object.assign(existing, update);
          changed = true;
        }
      }
      if (!changed) return state;
      return { streamingMessages: { ...state.streamingMessages } };
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
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: id,
        messages: [],
        hasMoreMessages: false,
      }));
      if (!isTemporary) {
        try {
          const r = await getRepo();
          const auth = useAuthStore.getState();
          const userId = auth.user?.id || auth.guestId;
          await r.createConversation(id, title, userId || undefined);
        } catch (error) {
          console.error("Failed to persist conversation:", error);
        }
      }
      return conversation;
    },
    // Set active conversation and load its messages
    setActiveConversationId: async (id) => {
      if (!id) {
        set({ activeConversationId: null, messages: [], hasMoreMessages: false });
        return;
      }

      const pageSize = 50;
      const r = await getRepo();
      const messages = await r.getMessages(id, pageSize, 0);
      set({
        activeConversationId: id,
        messages,
        hasMoreMessages: messages.length === pageSize,
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
        provider: message.provider,
        thinking: message.thinking,
        thinkingDuration: message.thinkingDuration,
        isThinking: message.isThinking,
        isStreaming: false,
        status: message.status,
        errorMessage: message.errorMessage,
        webSearch: message.webSearch,
      };

      const { conversations } = useChatStore.getState();
      const conversation = conversations.find(c => c.id === message.conversationId);
      const isTemporary = conversation?.isTemporary ?? false;

      set((state) => {
        const exists = state.messages.some(m => m.id === payload.id);
        const shouldShowMessage = payload.conversationId === state.activeConversationId;
        const nextMessages = shouldShowMessage
          ? exists
            ? state.messages.map(m => m.id === payload.id ? payload : m)
            : [...state.messages, payload]
          : state.messages;

        return {
          messages: nextMessages,
          conversations: state.conversations.map((c) =>
            c.id === payload.conversationId
              ? { ...c, updatedAt: payload.createdAt }
              : c,
          ),
        };
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
    deleteAllConversations: async () => {
      const auth = useAuthStore.getState();
      const userId = auth.user?.id || auth.guestId;
      if (!userId) return;

      const { conversations } = useChatStore.getState();
      const userConversations = conversations.filter(
        (c) => !c.isTemporary,
      );

      if (userConversations.length > 0) {
        const r = await getRepo();
        await r.deleteAllConversations(userId);
      }

      set({
        conversations: [],
        activeConversationId: null,
        messages: [],
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

      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: newTitle, updatedAt: now } : c,
        ),
      }));

      if (conversation && !conversation.isTemporary) {
        try {
          const r = await getRepo();
          await r.updateConversation(id, { title: newTitle, updatedAt: now });
        } catch (e) {
          console.warn("Failed to persist renamed title", e);
        }
      }
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
    enqueueMessage: (msg) =>
      set((state) => ({
        messageQueue: [...state.messageQueue, msg],
      })),
    dequeueMessage: (id) =>
      set((state) => ({
        messageQueue: state.messageQueue.filter((m) => m.id !== id),
      })),
    clearQueue: (conversationId) =>
      set((state) => ({
        messageQueue: state.messageQueue.filter(
          (m) => m.conversationId !== conversationId,
        ),
      })),
    // LIFO: returns most recently enqueued (last item) so rapid sends
    // always drain the latest user input first.
    getNextQueued: (conversationId) => {
      const queue = get().messageQueue;
      const convMsgs = queue.filter((m) => m.conversationId === conversationId);
      return convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : undefined;
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
