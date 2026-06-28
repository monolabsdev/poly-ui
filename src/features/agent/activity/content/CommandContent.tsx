import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
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
  const exitCode = /Exit code:\s*([^\n]+)/i.exec(output)?.[1]?.trim();
  const statusColor = call.isError || call.status === "failed"
    ? "error.main"
    : call.status === "running"
      ? "primary.main"
      : "success.main";

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
          px: 0.55,
          py: 0.35,
          border: "1px solid",
          borderColor: "border.light",
          bgcolor: "action.hover",
          color: "text.primary",
          cursor: "pointer",
          font: "inherit",
          borderRadius: "6px",
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
            px: 0.55,
            py: 0.05,
            borderRadius: "5px",
            fontSize: 10,
            fontWeight: 700,
            color: statusColor,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "border.light",
            lineHeight: 1.5,
          }}
        >
          {exitCode ? `exit ${exitCode}` : call.status}
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
            mt: 0.45,
            p: 0.75,
            bgcolor: (theme) => alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.28 : 0.04),
            border: "1px solid",
            borderColor: "border.light",
            borderRadius: "6px",
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
