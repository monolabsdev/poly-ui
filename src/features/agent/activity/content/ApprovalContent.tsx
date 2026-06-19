import { useMemo, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { AgentApproval, AgentMessageState } from "../../types";
import { agentBtn, agentPrimaryBtn } from "../styles";

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

  const approveBtnSx = useMemo(() => ({ ...agentBtn, ...agentPrimaryBtn }), []);

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
            bgcolor: (theme) => alpha(theme.palette.common.black, 0.3),
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
      {!autoApproved && agent.status === "waiting_for_approval" && (
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
            sx={approveBtnSx}
          >
            {busy === "approve" ? "..." : "Approve"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
