import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Tooltip,
  Typography,
} from "@mui/material";
import { useDevStore } from "@/store/devStore";
import {
  AlertTriangle,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type {
  AgentApproval,
  AgentEditedFile,
  AgentMessageState,
  AgentToolCall,
} from "./types";
import type { StepStatus } from "@/components/ui/agent-trace";
import { AgentReviewPanel } from "./AgentReviewPanel";
import {
  AgentTrace,
  AgentTraceStep,
  AgentTraceTrigger,
  AgentTraceContent,
  AgentTraceItem,
  AgentTraceBadge,
} from "@/components/ui/agent-trace";
import { TextShimmer } from "@/components/ui/text-shimmer";

type AgentActivityProps = {
  agent: AgentMessageState;
  resultText?: string;
  onResolveApproval?: (
    kind: "approve" | "reject",
    approval: AgentApproval,
  ) => Promise<void> | void;
  onRetry?: () => void;
};

export function AgentActivity({
  agent,
  resultText,
  onResolveApproval,
  onRetry,
}: AgentActivityProps) {
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.15,
        my: 1,
        maxWidth: 760,
        pl: 0.5,
        minWidth: 0,
      }}
    >
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
                      {step.status === "running" ? (
                        <TextShimmer duration={3} spread={15}>{step.summary}</TextShimmer>
                      ) : step.summary}
                    </AgentTraceItem>
                  )}
                  {step.details?.map((detail) => (
                    <AgentTraceItem key={detail}>{detail}</AgentTraceItem>
                  ))}
                  {step.type === "editing" && step.files && (
                    <EditingContent
                      files={step.files}
                      onReview={handleReview}
                    />
                  )}
                  {step.type === "approval" && step.approval && (
                    <ApprovalContent
                      agent={agent}
                      approval={step.approval}
                      onResolveApproval={onResolveApproval}
                      onReview={handleReview}
                    />
                  )}
                  {step.type === "error" && step.errorDetail && (
                    <ErrorContent
                      error={step.errorDetail}
                      onRetry={onRetry}
                    />
                  )}
                  {step.type === "command" && step.command && (
                    <CommandContent call={step.command} />
                  )}
                </AgentTraceContent>
              )}
            </AgentTraceStep>
          ))}
        </AgentTrace>
      )}

      <AgentReviewPanel
        open={reviewOpen}
        workspacePath={agent.workspacePath}
        initialPath={reviewPath}
        fallbackFiles={agent.editedFiles}
        toolCalls={agent.toolCalls}
        onClose={() => setReviewOpen(false)}
      />

      {import.meta.env.DEV && devMode && <AgentDebugTrace agent={agent} />}
    </Box>
  );
}

/* ─── Header (uses same grid as trace for alignment) ─── */

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
      sx={{
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        columnGap: 1.25,
        py: 0.3,
        mb: 0.15,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 20,
        }}
      >
        <Box sx={{ color: status.color, display: "flex" }}>
          {status.icon}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.6,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, color: "text.primary" }}
        >
          Poly Agent
        </Typography>
        {elapsed && (
          <Typography
            sx={{
              fontSize: 11,
              color: "text.disabled",
              lineHeight: 1.3,
            }}
          >
            · {elapsed}
            {waitingMessage ? ` · ${waitingMessage}` : ""}
          </Typography>
        )}
        <Box sx={{ ml: "auto" }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 0.55,
              py: 0.1,
              borderRadius: "999px",
              color: status.color,
              bgcolor: status.bg,
              border: "1px solid",
              borderColor: status.border,
              fontSize: 10.5,
              fontWeight: 600,
              lineHeight: 1.5,
              whiteSpace: "nowrap",
            }}
          >
            {status.label}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/* ─── Step building ─── */

type StepDef = {
  id: string;
  status: StepStatus;
  label: string;
  type: "default" | "editing" | "approval" | "error" | "command";
  summary?: string;
  details?: string[];
  defaultExpanded: boolean;
  files?: AgentEditedFile[];
  approval?: AgentApproval;
  errorDetail?: string;
  command?: AgentToolCall;
};

const STEP_STATUS_MAP: Record<string, StepStatus> = {
  running: "running",
  complete: "complete",
  error: "error",
  waiting: "waiting",
};

