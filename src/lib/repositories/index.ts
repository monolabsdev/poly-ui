import Database from "@tauri-apps/plugin-sql";
import { ConversationRepository, mapRowToConversation, mapRowToMessage } from "./types";
import { Message, Conversation } from "@/types/chat";

export type { ConversationRepository } from "./types";

class SqliteConversationRepository implements ConversationRepository {
  constructor(private db: Database) {}

  async getConversations(userId?: string): Promise<Conversation[]> {
    const rows = await this.db.select<{ id: string; title: string; createdAt: string; updatedAt: string; isArchived: number }[]>(
      userId
        ? "SELECT * FROM conversations WHERE userId = ? ORDER BY updatedAt DESC"
        : "SELECT * FROM conversations ORDER BY updatedAt DESC",
      userId ? [userId] : []
    );
    return rows.map(mapRowToConversation);
  }

  async createConversation(id: string, title: string, userId?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      userId
        ? "INSERT INTO conversations (id, title, createdAt, updatedAt, isArchived, userId) VALUES (?, ?, ?, ?, 0, ?)"
        : "INSERT INTO conversations (id, title, createdAt, updatedAt, isArchived) VALUES (?, ?, ?, ?, 0)",
      userId ? [id, title, now, now, userId] : [id, title, now, now]
    );
  }

  async updateConversation(id: string, updates: { title?: string; updatedAt?: string; isArchived?: boolean }): Promise<void> {
    const clauses: string[] = [];
    const vals: unknown[] = [];
    if (updates.title !== undefined) { clauses.push("title = ?"); vals.push(updates.title); }
    if (updates.updatedAt !== undefined) { clauses.push("updatedAt = ?"); vals.push(updates.updatedAt); }
    if (updates.isArchived !== undefined) { clauses.push("isArchived = ?"); vals.push(updates.isArchived ? 1 : 0); }
    if (clauses.length === 0) return;
    vals.push(id);
    await this.db.execute(`UPDATE conversations SET ${clauses.join(", ")} WHERE id = ?`, vals);
  }

  async deleteConversation(id: string): Promise<void> {
    await this.db.execute("DELETE FROM messages WHERE conversationId = ?", [id]);
    await this.db.execute("DELETE FROM conversations WHERE id = ?", [id]);
  }

  async deleteAllConversations(userId: string): Promise<void> {
    await this.db.execute("DELETE FROM messages WHERE conversationId IN (SELECT id FROM conversations WHERE userId = ?)", [userId]);
    await this.db.execute("DELETE FROM conversations WHERE userId = ?", [userId]);
  }

  async getMessages(conversationId: string, limit: number, offset: number): Promise<Message[]> {
    const rows = await this.db.select<{ id: string; conversationId: string; role: "user" | "assistant"; content: string; createdAt: string; attachments?: string; model?: string; provider?: Message["provider"]; thinking?: string; thinkingDuration?: number; webSearch?: string }[]>(
      "SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?",
      [conversationId, limit, offset]
    );
    return rows.map(mapRowToMessage).reverse();
  }

  async getAllMessages(): Promise<Message[]> {
    const rows = await this.db.select<{ id: string; conversationId: string; role: "user" | "assistant"; content: string; createdAt: string; attachments?: string; model?: string; provider?: Message["provider"]; thinking?: string; thinkingDuration?: number; webSearch?: string }[]>(
      "SELECT * FROM messages ORDER BY conversationId ASC, createdAt ASC",
    );
    return rows.map(mapRowToMessage);
  }

  async addMessage(message: Message): Promise<void> {
    await this.db.execute(
      "INSERT INTO messages (id, conversationId, role, content, createdAt, attachments, model, provider, thinking, thinkingDuration, webSearch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        message.id, message.conversationId, message.role, message.content, message.createdAt,
        message.attachments ? JSON.stringify(message.attachments) : null,
        message.model || null, message.provider || null, message.thinking || null, message.thinkingDuration || null,
        message.webSearch ? JSON.stringify(message.webSearch) : null,
      ]
    );
    await this.db.execute("UPDATE conversations SET updatedAt = ? WHERE id = ?", [message.createdAt, message.conversationId]);
  }

  async deleteMessagesAfter(conversationId: string, messageId: string): Promise<void> {
    const target = await this.db.select<{ createdAt: string }[]>("SELECT createdAt FROM messages WHERE id = ?", [messageId]);
    if (target.length === 0) return;
    await this.db.execute("DELETE FROM messages WHERE conversationId = ? AND createdAt >= ?", [conversationId, target[0].createdAt]);
  }

  async transferConversations(fromUserId: string, toUserId: string): Promise<void> {
    await this.db.execute("UPDATE conversations SET userId = ? WHERE userId = ?", [toUserId, fromUserId]);
  }
}

