# Domain Language

## Core Concepts

- **Conversation** — persistent chat session, collection of UserMessages and AssistantMessages
- **Message** — single turn in a conversation. Role: `user`, `assistant`, or `tool`
- **Stream** — real-time token-by-token delivery of assistant response via Tauri events
- **Tool Loop** — iterative cycle: model generates stream → tool call detected → tool executed → result fed back → model generates next stream
- **Multi-Model Stream** — sending same user message to N models simultaneously; each gets own `request_id`
- **Title Generation** — auto-naming conversation after first assistant response using LLM call

## Architecture Nouns

- **Event Bus** — typed pub/sub over Tauri events (`chat-chunk`, `chat-thinking`, `web-search-event`)
- **Stream Accumulator** — pure content accumulation logic (no React), batches token updates via rAF
- **Stream Client** — typed wrapper around Tauri event listeners; single stable subscription per hook lifetime
- **Provider** — abstraction over an LLM backend (currently only OllamaLocal). Implements `LLMProvider` trait
- **Tool Loop** — orchestrates streaming + tool calling + web search in a loop until no tool call
- **Stream Emitter** — trait for emitting stream events (Tauri impl + test spy)
- **Web Search Client** — trait for search backends (Exa impl + mock for tests)
- **Repository** — data access seam for conversations/messages (SQLite impl + in-memory impl for fallback + tests)
- **Store Coordinator** — one-directional effect: subscribes to auth changes, dispatches to chat store

## Module Map (Rust)

```
error.rs           — AppError enum (Db, Provider, Network, Parse, Cancelled, Message)
stream_emitter.rs  — StreamEmitter trait + TauriStreamEmitter + TestStreamEmitter
tool_loop.rs       — ToolLoop struct + ThinkingTagParser (extracted from chat_commands)
web_search.rs      — WebSearchClient trait + ExaWebSearchClient + MockWebSearchClient
```

## Module Map (TypeScript)

```
lib/chat/stream-client.ts      — EventBus interface + TauriEventBus
lib/chat/stream-accumulator.ts — StreamAccumulator (pure, no React)
lib/chat/event-bus.ts          — backward-compat re-exports
store/coordinator.ts           — auth → chat one-directional effect
```

## Conventions

- Rust commands are thin adapters; domain logic lives in pure functions or trait impls
- Zustand stores MUST NOT import each other. Cross-store data flow goes through coordinator effects
- Frontend repository has a `setRepository()` injection seam for tests
- `execute_sql` command gated behind `dev-sql-console` feature flag; disabled by default