export function buildSteps(agent: AgentMessageState): StepDef[] {
  const toolCalls = Object.values(agent.toolCalls);
  const activities = compactActivities(agent.activities);

  /* Always show at least thinking/responding steps while running.
     Simple chat shows only Thinking/Responding, not full tool trace. */
  const hasToolWork = toolCalls.some((t) => t.status !== "requested")
    || agent.editedFiles.length > 0
    || agent.approvals.length > 0;
  const isRunningOrRecent = agent.status === "running" || agent.status === "waiting_for_approval" || agent.status === "cancelling";
  const hasReasoningSteps = activities.some((a) => a.kind === "reasoning");
  const shouldShowSimpleChatTrace = !hasToolWork && (isRunningOrRecent || hasReasoningSteps);

  /* For simple chat with no tool work, only show reasoning steps */
  if (!hasToolWork && !shouldShowSimpleChatTrace) return [];

  const steps: StepDef[] = [];
  let lastLabel: string | undefined;

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];

    /* Skip empty or consecutive duplicate labels */
    if (!act.label || act.label === lastLabel) continue;
    lastLabel = act.label;

    /* Skip "Starting" — header status badge already shows it */
    if (act.label === "Starting") continue;
    if (act.label === "Completed") continue;

    const s = STEP_STATUS_MAP[act.status ?? ""] ?? "pending";
    const summary = stepSummary(act, agent);
    const step: StepDef = {
      id: act.id,
      status: s,
      label: act.label,
      type: "default",
      summary,
      details: uniqueDisplayDetails(act.details, summary),
      defaultExpanded: s === "running" || s === "error" || s === "waiting",
    };

    if (act.kind === "error") {
      step.type = "error";
      step.errorDetail = act.detail;
    }

    if (act.kind === "approval") {
      step.type = "approval";
      step.label = "Permission checked";
      if (
        agent.permissionPreset === "full-access" ||
        agent.permissionPreset === "auto-review"
      ) {
        step.defaultExpanded = false;
      } else {
        step.defaultExpanded = true;
      }
    }

    if (act.kind === "command") {
      step.type = "command";
      const call = act.toolCallId
        ? toolCalls.find((t) => t.id === act.toolCallId)
        : undefined;
      step.command = call;
    }

    if (
      act.toolCallId &&
      (act.status === "complete" || act.status === "error" || act.label === "Editing file" || act.label === "Editing files")
    ) {
      const call = toolCalls.find((t) => t.id === act.toolCallId)
        ?? toolCalls.find((t) => t.name === "apply_patch" || t.name === "write_file");
      if (
        call &&
        (call.name === "apply_patch" || call.name === "write_file")
      ) {
        step.type = "editing";
        step.defaultExpanded = true;
        step.label = editedFileLabel(agent.editedFiles, call);
      }
    }

    steps.push(step);
  }

  /* Attach file data to the last editing step */
  if (agent.editedFiles.length > 0) {
    const editSteps = steps.filter((s) => s.type === "editing");
    if (editSteps.length > 0) {
      editSteps[editSteps.length - 1].files = agent.editedFiles;
    }
  }

  /* Attach approval data */
  if (agent.approvals.length > 0) {
    const approvalSteps = steps.filter((s) => s.type === "approval");
    if (approvalSteps.length > 0) {
      approvalSteps[approvalSteps.length - 1].approval = agent.approvals[0];
    }
  }

  /* Attach error detail */
  if (agent.error) {
    const errorSteps = steps.filter((s) => s.type === "error");
    if (errorSteps.length > 0) {
      errorSteps[errorSteps.length - 1].errorDetail = agent.error;
    }
  }

  /* Trim running trace to last 8, completed trace to last 6 */
  const lastRunning = steps.some((s) => s.status === "running");
  if (lastRunning) return steps.slice(-8);

  if (
    agent.status !== "running" &&
    agent.status !== "waiting_for_approval"
  ) {
    while (steps.length > 0) {
      const last = steps[steps.length - 1];
      if (
        last.label === "Completed" ||
        last.label === "Run failed" ||
        last.label === "Cancelled"
      )
        break;
      if (steps.length > 1) steps.pop();
      else break;
    }
  }

  return steps.slice(-7);
}

