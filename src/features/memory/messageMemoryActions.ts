import { useSettingsStore } from "@/store/settingsStore";
import { getCurrentProviderAccountId } from "@/services/providers";
import { memoryDelete, memoryGetRelated, memoryRememberMessage } from "./memoryClient";

function summarize(content: string) {
  return content.trim().replace(/\s+/g, " ").slice(0, 180);
}

export function isMemoryUiEnabled() {
  return useSettingsStore.getState().general.experimentalFeatures;
}

export async function rememberMessageMemory(input: {
  messageId?: string;
  conversationId?: string;
  content: string;
}) {
  const ownerId = getCurrentProviderAccountId();
  const summary = summarize(input.content);
  if (!ownerId || !input.messageId || !summary) return "Memory unavailable";
  await memoryRememberMessage({
    ownerId,
    scope: "user",
    scopeOwnerId: ownerId,
    category: "other",
    canonicalKey: null,
    value: input.content,
    summary,
    confidence: 0.9,
    importance: 0.55,
    sourceChatId: input.conversationId ?? null,
    sourceMessageIds: [input.messageId],
  });
  return "Memory saved";
}

export async function forgetMessageMemory(input: {
  messageId?: string;
  content: string;
}) {
  const ownerId = getCurrentProviderAccountId();
  if (!ownerId || !input.messageId) return "Memory unavailable";
  const related = await memoryGetRelated(ownerId, input.messageId, summarize(input.content));
  const sourced = related.filter((record) => record.sourceMessageIds.includes(input.messageId!));
  if (sourced.length === 0) return "No memory saved from this message";
  await Promise.all(sourced.map((record) => memoryDelete(ownerId, record.id)));
  return `Forgot ${sourced.length} memory${sourced.length === 1 ? "" : "ies"}`;
}

export async function relatedMessageMemory(input: {
  messageId?: string;
  content: string;
}) {
  const ownerId = getCurrentProviderAccountId();
  if (!ownerId || !input.messageId) return [];
  return memoryGetRelated(ownerId, input.messageId, summarize(input.content));
}
