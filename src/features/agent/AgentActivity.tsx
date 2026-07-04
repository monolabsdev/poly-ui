import { useState } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import type { AgentApproval, AgentMessageState } from "./types";
import { AgentBrowserCard } from "./AgentBrowserCard";
import { AgentReviewPanel } from "./AgentReviewPanel";
import { Steps, StepsContent, StepsItem, StepsTrigger } from "@/components/ui/steps";
import { openViewportFile } from "./viewportStore";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { buildSteps, hasDisclosureContent } from "./activity/buildSteps";
import { ApprovalContent } from "./activity/content/ApprovalContent";
import { CommandContent } from "./activity/content/CommandContent";
import { EditingContent, EditedFilesSummaryCard } from "./activity/content/EditingContent";
import { ErrorContent } from "./activity/content/ErrorContent";
import { agentResult } from "./activity/summaries";
import { statusMeta, useElapsed, useHeaderStatus } from "./activity/status";
import { AlertTriangle, Check, Circle, LoaderCircle, ShieldAlert } from "lucide-react";
import type { StepStatus } from "@/components/ui/agent-trace";

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
        <Box className="flex flex-col gap-3">
          {steps.map((step) => (
            <Steps
              key={step.id}
              defaultOpen={step.defaultExpanded || step.status === "running" || step.status === "waiting" || step.status === "error"}
              className="group/step"
            >
              <StepsTrigger
                leftIcon={<StepStatusIcon status={step.status} />}
                swapIconOnHover={hasDisclosureContent(step)}
                className="w-fit max-w-full gap-1.5 rounded-md px-0 py-0 text-[15px] leading-6"
              >
                <span className={step.status === "running" ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {step.label}
                </span>
              </StepsTrigger>
              {hasDisclosureContent(step) ? (
                <StepsContent
                  bar={false}
                  className="mt-2 rounded-lg border border-border/70 bg-background/30 px-3 py-2 shadow-sm"
                >
                  {step.summary && (
                    <StepsItem className="px-1 text-[15px] leading-6">
                      {step.status === "running" ? <TextShimmer duration={3} spread={15}>{step.summary}</TextShimmer> : step.summary}
                    </StepsItem>
                  )}
                  {step.details?.map((detail) => <StepsItem className="px-1 text-[15px] leading-6" key={detail}>{detail}</StepsItem>)}
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
                </StepsContent>
              ) : null}
            </Steps>
          ))}
        </Box>
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
    </Box>
  );
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <LoaderCircle size={16} className="animate-spin" aria-label="Running" />;
  if (status === "complete") return <Check size={16} aria-label="Completed" />;
  if (status === "error") return <AlertTriangle size={16} aria-label="Failed" />;
  if (status === "waiting") return <ShieldAlert size={16} aria-label="Waiting" />;
  return <Circle size={16} aria-label="Pending" />;
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
    <Box className="mb-4 px-0 py-1">
      <Box className="flex items-center gap-3">
        <Box className="flex size-6 items-center justify-center text-muted-foreground">
          {status.icon}
        </Box>
      <Box className="min-w-0 flex-1">
        <Typography className="text-[15px] font-medium text-muted-foreground">
          {elapsed ? `Worked for ${elapsed}` : "Working"}
        </Typography>
        {waitingMessage && (
          <Typography className="text-sm text-muted-foreground/80">
            {waitingMessage}
          </Typography>
        )}
      </Box>
        <Box className="text-xs text-muted-foreground">
          {status.label}
        </Box>
      </Box>
    </Box>
  );
}