function stepSummary(
  act: { label: string; kind?: string; detail?: string; status?: string },
  agent: AgentMessageState,
): string | undefined {
  const label = act.label?.toLowerCase() ?? "";
  if (label === "completed") return undefined;
  if (act.status === "running" && !act.detail) {
    if (label.includes("think")) return "Understanding the request and preparing the next action.";
    if (label.includes("respond")) return "Receiving the model response.";
    if (label.includes("summar")) return "Preparing the final response.";
    return "Waiting for the model response...";
  }
  if (act.kind === "approval") {
    if (
      agent.permissionPreset === "full-access" ||
      agent.permissionPreset === "auto-review"
    ) {
      return "Approved automatically by the current access mode.";
    }
    return act.detail || "Waiting for permission before continuing.";
  }
  if (label.includes("read") && label.includes("file"))
    return "Checking available files in the current workspace.";
  if (label.includes("read") && label.includes("context"))
    return "Loading the current file state before making changes.";
  if (label.includes("resolv"))
    return "Resolved the target file for this task.";
  if (label.includes("edit") || label.includes("patch"))
    return "Applying a targeted edit to the file.";
  if (label.includes("file") && (label.includes("creat") || label.includes("write")))
    return "Creating the requested file in the workspace.";
  if (label.includes("tool") || label.includes("call"))
    return "Running a tool to process the request.";
  if (act.detail && act.detail.length > 0 && act.detail.length < 150)
    return act.detail;
  if (act.status === "running") {
    if (label.includes("think")) return "Understanding the request and preparing the next action.";
    if (label.includes("respond")) return "Receiving the model response.";
  }
  return fallbackSummary(label);
}

export function hasDisclosureContent(
  step: Pick<StepDef, "summary" | "details" | "type" | "files" | "approval" | "errorDetail" | "command">,
): boolean {
  return Boolean(
    step.summary?.trim()
      || step.details?.some((detail) => detail.trim())
      || step.files?.length
      || step.approval
      || step.errorDetail?.trim()
      || step.command,
  );
}

function fallbackSummary(label: string): string {
  if (label.includes("think")) return "Preparing the next action.";
  if (label.includes("respond")) return "Waiting for the model response.";
  if (label.includes("inspect") || label.includes("workspace"))
    return "Checking the selected workspace.";
  if (label.includes("search")) return "Looking for relevant project files.";
  if (label.includes("read")) return "Loading relevant file contents.";
  if (label.includes("summar")) return "Preparing the final answer.";
  if (label.includes("complete")) return "Finished.";
  if (label.includes("cancel")) return "Stopped the agent run.";
  return "Working on the request.";
}

/* ─── Content sub-components ─── */

function EditingContent({
  files,
  onReview,
}: {
  files: AgentEditedFile[];
  onReview: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const additions = files.reduce((s, f) => s + f.additions, 0);
  const deletions = files.reduce((s, f) => s + f.deletions, 0);

  if (files.length === 1) {
    const f = files[0];
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, py: 0.12 }}>
        <Box sx={{ minWidth: 0, maxWidth: 300 }}>
          <AgentTraceBadge>{fileName(f.path)}</AgentTraceBadge>
        </Box>
        <Box sx={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "text.secondary", fontFamily: "monospace" }}>
          <Box component="span" sx={{ color: "success.main" }}>+{f.additions}</Box>
          <Box component="span" sx={{ color: "error.main", ml: 0.3 }}>-{f.deletions}</Box>
        </Box>
        <Button
          size="small"
          color="inherit"
          onClick={() => onReview(f.path)}
          sx={agentBtn}
        >
          Review
        </Button>
        <Tooltip title="Undo is not implemented yet.">
          <span>
            <Button
              size="small"
              color="inherit"
              disabled
              sx={agentBtn}
            >
              Undo
            </Button>
          </span>
        </Tooltip>
      </Box>
    );
  }

  const visible = expanded ? files : files.slice(0, 3);
  const hidden = files.length - visible.length;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, py: 0.12 }}>
        <Box sx={{ fontSize: 12, color: "text.secondary" }}>
          Edited {files.length} files
        </Box>
        <Box sx={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "text.secondary", fontFamily: "monospace" }}>
          <Box component="span" sx={{ color: "success.main" }}>+{additions}</Box>
          <Box component="span" sx={{ color: "error.main", ml: 0.3 }}>-{deletions}</Box>
        </Box>
        <Button
          size="small"
          color="inherit"
          onClick={() => onReview(files[0].path)}
          sx={agentBtn}
        >
          Review
        </Button>
        <Tooltip title="Undo is not implemented yet.">
          <span>
            <Button size="small" color="inherit" disabled sx={agentBtn}>
              Undo
            </Button>
          </span>
        </Tooltip>
      </Box>
      {visible.map((f) => (
        <Box
          component="button"
          key={f.path}
          onClick={() => onReview(f.path)}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 0.6,
            py: 0.1,
            pl: 0.3,
            border: "none",
            bgcolor: "transparent",
            color: "text.primary",
            cursor: "pointer",
            font: "inherit",
            textAlign: "left",
            borderRadius: "3px",
            "&:hover": { bgcolor: "action.hover" },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: -2,
            },
          }}
        >
          <Box sx={{ minWidth: 0, maxWidth: 300, fontSize: 11.5 }}>
            <AgentTraceBadge>{fileName(f.path)}</AgentTraceBadge>
          </Box>
          <Box sx={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "monospace" }}>
            <Box component="span" sx={{ color: "success.main" }}>+{f.additions}</Box>
            <Box component="span" sx={{ color: "error.main", ml: 0.3 }}>-{f.deletions}</Box>
          </Box>
        </Box>
      ))}
      {hidden > 0 && (
        <Box
          component="button"
          onClick={() => setExpanded(true)}
          sx={{
            border: "none",
            bgcolor: "transparent",
            color: "text.disabled",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.4,
            py: 0.1,
            cursor: "pointer",
            font: "inherit",
            fontSize: 11.5,
            borderRadius: "3px",
            "&:hover": { color: "text.secondary" },
          }}
        >
          Show {hidden} more {hidden === 1 ? "file" : "files"}{" "}
          <ChevronDown size={10} />
        </Box>
      )}
    </Box>
  );
}

