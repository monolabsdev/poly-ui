import { useMemo, useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/Typography";
import { ChevronDown, FileDiff } from "lucide-react";
import { AgentTraceBadge } from "@/components/ui/agent-trace";
import type { AgentEditedFile } from "../../types";
import { DiffStat } from "../primitives";
import { fileName } from "../summaries";

export function EditingContent({
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
      <Box
        as="button"
        className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-left transition-colors hover:bg-muted/40"
        onClick={() => onReview(f.path)}
      >
        <Box className="min-w-0">
          <AgentTraceBadge>{fileName(f.path)}</AgentTraceBadge>
        </Box>
        <DiffStat additions={f.additions} deletions={f.deletions} />
      </Box>
    );
  }

  const visible = expanded ? files : files.slice(0, 3);
  const hidden = files.length - visible.length;

  return (
    <Box className="rounded-lg border border-border/60 bg-background/50 p-2">
      <Box className="mb-2 flex items-center justify-between px-1">
        <Box className="text-xs font-medium text-muted-foreground">
          Edited {files.length} files
        </Box>
        <DiffStat additions={additions} deletions={deletions} />
      </Box>
      {visible.map((f) => (
        <Box
          as="button"
          key={f.path}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted/40"
          onClick={() => onReview(f.path)}
        >
          <Box className="min-w-0">
            <AgentTraceBadge>{fileName(f.path)}</AgentTraceBadge>
          </Box>
          <DiffStat additions={f.additions} deletions={f.deletions} />
        </Box>
      ))}
      {hidden > 0 && (
        <Box
          as="button"
          className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40"
          onClick={() => setExpanded(true)}
        >
          Show {hidden} more {hidden === 1 ? "file" : "files"}{" "}
          <ChevronDown size={10} />
        </Box>
      )}
    </Box>
  );
}

export function EditedFilesSummaryCard({
  files,
  onReview,
}: {
  files: AgentEditedFile[];
  onReview: (path?: string) => void;
}) {
  const totals = useMemo(
    () => ({
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    }),
    [files],
  );

  return (
    <Box className="mt-3 rounded-2xl border border-border/60 bg-background/50 p-3">
      <Box className="flex items-center gap-3">
        <Box className="flex size-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          <FileDiff size={17} />
        </Box>
        <Box className="min-w-0 flex-1">
          <Typography className="text-sm font-medium text-foreground">
            Edited {files.length} {files.length === 1 ? "file" : "files"}
          </Typography>
          <Box className="mt-1">
            <DiffStat additions={totals.additions} deletions={totals.deletions} />
          </Box>
        </Box>
        <Box>
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            onClick={() => onReview(files[0]?.path)}
          >
            Review
          </Button>
        </Box>
      </Box>
      <Box className="mt-3 space-y-1">
        {files.map((file) => (
          <Box
            as="button"
            key={file.path}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-muted/40"
            onClick={() => onReview(file.path)}
          >
            <Typography
              className="truncate font-mono text-xs text-muted-foreground"
            >
              {file.path}
            </Typography>
            <DiffStat additions={file.additions} deletions={file.deletions} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
