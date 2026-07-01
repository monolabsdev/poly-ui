import { useState, useEffect } from "react";
import {
  Copy,
  MoreHorizontal,
  RotateCcw,
  Check,
  AlertCircle,
  StopCircle,
  Volume2,
  Square,
  Brain,
  Trash2,
  Search,
} from "lucide-react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { IconButton } from "@/components/ui/icon-button";
import { TooltipLabel as Tooltip } from "@/components/ui/tooltip-label";
import { CircularProgress } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/useNotify";

import { ThinkingDisclosure } from "./ThinkingDisclosure";
import { WebSearchDisclosure } from "./WebSearchDisclosure";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/sources";

import type { MessageProps } from "./types";
import {
  useMessageStreaming,
  useMessageMarkdown,
  useMessageTts,
} from "./hooks";
import { MarkdownProse } from "./MarkdownProse";
import { AgentActivity } from "@/features/agent/AgentActivity";
import {
  approveAgentToolCall,
  getAgentRunState,
  rejectAgentToolCall,
} from "@/features/agent/agentClient";
import type { AgentApproval } from "@/features/agent/types";
import {
  forgetMessageMemory,
  isMemoryUiEnabled,
  relatedMessageMemory,
  rememberMessageMemory,
} from "@/features/memory/messageMemoryActions";

function agentResultText(agent: NonNullable<MessageProps["agent"]>, content: string): string | undefined {
  const text = content.trim();
  if (!text) return undefined;
  if (agent.status === "failed") return text;
  if (agent.editedFiles.length > 0) return text;
  if (agent.approvals.length > 0) return text;
  if (agent.request?.fileEditRequested) return text;
  if (looksLikeClarification(text)) return text;
  if (isFallbackAgentContent(text)) return text;
  return undefined;
}

function isFallbackAgentContent(content: string): boolean {
  const trimmed = content.trim();
  return /^(I tried|I edited|I created|The Poly Agent)/i.test(trimmed);
}

function looksLikeClarification(text: string) {
  return /\b(clarif|ambiguous|need (more|additional|details|information)|please specify|which file)\b/i.test(text);
}