function ApprovalContent({
  agent,
  approval,
  onResolveApproval,
  onReview,
}: {
  agent: AgentMessageState;
  approval: AgentApproval;
  onResolveApproval?: AgentActivityProps["onResolveApproval"];
  onReview: (path: string | undefined) => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const canResolve = Boolean(agent.runId && onResolveApproval);

  const autoApproved =
    agent.permissionPreset === "full-access" ||
    agent.permissionPreset === "auto-review";

  const resolve = async (kind: "approve" | "reject") => {
    if (!canResolve || busy) return;
    setBusy(kind);
    try {
      await onResolveApproval?.(kind, approval);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box>
      {approval.reason && (
        <Typography
          sx={{ fontSize: 11.5, color: "text.disabled", mb: 0.35 }}
        >
          {approval.reason}
        </Typography>
      )}
      {approval.commandPreview && (
        <Typography
          sx={{
            fontSize: 11.5,
            fontFamily: "monospace",
            color: "text.secondary",
            mb: 0.25,
            wordBreak: "break-all",
          }}
        >
          {approval.commandPreview}
        </Typography>
      )}
      {approval.path && (
        <Typography
          sx={{
            fontSize: 11.5,
            fontFamily: "monospace",
            color: "text.secondary",
            mb: 0.35,
          }}
        >
          {approval.path}
        </Typography>
      )}
      {approval.diffPreview && (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 0.6,
            mb: 0.35,
            bgcolor: "rgba(0,0,0,0.15)",
            borderRadius: "4px",
            color: "text.secondary",
            fontSize: 11,
            maxHeight: 140,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {approval.diffPreview}
        </Box>
      )}
      {!autoApproved && (
        <Box sx={{ display: "flex", gap: 0.5, mt: 0.3 }}>
          <Button
            size="small"
            color="inherit"
            onClick={() => onReview(approval.path)}
            sx={agentBtn}
          >
            Review
          </Button>
          <Button
            size="small"
            color="inherit"
            disabled={!canResolve || Boolean(busy)}
            onClick={() => resolve("reject")}
            sx={agentBtn}
          >
            {busy === "reject" ? "..." : "Reject"}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!canResolve || Boolean(busy)}
            onClick={() => resolve("approve")}
            sx={{ ...agentBtn, ...agentPrimaryBtn }}
          >
            {busy === "approve" ? "..." : "Approve"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

function ErrorContent({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, lineHeight: 1.4, color: "error.main" }}>
        {error}
      </Typography>
      {onRetry && (
        <Button
          size="small"
          color="inherit"
          startIcon={<RotateCcw size={11} />}
          onClick={onRetry}
          sx={{ ...agentBtn, mt: 0.35, color: "error.main" }}
        >
          Retry
        </Button>
      )}
    </Box>
  );
}

function CommandContent({ call }: { call: AgentToolCall }) {
  const [expanded, setExpanded] = useState(call.status === "running");
  const command =
    typeof call.arguments?.command === "string"
      ? call.arguments.command
      : "Command";
  const output = call.outputDelta || call.output || "";

  return (
    <Box>
      <Box
        component="button"
        onClick={() => setExpanded((v) => !v)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 0.6,
          p: 0.3,
          border: "none",
          bgcolor: "transparent",
          color: "text.primary",
          cursor: "pointer",
          font: "inherit",
          borderRadius: "3px",
          "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: -2,
          },
        }}
      >
        <Terminal size={12} />
        <Typography
          sx={{
            fontSize: 11.5,
            flex: 1,
            textAlign: "left",
            fontFamily: "monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "text.secondary",
          }}
        >
          {command}
        </Typography>
        <Box
          sx={{
            px: 0.4,
            py: 0.05,
            borderRadius: "999px",
            fontSize: 10,
            fontWeight: 600,
            color: "text.disabled",
            bgcolor: "action.hover",
            lineHeight: 1.5,
          }}
        >
          {call.status}
        </Box>
        {expanded ? (
          <ChevronDown size={10} />
        ) : (
          <ChevronRight size={10} />
        )}
      </Box>
      <Collapse in={expanded}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 0.6,
            bgcolor: "rgba(0,0,0,0.15)",
            borderRadius: "4px",
            color: "text.secondary",
            fontSize: 11,
            maxHeight: 180,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {output || "No output"}
        </Box>
      </Collapse>
    </Box>
  );
}

/* ─── Debug trace ─── */

function AgentDebugTrace({ agent }: { agent: AgentMessageState }) {
  const [open, setOpen] = useState(false);
  const events = agent.debugEvents ?? [];
  if (!events.length) return null;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "6px",
        overflow: "hidden",
        mt: 0.5,
      }}
    >
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        startIcon={<Bug size={12} />}
        endIcon={open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        sx={{
          ...agentBtn,
          justifyContent: "flex-start",
          width: "100%",
          height: 26,
          borderRadius: 0,
          color: "text.disabled",
          px: 1,
          "& .MuiButton-endIcon": { ml: "auto" },
        }}
      >
        Debug · {events.length} events
      </Button>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 0.75,
            bgcolor: "rgba(0,0,0,0.2)",
            borderTop: "1px solid",
            borderColor: "divider",
            color: "text.disabled",
            fontSize: 10.5,
            maxHeight: 260,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(
            {
              status: agent.status,
              request: agent.request,
              workspace:
                agent.workspacePath ?? agent.context?.activeWorkspace,
              permissionPreset: agent.permissionPreset,
              error: agent.error,
              editedFiles: agent.editedFiles,
              toolCalls: agent.toolCalls,
              approvals: agent.approvals,
              events,
            },
            null,
            2,
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

/* ─── Helpers ─── */

function compactActivities(
  activities: AgentMessageState["activities"],
) {
  return activities.reduce<AgentMessageState["activities"]>(
    (items, item) => {
      const prev = items[items.length - 1];
      if (!prev) { items.push(item); return items; }

      const sameLabel = prev.label === item.label;
      if (sameLabel) {
        if (item.status === "complete" || item.status === "error") {
          items[items.length - 1] = { ...prev, status: item.status, detail: item.detail ?? prev.detail };
          return items;
        }
        if (prev.status === "running" && item.status === "running") {
          items[items.length - 1] = { ...prev, detail: item.detail ?? prev.detail };
          return items;
        }
      }

      items.push(item);
      return items;
    },
    [],
  );
}

function editedFileLabel(
  files: AgentEditedFile[],
  call: AgentToolCall,
): string {
  if (files.length > 0) {
    if (files.length === 1) {
      const f = files[0];
      if (f.additions > 0 && f.deletions === 0)
        return `Updated ${fileName(f.path)}`;
      return `Edited ${fileName(f.path)}`;
    }
    return `Edited ${files.length} files`;
  }
  const path =
    typeof call.arguments?.path === "string" ? call.arguments.path : "";
  return path ? `Edited ${fileName(path)}` : "Editing files";
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

type AgentResult = {
  kind:
    | "files"
    | "command"
    | "noop"
    | "clarification"
    | "error"
    | "approval"
    | "progress";
  tone: "normal" | "warning" | "error";
  title: string;
  detail: string;
};

function agentResult(
  agent: AgentMessageState,
  resultText?: string,
): AgentResult {
  if (agent.status === "failed")
    return {
      kind: "error",
      tone: "error",
      title: "Run failed",
      detail:
        agent.error || "The agent stopped before completing.",
    };
  if (agent.status === "waiting_for_approval" && agent.approvals[0]) {
    const a = agent.approvals[0];
    return {
      kind: "approval",
      tone: "warning",
      title: "Waiting for approval",
      detail: a.path
        ? `${a.toolName} needs approval for ${fileName(a.path)}.`
        : a.commandPreview
          ? `${a.toolName} needs approval.`
          : "Approval needed.",
    };
  }
  if (agent.editedFiles.length > 0) {
    return {
      kind: "files",
      tone: "normal",
      title: fileChangeTitle(agent.editedFiles),
      detail:
        agent.editedFiles.length === 1
          ? `${operationSummary(agent.editedFiles[0])} in ${agent.editedFiles[0].path}.`
          : `${agent.editedFiles.length} files changed`,
    };
  }
  const cmd = lastCommand(agent);
  if (cmd)
    return {
      kind: "command",
      tone: cmd.isError || cmd.status === "failed" ? "warning" : "normal",
      title: "Ran command",
      detail: commandSummary(cmd),
    };
  const text = cleanResultText(resultText);
  if (text && looksLikeClarification(text))
    return {
      kind: "clarification",
      tone: "warning",
      title: "Needs clarification",
      detail: text,
    };
  if (text) {
    if (agent.request?.fileEditRequested && !agent.editedFiles.length)
      return {
        kind: "noop",
        tone: "warning",
        title: "No file changes",
        detail: text,
      };
    return { kind: "noop", tone: "normal", title: "Completed", detail: text };
  }
  if (agent.status === "completed") {
    const target = currentRunTargetPath(agent);
    return {
      kind: "noop",
      tone: agent.request?.fileEditRequested ? "warning" : "normal",
      title: target ? "No file changes" : "No changes",
      detail: target
        ? `Request completed, no edits for ${fileName(target)}.`
        : agent.request?.fileEditRequested
          ? "No changes produced."
          : "No changes reported.",
    };
  }
  return {
    kind: "progress",
    tone: "normal",
    title: "Working",
    detail: "Processing request.",
  };
}

function fileChangeTitle(files: AgentMessageState["editedFiles"]) {
  if (files.length !== 1) return `Edited ${files.length} files`;
  const f = files[0];
  if (f.additions > 0 && f.deletions === 0)
    return `Updated ${fileName(f.path)}`;
  return `Edited ${fileName(f.path)}`;
}

function operationSummary(file: {
  additions: number;
  deletions: number;
}) {
  if (file.additions > 0 && file.deletions === 0) return "Updated";
  if (file.deletions > 0 && file.additions === 0) return "Removed content";
  return "Modified";
}

function lastCommand(agent: AgentMessageState) {
  const cmds = Object.values(agent.toolCalls).filter(
    (c) => c.name === "run_command",
  );
  return cmds[cmds.length - 1];
}

function commandSummary(call: AgentToolCall) {
  const cmd =
    typeof call.arguments?.command === "string"
      ? call.arguments.command
      : "Command";
  const output = call.output || call.outputDelta || "";
  const exitCode = /Exit code:\s*([^\n]+)/i.exec(output)?.[1]?.trim();
  if (exitCode) return `${cmd} → exit ${exitCode}.`;
  if (call.status === "running") return `${cmd} running.`;
  if (call.status === "failed" || call.isError) return `${cmd} failed.`;
  return `${cmd} completed.`;
}

function cleanResultText(text?: string) {
  return text?.replace(/\s+/g, " ").trim();
}

function looksLikeClarification(text: string) {
  return /\b(clarif|ambiguous|need (more|additional|details|information)|please specify|which file)\b/i.test(
    text,
  );
}

function currentRunTargetPath(agent: AgentMessageState) {
  if (agent.request?.targetFile) return agent.request.targetFile;
  const mc = Object.values(agent.toolCalls).find(
    (c) =>
      ["apply_patch", "write_file"].includes(c.name) &&
      typeof c.arguments?.path === "string",
  );
  return typeof mc?.arguments?.path === "string"
    ? mc.arguments.path
    : undefined;
}

function statusMeta(
  status: AgentMessageState["status"],
  result: AgentResult,
) {
  if (status === "running" || status === "cancelling") {
    return {
      label: status === "cancelling" ? "Cancelling" : "Running",
      color: "primary.main",
      bg: "rgba(59,130,246,0.1)",
      border: "rgba(59,130,246,0.24)",
      icon: (
        <LoaderCircle
          size={14}
          className="animate-spin"
          aria-hidden
        />
      ),
    };
  }
  if (status === "waiting_for_approval") {
    return {
      label: "Waiting",
      color: "warning.main",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.26)",
      icon: <ShieldAlert size={14} aria-hidden />,
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      color: "error.main",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.24)",
      icon: <AlertTriangle size={14} aria-hidden />,
    };
  }
  if (status === "completed" && result.tone === "warning") {
    return {
      label: "No changes",
      color: "warning.main",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.26)",
      icon: <AlertTriangle size={14} aria-hidden />,
    };
  }
  return {
    label: status === "cancelled" ? "Cancelled" : "Completed",
    color: "success.main",
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.22)",
    icon: <Check size={14} aria-hidden />,
  };
}

