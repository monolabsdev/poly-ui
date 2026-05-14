import Database from "@tauri-apps/plugin-sql";

// --- Types ---

export type ConversationRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: number; // 0 or 1
};

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  fullName?: string;
  status: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionRow = {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type MessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: string; // JSON string
  model?: string;
  thinking?: string;
  thinkingDuration?: number;
};

interface StorageAdapter {
  createConversation(id: string, title: string): Promise<void>;
  getConversations(): Promise<ConversationRow[]>;
  addMessage(msg: any): Promise<void>;
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<MessageRow[]>;
  updateConversation(id: string, updates: any): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  deleteMessagesAfter(conversationId: string, messageId: string): Promise<void>;
  createUser(user: any): Promise<void>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  getUserById(id: string): Promise<UserRow | null>;
  createSession(session: any): Promise<void>;
  getSessionByToken(token: string): Promise<SessionRow | null>;
  deleteSession(token: string): Promise<void>;
  updateUserStatus(userId: string, status: string): Promise<void>;
}

// --- InMemory Adapter ---

class InMemoryAdapter implements StorageAdapter {
  private conversations: Record<string, ConversationRow> = {};
  private messages: Record<string, MessageRow[]> = {};
  private users: Record<string, UserRow> = {};
  private sessions: Record<string, SessionRow> = {};

  async createConversation(id: string, title: string) {
    const now = new Date().toISOString();
    this.conversations[id] = { id, title, createdAt: now, updatedAt: now, isArchived: 0 };
    this.messages[id] = [];
  }

  async getConversations() {
    return Object.values(this.conversations).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async addMessage(msg: any) {
    const messageList = this.messages[msg.conversationId] ?? [];
    this.messages[msg.conversationId] = [
      ...messageList,
      {
        ...msg,
        attachments: msg.attachments ? JSON.stringify(msg.attachments) : undefined,
      },
    ];
    if (this.conversations[msg.conversationId]) {
      this.conversations[msg.conversationId].updatedAt = msg.createdAt;
    }
  }

  async getMessages(conversationId: string, limit?: number, offset?: number) {
    const all = [...(this.messages[conversationId] ?? [])];
    if (limit === undefined || offset === undefined) return all;
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.slice(offset, offset + limit).reverse();
  }

  async updateConversation(id: string, updates: any) {
    const conv = this.conversations[id];
    if (!conv) return;
    if (updates.title !== undefined) conv.title = updates.title;
    if (updates.updatedAt !== undefined) conv.updatedAt = updates.updatedAt;
    if (updates.isArchived !== undefined) conv.isArchived = updates.isArchived ? 1 : 0;
  }

  async deleteConversation(id: string) {
    delete this.conversations[id];
    delete this.messages[id];
  }

  async deleteMessagesAfter(conversationId: string, messageId: string) {
    const msgs = this.messages[conversationId] ?? [];
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx !== -1) this.messages[conversationId] = msgs.slice(0, idx);
  }

  async createUser(user: any) {
    const now = new Date().toISOString();
    this.users[user.id] = { ...user, createdAt: now, updatedAt: now };
  }

  async getUserByEmail(email: string) {
    return Object.values(this.users).find((u) => u.email === email) ?? null;
  }

  async getUserById(id: string) {
    return this.users[id] ?? null;
  }

  async createSession(session: any) {
    this.sessions[session.id] = { ...session, createdAt: new Date().toISOString() };
  }

  async getSessionByToken(token: string) {
    return Object.values(this.sessions).find((s) => s.token === token) ?? null;
  }

  async deleteSession(token: string) {
    const session = Object.values(this.sessions).find((s) => s.token === token);
    if (session) delete this.sessions[session.id];
  }

  async updateUserStatus(userId: string, status: string) {
    const user = this.users[userId];
    if (user) {
      user.status = status;
      user.updatedAt = new Date().toISOString();
    }
  }
}

// --- SQLite Adapter ---

class SqliteAdapter implements StorageAdapter {
  constructor(private db: Database) {}

