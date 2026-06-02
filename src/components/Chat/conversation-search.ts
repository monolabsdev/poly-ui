import type { Conversation } from "@/types/chat";

export function filterSearchConversations(conversations: Conversation[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return conversations.filter(
    (conversation) =>
      !conversation.isArchived &&
      !conversation.isTemporary &&
      (!normalizedQuery || conversation.title.toLocaleLowerCase().includes(normalizedQuery)),
  );
}
