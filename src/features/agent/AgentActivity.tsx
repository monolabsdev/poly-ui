import { useState } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import type { AgentApproval, AgentMessageState } from "./types";
import { AgentBrowserCard } from "./AgentBrowserCard";
import { AgentReviewPanel } from "./AgentReviewPanel";
import { openViewportFile } from "./viewportStore";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/ui/chain-of-thought";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { AgentDebugTrace } from "./activity/AgentDebugTrace";
import { buildSteps, hasDisclosureContent } from "./activity/buildSteps";
import { ApprovalContent } from "./activity/content/ApprovalContent";
import { CommandContent } from "./activity/content/CommandContent";
import { EditingContent, EditedFilesSummaryCard } from "./activity/content/EditingContent";
import { ErrorContent } from "./activity/content/ErrorContent";
import { agentResult } from "./activity/summaries";
import { statusMeta, useElapsed, useHeaderStatus } from "./activity/status";

type AgentActivityProps = {
  agent: AgentMessageState;
  resultText?: string;
  onResolveApproval?: (
    kind: "approve" | "reject",
    approval: AgentApproval,
  ) => Promise<void> | void;
  onRetry?: () => void;
};

export function AgentActivity({ agent, resultText, onResolveApproval, onRetry }: AgentActivityProps) {
  const elapsed = useElapsed(agent.startedAt, agent.status, agent.completedAt);
  const result = agentResult(agent, resultText);
  const status = statusMeta(agent.status, result);
  const steps = buildSteps(agent);
  const hasFileStep = steps.some((step) => step.files?.length);
  const waitMsg = useHeaderStatus(agent, steps);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPath, setReviewPath] = useState<string | undefined>();

  const handleReview = (path?: string) => {
    setReviewPath(path);
    setReviewOpen(true);
  };

  const handlePreview = (path: string) => {
    if (!agent.workspacePath) return;
    void openViewportFile({
      runId: agent.runId ?? `manual:${agent.startedAt}`,
      chatId: null,
      workspacePath: agent.workspacePath,
      path,
      reason: "Opened manually",
    });
  };

  return (
    <Box>
      <AgentRunHeader elapsed={elapsed} status={status} waitingMessage={waitMsg} />

      {result.detail && (agent.status === "failed" || steps.length === 0) && (
        <Box className="mb-3 rounded-2xl border border-border/60 bg-background/50 px-3 py-2">
          <Typography className="text-sm text-foreground">
            {result.detail}
          </Typography>
        </Box>
      )}

      {steps.length > 0 && (
        <ChainOfThought>
          {steps.map((step) => (
            <ChainOfThoughtStep
              key={step.id}
              isActive={step.status === "running"}
              defaultExpanded={step.defaultExpanded}
            >
              <ChainOfThoughtTrigger>{step.label}</ChainOfThoughtTrigger>
              {hasDisclosureContent(step) && (
                <ChainOfThoughtContent>
                  {step.summary && (
                    <ChainOfThoughtItem>
                      {step.status === "running" ? <TextShimmer duration={3} spread={15}>{step.summary}</TextShimmer> : step.summary}
                    </ChainOfThoughtItem>
                  )}
                  {step.details?.map((detail) => <ChainOfThoughtItem key={detail}>{detail}</ChainOfThoughtItem>)}
                  {step.type === "editing" && step.files && (
                    <EditingContent
                      files={step.files}
                      onReview={handleReview}
                      onPreview={agent.workspacePath ? handlePreview : undefined}
                    />
                  )}
                  {step.type === "approval" && step.approval && (
                    <ApprovalContent agent={agent} approval={step.approval} onResolveApproval={onResolveApproval} onReview={handleReview} />
                  )}
                  {step.type === "error" && step.errorDetail && <ErrorContent error={step.errorDetail} onRetry={onRetry} />}
                  {step.type === "command" && step.command && <CommandContent call={step.command} />}
                  <RawStepTrace agent={agent} stepId={step.id} />
                </ChainOfThoughtContent>
              )}
            </ChainOfThoughtStep>
          ))}
        </ChainOfThought>
      )}

      <AgentBrowserCard runId={agent.runId} />

      {agent.editedFiles.length > 0 && !hasFileStep && (
        <EditedFilesSummaryCard
          files={agent.editedFiles}
          onReview={handleReview}
          onPreview={agent.workspacePath ? handlePreview : undefined}
        />
      )}

      <AgentReviewPanel open={reviewOpen} workspacePath={agent.workspacePath} initialPath={reviewPath} fallbackFiles={agent.editedFiles} toolCalls={agent.toolCalls} onClose={() => setReviewOpen(false)} />

      <AgentDebugTrace agent={agent} />
    </Box>
  );
}

function RawStepTrace({ agent, stepId }: { agent: AgentMessageState; stepId: string }) {
  const events = (agent.debugEvents ?? []).filter((event) => rawEventKey(event.value) === stepId);
  const call = agent.toolCalls[stepId];
  if (!events.length && !call) return null;

  return (
    <ChainOfThoughtItem className="mt-2">
      <details className="rounded-lg border border-border/60 bg-muted/30">
        <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-muted-foreground">
          Raw trace
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-border/60 p-2 text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify({ toolCall: call, events }, null, 2)}
        </pre>
      </details>
    </ChainOfThoughtItem>
  );
}

function rawEventKey(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.tool_call_id === "string" ? record.tool_call_id : undefined;
}
function AgentRunHeader({
  elapsed,
  status,
  waitingMessage,
}: {
  elapsed: string | null;
  status: ReturnType<typeof statusMeta>;
  waitingMessage?: string;
}) {
  return (
    <Box className="mb-3 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2">
      <Box className="flex items-center gap-3">
        <Box className="flex size-7 items-center justify-center rounded-full bg-background/70 text-muted-foreground">
          {status.icon}
        </Box>
      <Box className="min-w-0 flex-1">
        <Typography className="text-sm font-medium text-foreground">
          {elapsed ? `Worked for ${elapsed}` : "Working"}
        </Typography>
        {waitingMessage && (
          <Typography className="text-xs text-muted-foreground">
            {waitingMessage}
          </Typography>
        )}
      </Box>
        <Box className="rounded-full bg-background/70 px-2 py-1 text-xs text-muted-foreground">
          {status.label}
        </Box>
      </Box>
    </Box>
  );
}
