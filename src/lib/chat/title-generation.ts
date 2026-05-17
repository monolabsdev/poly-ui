import { loggedInvoke } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import type { ChatMessage } from "@/types/chat";

type BackendChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: {
    type: string;
    content?: string;
  }[];
};

type GenerateTitleArgs = {
  conversationId: string;
  model: string;
  userName?: string;
};

const pendingTitleGenerations = new Set<string>();
const TITLE_GENERATION_DELAY_MS = 250;

export function shouldGenerateTitle(conversationId: string): boolean {
  if (pendingTitleGenerations.has(conversationId)) return false;

  const { conversations, messages } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || conversation.isTemporary) return false;
  if ((conversation.title || "New Chat") !== "New Chat") return false;

  const conversationMessages = messages.filter(
    (message) => message.conversationId === conversationId,
  );
  const userCount = conversationMessages.filter((message) => message.role === "user").length;
  const assistantCount = conversationMessages.filter(
    (message) => message.role === "assistant",
  ).length;

  return userCount === 1 && assistantCount >= 1;
}

export function queueTitleGeneration({
  conversationId,
  model,
  userName,
}: GenerateTitleArgs): void {
  if (!model || !shouldGenerateTitle(conversationId)) return;
  scheduleTitleGeneration(conversationId, model, userName);
}

export function retryTitleForConversation(conversationId: string): void {
  if (pendingTitleGenerations.has(conversationId)) return;

  const { conversations, messages } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || conversation.isTemporary) return;
  if ((conversation.title || "New Chat") !== "New Chat") return;

  const conversationMessages = messages.filter(
    (message) => message.conversationId === conversationId,
  );
  const hasUserMessage = conversationMessages.some((message) => message.role === "user");
  if (!hasUserMessage) return;

  const lastAssistant = [...conversationMessages]
    .reverse()
    .find((m) => m.role === "assistant");
  const model = lastAssistant?.model ?? "";
  if (!model) return;

  scheduleTitleGeneration(conversationId, model);
}

function scheduleTitleGeneration(
  conversationId: string,
  model: string,
  userName?: string,
): void {
  pendingTitleGenerations.add(conversationId);

  window.setTimeout(() => {
    void generateAndApplyTitle(conversationId, model, userName)
      .catch((error) => {
        console.warn("Title generation failed", error);
      })
      .finally(() => {
        pendingTitleGenerations.delete(conversationId);
      });
  }, TITLE_GENERATION_DELAY_MS);
}

async function generateAndApplyTitle(
  conversationId: string,
  model: string,
  userName?: string,
): Promise<void> {
  const { messages } = useChatStore.getState();
  const conversationMessages = messages
    .filter((message) => message.conversationId === conversationId)
    .slice(-2);

  let title = await loggedInvoke<string | null>("generate_chat_title", {
    model,
    messages: conversationMessages.map(toBackendMessage),
    userName,
  });

  // Fallback: if backend returned nothing, use first user message as title
  if (!title?.trim()) {
    const firstUser = conversationMessages.find((m) => m.role === "user");
    if (firstUser?.content?.trim()) {
      title = makeFallbackTitle(firstUser.content);
    }
  }

  if (!title?.trim()) return;

  const { conversations, actions } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || (conversation.title || "New Chat") !== "New Chat") return;

  await actions.renameConversation(conversationId, title.trim());
}

function makeFallbackTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  const truncated = words.slice(0, 8).join(" ");
  return truncated.length > 80 ? truncated.slice(0, 80) : truncated;
}

function toBackendMessage(message: ChatMessage): BackendChatMessage {
  return {
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((attachment) => ({
      type: attachment.type,
      content: attachment.content,
    })),
  };
}
