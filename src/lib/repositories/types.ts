import { Message, Conversation } from "@/types/chat";

export interface ConversationRepository {
  getConversations(userId?: string): Promise<Conversation[]>;
  createConversation(id: string, title: string, userId?: string): Promise<void>;
  updateConversation(id: string, updates: { title?: string; updatedAt?: string; isArchived?: boolean }): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  deleteAllConversations(userId: string): Promise<void>;

  getMessages(conversationId: string, limit: number, offset: number): Promise<Message[]>;
  getAllMessages(): Promise<Message[]>;
  addMessage(message: Message): Promise<void>;
  deleteMessagesAfter(conversationId: string, messageId: string): Promise<void>;
  transferConversations(fromUserId: string, toUserId: string): Promise<void>;
}

export function mapRowToConversation(row: { id: string; title: string; createdAt: string; updatedAt: string; isArchived: number }): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isArchived: Boolean(row.isArchived),
  };
}

export function mapRowToMessage(row: { id: string; conversationId: string; role: "user" | "assistant"; content: string; createdAt: string; attachments?: string; model?: string; thinking?: string; thinkingDuration?: number; webSearch?: string }): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
    model: row.model,
    thinking: row.thinking,
    thinkingDuration: row.thinkingDuration,
    webSearch: row.webSearch ? JSON.parse(row.webSearch) : undefined,
  };
}
