import { useMemo, useState } from "react";
import { Box, Button, Collapse } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Bug, ChevronDown, ChevronRight } from "lucide-react";
import type { AgentMessageState } from "../types";
import { agentBtn } from "./styles";

export function AgentDebugTrace({ agent }: { agent: AgentMessageState }) {
  const [open, setOpen] = useState(false);
  const events = agent.debugEvents ?? [];
  const debugBtnSx = useMemo(() => ({
    ...agentBtn,
    justifyContent: "flex-start",
    width: "100%",
    height: 26,
    borderRadius: 0,
    color: "text.disabled",
    px: 1,
    "& .MuiButton-endIcon": { ml: "auto" },
  }), []);
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
            sx={debugBtnSx}
      >
        Debug · {events.length} events
      </Button>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 0.75,
            bgcolor: (theme) => alpha(theme.palette.common.black, 0.35),
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
