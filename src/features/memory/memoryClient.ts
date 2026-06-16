import { invoke } from "@tauri-apps/api/core";
import type {
  MemoryForgetMessageInput,
  MemoryListQuery,
  MemoryRecord,
  MemoryRememberMessageInput,
  MemoryScope,
  MemorySearchQuery,
  MemorySettings,
} from "./types";

export function memoryGetSettings(ownerId: string) {
  return invoke<MemorySettings>("memory_get_settings", { ownerId });
}

export function memoryUpdateSettings(settings: MemorySettings) {
  return invoke<MemorySettings>("memory_update_settings", { settings });
}

export function memoryTestConnection(ownerId: string) {
  return invoke<{ ok: boolean; provider: string; locality: string; message: string }>(
    "memory_test_connection",
    { ownerId },
  );
}

export function memoryList(query: MemoryListQuery) {
  return invoke<MemoryRecord[]>("memory_list", { query });
}

export function memorySearch(query: MemorySearchQuery) {
  return invoke<MemoryRecord[]>("memory_search", { query });
}

export function memoryUpdate(input: {
  ownerId: string;
  memoryId: string;
  category?: MemoryRecord["category"] | null;
  canonicalKey?: string | null;
  value?: unknown;
  summary?: string | null;
  confidence?: number | null;
  importance?: number | null;
}) {
  return invoke<MemoryRecord>("memory_update", { input });
}

export function memoryDelete(ownerId: string, memoryId: string) {
  return invoke<void>("memory_delete", { ownerId, memoryId });
}

export function memoryClearScope(ownerId: string, scope: MemoryScope, scopeOwnerId?: string | null) {
  return invoke<void>("memory_clear_scope", { ownerId, scope, scopeOwnerId: scopeOwnerId ?? null });
}

export function memoryClearAll(ownerId: string) {
  return invoke<void>("memory_clear_all", { ownerId });
}

export function memoryRememberMessage(input: MemoryRememberMessageInput) {
  return invoke("memory_remember_message", { input });
}

export function memoryForgetMessage(input: MemoryForgetMessageInput) {
  return invoke<void>("memory_forget_message", { input });
}

export function memoryGetRelated(ownerId: string, messageId: string, query: string) {
  return invoke<MemoryRecord[]>("memory_get_related", {
    query: { ownerId, messageId, query, limit: 8 },
  });
}

export async function disableMemoryForOwner(ownerId: string) {
  if (!ownerId) return;
  const settings = await memoryGetSettings(ownerId);
  if (!settings.enabled) return;
  await memoryUpdateSettings({
    ...settings,
    enabled: false,
    automaticExtraction: false,
    provider: "disabled",
  });
}
