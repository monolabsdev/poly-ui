import { useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/Typography";
import type { AgentApproval, AgentMessageState } from "../../types";

type ResolveApproval = (kind: "approve" | "reject", approval: AgentApproval) => Promise<void> | void;

export function ApprovalContent({
  agent,
  approval,
  onResolveApproval,
  onReview,
}: {
  agent: AgentMessageState;
  approval: AgentApproval;
  onResolveApproval?: ResolveApproval;
  onReview: (path: string | undefined) => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const canResolve = Boolean(
    agent.runId &&
      onResolveApproval &&
      agent.status === "waiting_for_approval" &&
      agent.approvals.some((item) => item.approvalId === approval.approvalId),
  );

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
    <Box
    >
      {approval.reason && (
        <Typography
        >
          {approval.reason}
        </Typography>
      )}
      {approval.commandPreview && (
        <Typography
        >
          {approval.commandPreview}
        </Typography>
      )}
      {approval.path && (
        <Typography
        >
          {approval.path}
        </Typography>
      )}
      {approval.diffPreview && (
        <Box
          as="pre"
        >
          {approval.diffPreview}
        </Box>
      )}
      {!autoApproved && agent.status === "waiting_for_approval" && (
        <Box>
          <Button
            size="small"
            color="inherit"
            onClick={() => onReview(approval.path)}
          >
            Review
          </Button>
          <Button
            size="small"
            color="inherit"
            disabled={!canResolve || Boolean(busy)}
            onClick={() => resolve("reject")}
          >
            {busy === "reject" ? "..." : "Reject"}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!canResolve || Boolean(busy)}
            onClick={() => resolve("approve")}
          >
            {busy === "approve" ? "..." : "Approve"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
