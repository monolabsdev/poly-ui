import type { Role, Attachment, WebSearchEvent } from "@/types/chat";
import type { AgentMessageState } from "@/features/agent/types";

export interface MessageProps {
  role: Role;
  id?: string;
  conversationId?: string;
  content: string;
  attachments?: Attachment[];
  messageIndex?: number;
  model?: string;
  thinking?: string;
  thinkingDuration?: number;
  isThinking?: boolean;
  isStreaming?: boolean;
  status?: "queued" | "streaming" | "complete" | "error" | "aborted";
  errorMessage?: string;
  onRegenerate?: (messageIndex: number) => void;
  webSearch?: WebSearchEvent;
  agent?: AgentMessageState;
  isLastMessage?: boolean;
}
