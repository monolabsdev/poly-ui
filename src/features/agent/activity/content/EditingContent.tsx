import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { ChevronDown, FileDiff } from "lucide-react";
import { AgentTraceBadge } from "@/components/ui/agent-trace";
import type { AgentEditedFile } from "../../types";
import { DiffStat } from "../primitives";
import { fileName } from "../summaries";
import { agentBtn } from "../styles";

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
        component="button"
        onClick={() => onReview(f.path)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.6,
          py: 0.12,
          border: 0,
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
        <Box sx={{ minWidth: 0, maxWidth: 300 }}>
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, py: 0.12 }}>
        <Box sx={{ fontSize: 12, color: "text.secondary" }}>
          Edited {files.length} files
        </Box>
        <DiffStat additions={additions} deletions={deletions} />
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
          <DiffStat additions={f.additions} deletions={f.deletions} />
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
      sx={{
        mt: 0.85,
        ml: 0,
        width: "min(540px, 100%)",
        border: "1px solid",
        borderColor: "border.light",
        borderRadius: "7px",
        bgcolor: "transparent",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "26px minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 0.85,
          px: 1,
          py: 0.85,
        }}
      >
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: "6px",
            display: "grid",
            placeItems: "center",
            bgcolor: "success.soft",
            color: "text.secondary",
          }}
        >
          <FileDiff size={17} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 750, lineHeight: 1.25 }}>
            Edited {files.length} {files.length === 1 ? "file" : "files"}
          </Typography>
          <Box sx={{ mt: 0.15 }}>
            <DiffStat additions={totals.additions} deletions={totals.deletions} />
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            onClick={() => onReview(files[0]?.path)}
            sx={{
              ...agentBtn,
              height: 28,
              px: 1.2,
              borderColor: "border.main",
              "&:hover": {
                borderColor: "action.selected",
                bgcolor: "action.hover",
              },
            }}
          >
            Review
          </Button>
        </Box>
      </Box>
      <Box sx={{ borderTop: "1px solid", borderColor: "border.light" }}>
        {files.map((file) => (
          <Box
            component="button"
            key={file.path}
            onClick={() => onReview(file.path)}
            sx={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.65,
              border: 0,
              borderTop: "1px solid",
              borderTopColor: "border.light",
              bgcolor: "transparent",
              color: "text.primary",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left",
              "&:first-of-type": { borderTop: 0 },
              "&:hover": { bgcolor: "action.hover" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: -2,
              },
            }}
          >
            <Typography
              sx={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 13,
                fontWeight: 600,
              }}
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