class InMemoryConversationRepository implements ConversationRepository {
  private conversations: Record<string, { id: string; title: string; createdAt: string; updatedAt: string; isArchived: boolean; userId?: string }> = {};
  private messages: Record<string, Message[]> = {};

  async getConversations(userId?: string): Promise<Conversation[]> {
    return Object.values(this.conversations)
      .filter((c) => !userId || c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createConversation(id: string, title: string, userId?: string): Promise<void> {
    const now = new Date().toISOString();
    this.conversations[id] = { id, title, createdAt: now, updatedAt: now, isArchived: false, userId };
    this.messages[id] = [];
  }

  async updateConversation(id: string, updates: { title?: string; updatedAt?: string; isArchived?: boolean }): Promise<void> {
    const conv = this.conversations[id];
    if (!conv) return;
    if (updates.title !== undefined) conv.title = updates.title;
    if (updates.updatedAt !== undefined) conv.updatedAt = updates.updatedAt;
    if (updates.isArchived !== undefined) conv.isArchived = updates.isArchived;
  }

  async deleteConversation(id: string): Promise<void> {
    delete this.conversations[id];
    delete this.messages[id];
  }

  async deleteAllConversations(userId: string): Promise<void> {
    for (const [id, conv] of Object.entries(this.conversations)) {
      if (conv.userId === userId) {
        delete this.conversations[id];
        delete this.messages[id];
      }
    }
  }

  async getMessages(conversationId: string, limit: number, offset: number): Promise<Message[]> {
    const all = [...(this.messages[conversationId] ?? [])];
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.slice(offset, offset + limit).reverse();
  }

  async getAllMessages(): Promise<Message[]> {
    return Object.values(this.messages)
      .flat()
      .sort((a, b) =>
        a.conversationId === b.conversationId
          ? a.createdAt.localeCompare(b.createdAt)
          : a.conversationId.localeCompare(b.conversationId),
      );
  }

  async addMessage(message: Message): Promise<void> {
    const list = this.messages[message.conversationId] ?? [];
    this.messages[message.conversationId] = [...list, message];
    if (this.conversations[message.conversationId]) {
      this.conversations[message.conversationId].updatedAt = message.createdAt;
    }
  }

  async deleteMessagesAfter(conversationId: string, messageId: string): Promise<void> {
    const msgs = this.messages[conversationId] ?? [];
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx !== -1) this.messages[conversationId] = msgs.slice(0, idx);
  }

  async transferConversations(fromUserId: string, toUserId: string): Promise<void> {
    for (const [id, conv] of Object.entries(this.conversations)) {
      if (conv.userId === fromUserId) {
        this.conversations[id] = { ...conv, userId: toUserId };
      }
    }
  }
}

let repository: ConversationRepository | null = null;

export async function initRepository(): Promise<ConversationRepository> {
  if (repository) return repository;

  try {
    const db = await Database.load("sqlite:chat.db");
    repository = new SqliteConversationRepository(db);
    if (DEV) console.log("[repo] SQLite repository active");
  } catch (error) {
    console.warn("[repo] Falling back to in-memory", error);
    repository = new InMemoryConversationRepository();
  }

  return repository;
}

export function getRepository(): ConversationRepository {
  if (!repository) throw new Error("Repository not initialized");
  return repository;
}

// Injection seam for tests. Pass InMemoryConversationRepository to test without SQLite.
export function setRepository(repo: ConversationRepository): void {
  repository = repo;
}

export function resetRepository(): void {
  repository = null;
}