function useHeaderStatus(agent: AgentMessageState, steps: StepDef[]): string | undefined {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (agent.status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [agent.status]);

  if (agent.status === "completed") return "Completed";
  if (agent.status === "failed") return "Failed";
  if (agent.status === "cancelled") return "Cancelled";
  if (agent.status === "waiting_for_approval") return "Waiting for approval...";
  if (agent.status !== "running" || !agent.startedAt) return undefined;
  const active = steps.find((step) => step.status === "running");
  if (active?.label) {
    const label = active.label.toLowerCase();
    if (label.includes("thinking")) return "Thinking...";
    if (label.includes("search")) return "Searching files...";
    if (label.includes("read")) return "Reading files...";
    if (label.includes("summar")) return "Summarizing...";
    if (label.includes("respond")) return "Responding...";
    if (label.includes("edit")) return "Editing files...";
    if (label.includes("verify")) return "Verifying...";
    if (label.includes("inspect") || label.includes("workspace")) return "Inspecting workspace...";
  }
  const elapsed = now - new Date(agent.startedAt).getTime();
  const seconds = Math.floor(elapsed / 1000);
  if (seconds > 30) return "Taking longer than usual.";
  if (seconds > 15) return "Still waiting for the model...";
  if (seconds > 5) return "Waiting for model response...";
  return undefined;
}

