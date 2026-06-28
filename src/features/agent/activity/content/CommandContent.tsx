import { useState } from "react";
import { Box } from "@/components/ui/Box";
import { Collapse } from "@/components/ui/visibility";
import { Typography } from "@/components/ui/Typography";
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
  return (
    <Box>
      <Box
        as="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <Terminal size={12} />
        <Typography
        >
          {command}
        </Typography>
        <Box
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
          as="pre"
        >
          {output || "No output"}
        </Box>
      </Collapse>
    </Box>
  );
}

/* ─── Debug trace ─── */