export function AssistantMessage(props: MessageProps) {
  const {
    content,
    id,
    conversationId,
    messageIndex,
    model,
    thinking,
    thinkingDuration,
    isThinking,
    isStreaming,
    status,
    errorMessage,
    onRegenerate,
    webSearch,
    agent,
    isLastMessage,
  } = props;

  const [copied, setCopied] = useState(false);
  const [webSearchExpanded, setWebSearchExpanded] = useState(false);
  const notify = useNotify();

  const streamingDisplayContent = useMessageStreaming(content, isStreaming);
  const { processedContent, processedThinking } = useMessageMarkdown(
    content,
    thinking,
    isStreaming,
  );
  const { isSpeaking, isGenerating, handleSpeak } = useMessageTts(
    messageIndex,
    content,
  );

  const canRegenerate =
    typeof messageIndex === "number" && typeof onRegenerate === "function";
  const showEmptyFinalNotice =
    !isStreaming &&
    status !== "error" &&
    status !== "aborted" &&
    !agent &&
    !content.trim() &&
    Boolean(thinking?.trim());
  const agentBodyText = agent ? agentResultText(agent, content) : undefined;

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard
      ?.writeText(content)
      .then(() => {
        setCopied(true);
        notify.success("Copied to clipboard");
      })
      .catch(() => {
        notify.error("Failed to copy");
      });
  };

  const handleAgentApproval = async (kind: "approve" | "reject", approval: AgentApproval) => {
    if (!agent?.runId) return;
    try {
      const state = await getAgentRunState(agent.runId).catch(() => null);
      const approvalId = state?.pending_approval?.approval_id ?? approval.approvalId;
      if (kind === "approve") {
        await approveAgentToolCall(agent.runId, approvalId);
        return;
      }
      await rejectAgentToolCall(agent.runId, approvalId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("no pending approval")) return;
      notify.error("Approval failed", message);
      throw err;
    }
  };

  const handleRemember = async () => {
    try {
      notify.success(await rememberMessageMemory({ messageId: id, conversationId, content }));
    } catch (error) {
      notify.error("Memory save failed", String(error));
    }
  };

  const handleForget = async () => {
    try {
      notify.success(await forgetMessageMemory({ messageId: id, content }));
    } catch (error) {
      notify.error("Memory delete failed", String(error));
    }
  };

  const handleRelated = async () => {
    try {
      const related = await relatedMessageMemory({ messageId: id, content });
      notify.info(
        related.length ? `${related.length} related ${related.length === 1 ? "memory" : "memories"}` : "No related memories",
        related.slice(0, 3).map((record) => record.summary).join("\n"),
      );
    } catch (error) {
      notify.error("Memory lookup failed", String(error));
    }
  };

  return (
    <Box
      className="group/message mr-auto flex w-full max-w-[min(100%,48rem)] flex-col gap-2"
    >
      <Box className="rounded-3xl rounded-tl-md bg-card px-4 py-3 text-card-foreground">
        {model && !agent && (
          <Typography
            variant="caption"
            color="text.secondary"
            className="mb-2 block"
          >
            {model}
          </Typography>
        )}

         {status === "error" && !agent && (
          <Box
            className="mb-3 flex gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-destructive"
          >
            <AlertCircle size={18} />
            <Box>
              <Typography
                variant="caption"
                weight="medium"
              >
                Generation Error
              </Typography>
              <Typography
                variant="body2"
                className="text-current"
              >
                {errorMessage || "The provider encountered an issue."}
              </Typography>
              {onRegenerate && typeof messageIndex === "number" && (
                <IconButton
                  size="small"
                  onClick={() => onRegenerate(messageIndex)}
                  className="mt-2 rounded-full"
                >
                  <RotateCcw size={14} />
                  <Typography variant="caption">
                    Retry
                  </Typography>
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {status === "aborted" && (
          <Box
            className="mb-3 flex items-center gap-2 text-muted-foreground"
          >
            <StopCircle size={14} />
            <Typography
              variant="caption"
            >
              Generation stopped by user
            </Typography>
          </Box>
        )}

        <ThinkingDisclosure
          thinking={thinking}
          isThinking={isThinking ?? false}
          thinkingDuration={thinkingDuration}
          processedThinking={processedThinking}
          status={status}
        />

        {webSearch && (
          <Box>
            <WebSearchDisclosure
              isSearching={webSearch.status === "searching"}
              query={webSearch.query}
              results={webSearch.results}
              isExpanded={webSearchExpanded}
              onToggle={() => setWebSearchExpanded((v) => !v)}
            />
          </Box>
        )}

        {agent && (
          <AgentActivity
            agent={agent}
            resultText={agentBodyText}
            onResolveApproval={handleAgentApproval}
            onRetry={canRegenerate && typeof messageIndex === "number" ? () => onRegenerate(messageIndex) : undefined}
          />
        )}

        {/* ── Markdown Core Message Body ── */}
        {content && (!agent || !agentBodyText) ? (
          <Box
            id={`message-${messageIndex}`}
            className="min-w-0"
          >
            {isStreaming ? (
              <Typography
                as="p"
                className="whitespace-pre-wrap text-sm leading-6"
              >
                {streamingDisplayContent || content}
              </Typography>
            ) : (
              <MarkdownProse content={processedContent} />
            )}
          </Box>
        ) : showEmptyFinalNotice ? (
          <Box
            id={`message-${messageIndex}`}
            className="text-sm text-muted-foreground"
          >
            The model returned reasoning but no final response.
          </Box>
        ) : null}

        {/* ── Source Badges ── */}
        {!isStreaming && webSearch?.results && webSearch.results.length > 0 && (
            <Box
              className="mt-3 flex flex-wrap gap-2"
            >
              {webSearch.results.map((result) => (
                <Source key={result.url} href={result.url}>
                  <SourceTrigger showFavicon />
                  <SourceContent
                    title={result.title}
                    description={result.highlights?.join(" ") || ""}
                  />
                </Source>
              ))}
            </Box>
          )}

        {/* ── Contextual Action Toolbar ── */}
        <Box
          className={`${!isLastMessage ? "action-bar " : ""}mt-2 flex items-center gap-1 text-muted-foreground transition-opacity`}
        >
          <Tooltip title={copied ? "Copied" : "Copy"}>
            <IconButton
              size="small"
              onClick={handleCopy}
              className="size-7 rounded-full"
            >
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 14,
                    height: 14,
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Box>
            </IconButton>
          </Tooltip>

          {typeof messageIndex === "number" && (
            <Tooltip title={isSpeaking ? "Stop reading" : "Read message"}>
              <IconButton
                size="small"
                onClick={handleSpeak}
                disabled={isStreaming || (isGenerating && !isSpeaking)}
                className="size-7 rounded-full"
              >
                {isGenerating ? (
                  <CircularProgress size={14} color="inherit" />
                ) : isSpeaking ? (
                  <Square size={14} />
                ) : (
                  <Volume2 size={14} />
                )}
              </IconButton>
            </Tooltip>
          )}

          {canRegenerate && (
            <Tooltip title="Regenerate">
              <IconButton
                size="small"
                onClick={() => onRegenerate(messageIndex)}
                className="size-7 rounded-full"
              >
                <RotateCcw size={14} />
              </IconButton>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="small"
                className="size-7 rounded-full"
              >
                <MoreHorizontal size={14} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isMemoryUiEnabled() && (
                <>
                  <DropdownMenuItem onClick={handleRemember}>
                    <Brain size={14} />
                    Remember this
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleForget}>
                    <Trash2 size={14} />
                    Forget this
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRelated}>
                    <Search size={14} />
                    View related memories
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={handleCopy}>
                <Copy size={14} />
                Copy message
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const plain = content
                    .replace(/[#*`~\[\]()>|\\]/g, "")
                    .replace(/\n{3,}/g, "\n\n");
                  navigator.clipboard.writeText(plain).then(() => {
                    notify.success("Copied as plain text");
                  });
                }}
              >
                <Copy size={14} />
                Copy as plain text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      </Box>
    </Box>
  );
}
