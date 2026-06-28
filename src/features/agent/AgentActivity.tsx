import { useState } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { useDevStore } from "@/store/devStore";
import type { AgentApproval, AgentMessageState } from "./types";
import { AgentReviewPanel } from "./AgentReviewPanel";
import { AgentTrace, AgentTraceContent, AgentTraceItem, AgentTraceStep, AgentTraceTrigger } from "@/components/ui/agent-trace";
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
  const waitMsg = useHeaderStatus(agent, steps);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPath, setReviewPath] = useState<string | undefined>();
  const devMode = useDevStore((state) => state.devMode);

  const handleReview = (path?: string) => {
    setReviewPath(path);
    setReviewOpen(true);
  };

  return (
    <Box>
      <AgentRunHeader elapsed={elapsed} status={status} waitingMessage={waitMsg} />

      {steps.length > 0 && (
        <AgentTrace>
          {steps.map((step) => (
            <AgentTraceStep
              key={step.id}
              status={step.status}
              defaultExpanded={step.defaultExpanded}
              hasContent={hasDisclosureContent(step)}
            >
              <AgentTraceTrigger>{step.label}</AgentTraceTrigger>
              {hasDisclosureContent(step) && (
                <AgentTraceContent>
                  {step.summary && (
                    <AgentTraceItem>
                      {step.status === "running" ? <TextShimmer duration={3} spread={15}>{step.summary}</TextShimmer> : step.summary}
                    </AgentTraceItem>
                  )}
                  {step.details?.map((detail) => <AgentTraceItem key={detail}>{detail}</AgentTraceItem>)}
                  {step.type === "editing" && step.files && <EditingContent files={step.files} onReview={handleReview} />}
                  {step.type === "approval" && step.approval && (
                    <ApprovalContent agent={agent} approval={step.approval} onResolveApproval={onResolveApproval} onReview={handleReview} />
                  )}
                  {step.type === "error" && step.errorDetail && <ErrorContent error={step.errorDetail} onRetry={onRetry} />}
                  {step.type === "command" && step.command && <CommandContent call={step.command} />}
                </AgentTraceContent>
              )}
            </AgentTraceStep>
          ))}
        </AgentTrace>
      )}

      {agent.editedFiles.length > 0 && <EditedFilesSummaryCard files={agent.editedFiles} onReview={handleReview} />}

      <AgentReviewPanel open={reviewOpen} workspacePath={agent.workspacePath} initialPath={reviewPath} fallbackFiles={agent.editedFiles} toolCalls={agent.toolCalls} onClose={() => setReviewOpen(false)} />

      {import.meta.env.DEV && devMode && <AgentDebugTrace agent={agent} />}
    </Box>
  );
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
    <Box
    >
      <Box>
        <Box>{status.icon}</Box>
      </Box>
      <Box>
        <Typography>
          {elapsed ? `Worked for ${elapsed}` : "Working"}
        </Typography>
        {waitingMessage && (
          <Typography>
            {waitingMessage}
          </Typography>
        )}
        <Box>
          <Box
          >
            {status.label}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

