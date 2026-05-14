import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "@/store/chatStore";
import { ChatMessage } from "@/types/chat";

const TITLE_PROMPT = `Generate a short chat title.

Rules:
- 2 or 3 words only
- No extra text
- No explanations
- No conversation
- No punctuation
- No quotes
- No lowercase filler words
- Only keywords

Examples:
Rust Streams
React Setup
Memory Leak
Auth Error
Ollama Install

Title:`;

interface NameConversationDeps {
  invoke: typeof invoke;
  renameConversation: (id: string, title: string) => Promise<void>;
}

export function createConversationNamer(deps: NameConversationDeps) {
  return {
    async nameConversation(
      conversationId: string,
      messages: ChatMessage[],
      model: string,
    ): Promise<string> {
      if (messages.length === 0) {
        return "Empty Chat";
      }

      const conversationMessages = messages.slice(-6);
      const formattedHistory = conversationMessages
        .map((m) => `${m.role}: ${m.content.substring(0, 200)}`)
        .join("\n");

      const prompt = `${TITLE_PROMPT}\n\nConversation:\n${formattedHistory}`;

      try {
        const title = await deps.invoke<string>("chat", {
          model,
          messages: [{ role: "user", content: prompt }],
          options: {
            temperature: 0,
            top_p: 0.1,
            repeat_penalty: 1.4,
            num_predict: 4,
            stop: ["\n"],
          },
        });

        const cleaned = cleanTitle(title);
        await deps.renameConversation(conversationId, cleaned);
        return cleaned;
      } catch (error) {
        console.error("Failed to generate title:", error);
        return "New Chat";
      }
    },
  };
}

function cleanTitle(title: string): string {
  const firstLine = title.trim().split("\n")[0];
  const cleaned = firstLine
    .replace(/^["']|["']$/g, "")
    .replace(/^(title:|short title:|summary:|here is|output:|result:)\s*/i, "")
    .replace(/^(welcome|conversation|summary)\s+/i, "")
    .toLowerCase();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 3);

  if (words.length === 0) return "New Chat";

  const result = words.join(" ");

  const forbidden = [
    "welcome",
    "conversation",
    "summary",
    "title",
    "here",
    "generate",
    "output",
    "result",
  ];
  if (forbidden.some((f) => result.toLowerCase().includes(f))) return "New Chat";

  return result;
}

export const conversationNamer = createConversationNamer({
  invoke,
  renameConversation: (id, title) =>
    useChatStore.getState().actions.renameConversation(id, title),
});

export async function shouldAutoName(conversationId: string): Promise<boolean> {
  const { conversations, messages } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return false;

  const hasDefaultTitle = conversation.title === "New Chat";

  const conversationMessages = messages.filter(
    (m) => m.conversationId === conversationId,
  );
  const hasAssistantMessage = conversationMessages.some(
    (m) => m.role === "assistant" && m.content.trim().length > 0,
  );

  return hasDefaultTitle && hasAssistantMessage;
}
