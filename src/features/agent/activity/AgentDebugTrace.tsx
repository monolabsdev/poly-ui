import { useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/visibility";
import { Bug, ChevronDown, ChevronRight } from "lucide-react";
import type { AgentMessageState } from "../types";

export function AgentDebugTrace({ agent }: { agent: AgentMessageState }) {
  const [open, setOpen] = useState(false);
  const events = agent.debugEvents ?? [];
  if (!events.length) return null;

  return (
    <Box
      className="border-t border-border/60"
    >
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        variant="ghost"
        size="sm"
        fullWidth
        startIcon={<Bug size={12} />}
        endIcon={open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        className="h-6 justify-start rounded-none px-2 text-xs text-muted-foreground [&_[data-icon=inline-end]]:ml-auto"
      >
        Raw trace · {events.length} events
      </Button>
      <Collapse in={open}>
        <Box
          as="pre"
          className="max-h-72 overflow-auto bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground"
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