  async createConversation(id: string, title: string) {
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO conversations (id, title, createdAt, updatedAt, isArchived) VALUES (?, ?, ?, ?, 0)`,
      [id, title, now, now],
    );
  }

  async getConversations() {
    return await this.db.select<ConversationRow[]>(`SELECT * FROM conversations ORDER BY updatedAt DESC`);
  }

  async addMessage(msg: any) {
    await this.db.execute(
      `INSERT INTO messages (id, conversationId, role, content, createdAt, attachments, model, thinking, thinkingDuration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.id, msg.conversationId, msg.role, msg.content, msg.createdAt,
        msg.attachments ? JSON.stringify(msg.attachments) : null,
        msg.model || null, msg.thinking || null, msg.thinkingDuration || null,
      ],
    );
    await this.db.execute(`UPDATE conversations SET updatedAt = ? WHERE id = ?`, [msg.createdAt, msg.conversationId]);
  }

  async getMessages(conversationId: string, limit?: number, offset?: number) {
    if (limit !== undefined && offset !== undefined) {
      const res = await this.db.select<MessageRow[]>(
        `SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [conversationId, limit, offset],
      );
      return res.reverse();
    }
    return await this.db.select<MessageRow[]>(`SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC`, [conversationId]);
  }

  async updateConversation(id: string, updates: any) {
    const clauses: string[] = [];
    const vals: any[] = [];
    if (updates.title !== undefined) { clauses.push("title = ?"); vals.push(updates.title); }
    if (updates.updatedAt !== undefined) { clauses.push("updatedAt = ?"); vals.push(updates.updatedAt); }
    if (updates.isArchived !== undefined) { clauses.push("isArchived = ?"); vals.push(updates.isArchived ? 1 : 0); }
    if (clauses.length === 0) return;
    vals.push(id);
    await this.db.execute(`UPDATE conversations SET ${clauses.join(", ")} WHERE id = ?`, vals);
  }

  async deleteConversation(id: string) {
    await this.db.execute(`DELETE FROM messages WHERE conversationId = ?`, [id]);
    await this.db.execute(`DELETE FROM conversations WHERE id = ?`, [id]);
  }

  async deleteMessagesAfter(conversationId: string, messageId: string) {
    const target = await this.db.select<MessageRow[]>(`SELECT createdAt FROM messages WHERE id = ?`, [messageId]);
    if (target.length === 0) return;
    await this.db.execute(`DELETE FROM messages WHERE conversationId = ? AND createdAt >= ?`, [conversationId, target[0].createdAt]);
  }

  async createUser(user: any) {
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO users (id, email, passwordHash, fullName, status, avatarUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.passwordHash, user.fullName, user.status, user.avatarUrl, now, now],
    );
  }

  async getUserByEmail(email: string) {
    const res = await this.db.select<UserRow[]>(`SELECT * FROM users WHERE email = ?`, [email]);
    return res[0] ?? null;
  }

  async getUserById(id: string) {
    const res = await this.db.select<UserRow[]>(`SELECT * FROM users WHERE id = ?`, [id]);
    return res[0] ?? null;
  }

  async createSession(session: any) {
    await this.db.execute(
      `INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [session.id, session.userId, session.token, session.expiresAt, new Date().toISOString()],
    );
  }

  async getSessionByToken(token: string) {
    const res = await this.db.select<SessionRow[]>(`SELECT * FROM sessions WHERE token = ?`, [token]);
    return res[0] ?? null;
  }

  async deleteSession(token: string) {
    await this.db.execute(`DELETE FROM sessions WHERE token = ?`, [token]);
  }

  async updateUserStatus(userId: string, status: string) {
    await this.db.execute(`UPDATE users SET status = ?, updatedAt = ? WHERE id = ?`, [status, new Date().toISOString(), userId]);
  }
}

// --- Orchestration ---

let activeAdapter: StorageAdapter | null = null;

async function setupSchema(db: Database) {
  await db.execute(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT, createdAt TEXT, updatedAt TEXT, isArchived INTEGER DEFAULT 0)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversationId TEXT, role TEXT, content TEXT, createdAt TEXT, attachments TEXT, model TEXT, thinking TEXT, thinkingDuration REAL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, passwordHash TEXT NOT NULL, fullName TEXT, status TEXT DEFAULT 'Active', avatarUrl TEXT, createdAt TEXT, updatedAt TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId TEXT, token TEXT UNIQUE NOT NULL, expiresAt TEXT, createdAt TEXT, FOREIGN KEY(userId) REFERENCES users(id))`);
}

async function runMigrations(db: Database) {
  // Model/Thinking columns check
  try {
    const cols = await db.select<{ name: string }[]>("PRAGMA table_info(messages)");
    const has = (n: string) => cols.some((c) => c.name === n);
    if (!has("model")) await db.execute("ALTER TABLE messages ADD COLUMN model TEXT");
    if (!has("thinking")) await db.execute("ALTER TABLE messages ADD COLUMN thinking TEXT");
    if (!has("thinkingDuration")) await db.execute("ALTER TABLE messages ADD COLUMN thinkingDuration REAL");
    if (!has("attachments")) await db.execute("ALTER TABLE messages ADD COLUMN attachments TEXT");
  } catch (err) { console.error("[db] Migration error (messages):", err); }

  try {
    const cols = await db.select<{ name: string }[]>("PRAGMA table_info(conversations)");
    if (!cols.some(c => c.name === "isArchived")) await db.execute("ALTER TABLE conversations ADD COLUMN isArchived INTEGER DEFAULT 0");
  } catch (err) { console.error("[db] Migration error (conversations):", err); }
}

export async function initDB() {
  if (activeAdapter) return;

  try {
    const db = await Database.load("sqlite:chat.db");
    await setupSchema(db);
    await runMigrations(db);
    activeAdapter = new SqliteAdapter(db);
    if (DEV) console.log("[db] SQLite active");
  } catch (error) {
    if (DEV) console.warn("[db] SQL plugin unavailable, falling back to in-memory.", error);
    activeAdapter = new InMemoryAdapter();
  }
}

function getAdapter(): StorageAdapter {
  if (!activeAdapter) throw new Error("DB not initialized");
  return activeAdapter;
}

// --- Public API ---

export const createConversation = (id: string, title: string) => getAdapter().createConversation(id, title);
export const getConversations = () => getAdapter().getConversations();
export const addMessage = (msg: any) => getAdapter().addMessage(msg);
export const getMessages = (id: string, l?: number, o?: number) => getAdapter().getMessages(id, l, o);
export const updateConversation = (id: string, u: any) => getAdapter().updateConversation(id, u);
export const deleteConversation = (id: string) => getAdapter().deleteConversation(id);
export const deleteMessagesAfter = (cid: string, mid: string) => getAdapter().deleteMessagesAfter(cid, mid);
export const createUser = (u: any) => getAdapter().createUser(u);
export const getUserByEmail = (e: string) => getAdapter().getUserByEmail(e);
export const getUserById = (id: string) => getAdapter().getUserById(id);
export const createSession = (s: any) => getAdapter().createSession(s);
export const getSessionByToken = (t: string) => getAdapter().getSessionByToken(t);
export const deleteSession = (t: string) => getAdapter().deleteSession(t);
export const updateUserStatus = (id: string, s: string) => getAdapter().updateUserStatus(id, s);
