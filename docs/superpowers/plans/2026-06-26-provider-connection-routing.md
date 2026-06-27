# Provider Connection Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route selected external models through their exact saved provider connection.

**Architecture:** Model catalog responses carry their source provider configuration ID. Frontend model choices retain it and chat sends it to Tauri. Backend selection validates the ID against account and provider type before constructing the client.

**Tech Stack:** Rust, Tauri, sqlx/SQLite, React, TypeScript, Vitest.

## Global Constraints

- Preserve existing selections with no configuration ID through type-based fallback.
- Never silently route a configuration-ID request to another provider.
- Keep provider API keys out of frontend logs and tests.

---

### Task 1: Stamp and resolve provider configurations

**Files:**
- Modify: `src-tauri/src/models/chat.rs`
- Modify: `src-tauri/src/commands/provider_commands.rs`
- Modify: `src-tauri/src/providers/selector.rs`
- Modify: `src-tauri/src/commands/chat_commands.rs`
- Test: Rust unit tests in modified modules

- [ ] Add optional `provider_config_id` to `ModelDetails`.
- [ ] Add a failing selector test proving an OpenAI-compatible configuration ID selects that exact enabled row.
- [ ] Add `ProviderSelector::get_provider_by_config_id` validating ID, account, type, and enabled state.
- [ ] Stamp discovered models with their source configuration ID and pass optional ID through `chat_stream`.
- [ ] Run targeted Rust tests.

### Task 2: Preserve connection identity in model selection

**Files:**
- Modify: `src/features/ollama/types.ts`
- Modify: `src/lib/models/model-choice.ts`
- Modify: `src/store/modelStore.ts`
- Modify: `src/features/chat/components/ModelSelector.tsx`
- Modify: `src/features/chat/components/Header.tsx`
- Modify: `src/features/chat/hooks/useChatStream.ts`
- Test: `tests/modelChoice.test.ts`

- [ ] Add a failing TypeScript test proving same-name models from separate configuration IDs have distinct choice IDs.
- [ ] Add optional `provider_config_id` to model and choice types.
- [ ] Preserve ID when selecting, storing, rendering, and sending a model choice.
- [ ] Run targeted Vitest tests and TypeScript build.
