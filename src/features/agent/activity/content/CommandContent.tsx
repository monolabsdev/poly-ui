import { useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";
import type { AgentToolCall } from "../../types";

export function CommandContent({ call }: { call: AgentToolCall }) {
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
          "&:hover": { bgcolor: "action.hover" },
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
            bgcolor: (theme) => alpha(theme.palette.common.black, 0.3),
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
