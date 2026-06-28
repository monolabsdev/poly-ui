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
        onClick={() => onReview(f.path)}
      >
        <Box>
          <AgentTraceBadge>{fileName(f.path)}</AgentTraceBadge>
        </Box>
        <DiffStat additions={f.additions} deletions={f.deletions} />
      </Box>
    );
  }

  const visible = expanded ? files : files.slice(0, 3);
  const hidden = files.length - visible.length;

  return (
    <Box>
      <Box>
        <Box>
          Edited {files.length} files
        </Box>
        <DiffStat additions={additions} deletions={deletions} />
      </Box>
      {visible.map((f) => (
        <Box
          as="button"
          key={f.path}
          onClick={() => onReview(f.path)}
        >
          <Box>
            <AgentTraceBadge>{fileName(f.path)}</AgentTraceBadge>
          </Box>
          <DiffStat additions={f.additions} deletions={f.deletions} />
        </Box>
      ))}
      {hidden > 0 && (
        <Box
          as="button"
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
    <Box
    >
      <Box
      >
        <Box
        >
          <FileDiff size={17} />
        </Box>
        <Box>
          <Typography>
            Edited {files.length} {files.length === 1 ? "file" : "files"}
          </Typography>
          <Box>
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
      <Box>
        {files.map((file) => (
          <Box
            as="button"
            key={file.path}
            onClick={() => onReview(file.path)}
          >
            <Typography
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