function uniqueDisplayDetails(details: string[] | undefined, summary: string | undefined) {
  if (!details?.length) return undefined;
  const seen = new Set<string>();
  const summaryKey = summary ? detailKey(summary) : "";
  const out: string[] = [];
  for (const detail of details) {
    const key = detailKey(detail);
    if (!key || key === summaryKey || seen.has(key)) continue;
    seen.add(key);
    out.push(detail);
  }
  return out.length ? out : undefined;
}

function detailKey(value: string) {
  return value.trim().toLowerCase().replace(/[.!?…]+$/g, "").replace(/\s+/g, " ");
}

function useElapsed(
  startedAt: string,
  status: string,
  completedAt?: string,
): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (
      !["running", "waiting_for_approval", "cancelling"].includes(status)
    )
      return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  if (!startedAt) return null;

  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) return null;

  const endTime = ["running", "waiting_for_approval", "cancelling"].includes(
    status,
  )
    ? now
    : completedAt
      ? new Date(completedAt).getTime()
      : now;

  if (Number.isNaN(endTime)) return null;

  const ms = endTime - startMs;
  if (ms < 0) return null;

  const seconds = Math.floor(ms / 1000);
  if (
    !["running", "waiting_for_approval", "cancelling"].includes(status) &&
    seconds < 1
  )
    return "briefly";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${seconds}s`;
}

const agentBtn = {
  height: 24,
  minWidth: 0,
  px: 0.65,
  borderRadius: "5px",
  fontSize: 11,
  fontWeight: 600,
  "&:focus-visible": {
    outline: "2px solid",
    outlineColor: "primary.main",
    outlineOffset: 2,
  },
};

const agentPrimaryBtn = {
  boxShadow: "none",
  "&:hover": { boxShadow: "none" },
};
