import { loggedInvoke } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import type { ChatMessage } from "@/types/chat";
import type { ModelProvider } from "@/store/modelStore";
import { getCurrentProviderAccountId } from "@/services/providers";

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
  providerType?: ModelProvider;
};

const pendingTitleGenerations = new Set<string>();
const TITLE_GENERATION_DELAY_MS = 0;

function hasCustomTitle(conversation: { title: string }): boolean {
  return Boolean(conversation.title) && conversation.title !== "New Chat";
}

export function shouldGenerateTitle(conversationId: string): boolean {
  if (pendingTitleGenerations.has(conversationId)) return false;

  const { conversations, messages } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || conversation.isTemporary) return false;
  if (hasCustomTitle(conversation)) return false;

  const conversationMessages = messages.filter(
    (message) => message.conversationId === conversationId,
  );
  const userCount = conversationMessages.filter((message) => message.role === "user").length;

  return userCount === 1;
}

export function queueTitleGeneration({
  conversationId,
  model,
  providerType,
  userName,
}: GenerateTitleArgs): void {
  if (!model || !shouldGenerateTitle(conversationId)) return;
  scheduleTitleGeneration(conversationId, model, providerType, userName);
}

export function retryTitleForConversation(conversationId: string): void {
  if (pendingTitleGenerations.has(conversationId)) return;

  const { conversations, messages } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || conversation.isTemporary) return;
  if (hasCustomTitle(conversation)) return;

  const conversationMessages = messages.filter(
    (message) => message.conversationId === conversationId,
  );
  const hasUserMessage = conversationMessages.some((message) => message.role === "user");
  if (!hasUserMessage) return;

  const lastAssistant = [...conversationMessages]
    .reverse()
    .find((m) => m.role === "assistant");
  const model = lastAssistant?.model ?? "";
  const providerType = lastAssistant?.provider;
  if (!model) return;

  scheduleTitleGeneration(conversationId, model, providerType);
}

function scheduleTitleGeneration(
  conversationId: string,
  model: string,
  providerType?: ModelProvider,
  userName?: string,
): void {
  pendingTitleGenerations.add(conversationId);

  window.setTimeout(() => {
    void generateAndApplyTitle(conversationId, model, providerType, userName)
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
  providerType?: ModelProvider,
  userName?: string,
): Promise<void> {
  const { messages } = useChatStore.getState();
  const conversationMessages = messages
    .filter((message) => message.conversationId === conversationId)
    .slice(-2);

  const title = await loggedInvoke<string | null>("generate_chat_title", {
    model,
    messages: conversationMessages.map(toBackendMessage),
    userName,
    providerType,
    accountId: getCurrentProviderAccountId(),
  });

  if (!title?.trim()) return;

  const { conversations, actions } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || hasCustomTitle(conversation)) return;

  await actions.renameConversation(conversationId, title.trim());
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
