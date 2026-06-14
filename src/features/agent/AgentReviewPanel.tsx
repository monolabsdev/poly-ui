import { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Drawer, IconButton, Typography } from "@mui/material";
import { ChevronRight, FileDiff, Maximize2, X } from "lucide-react";
import { getAgentChangedFiles, getAgentFileDiff } from "./agentClient";
import type { AgentChangedFile, AgentEditedFile, AgentToolCall } from "./types";

type AgentReviewPanelProps = {
  open: boolean;
  workspacePath?: string;
  initialPath?: string;
  fallbackFiles?: AgentEditedFile[];
  toolCalls?: Record<string, AgentToolCall>;
  onClose: () => void;
};

type DiffLine = {
  id: string;
  kind: "add" | "remove" | "context" | "hunk" | "meta" | "fold";
  text: string;
  oldNumber?: number;
  newNumber?: number;
};

export function AgentReviewPanel({
  open,
  workspacePath,
  initialPath,
  fallbackFiles = [],
  toolCalls = {},
  onClose,
}: AgentReviewPanelProps) {
  const [files, setFiles] = useState<AgentChangedFile[]>([]);
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState("");
  const [diffError, setDiffError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fallbackFilesNext = fallbackChangedFiles(fallbackFiles);
    setFiles(fallbackFilesNext);
    setError(fallbackFilesNext.length ? "" : "");
    if (!workspacePath) {
      setError(fallbackFilesNext.length ? "" : "Select a workspace to review changes.");
      setLoadingFiles(false);
      return () => {
        cancelled = true;
      };
    }
    setLoadingFiles(fallbackFilesNext.length === 0);
    setError("");
    getAgentChangedFiles(workspacePath)
      .then((changedFiles) => {
        if (cancelled) return;
        const nextFiles = changedFiles.length ? changedFiles : fallbackFilesNext;
        setFiles(nextFiles);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFiles(fallbackFilesNext);
        setError(fallbackFilesNext.length ? "" : friendlyGitError(messageFromError(err)));
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackFiles, initialPath, open, workspacePath]);

  useEffect(() => {
    if (!open || files.length === 0) {
      setDiffs({});
      return;
    }
    let cancelled = false;
    const fallbackDiffs = Object.fromEntries(
      files.map((file) => [
        file.path,
        buildFallbackDiff(file.path, Object.values(toolCalls)),
      ]),
    );
    setDiffs(fallbackDiffs);
    setDiffError({});
    if (!workspacePath) {
      setLoadingDiff(false);
      return () => {
        cancelled = true;
      };
    }
    setLoadingDiff(true);
    Promise.all(
      files.map((file) =>
        getAgentFileDiff(workspacePath, file.path)
          .then((fileDiff) => ({ path: file.path, diff: fileDiff.diff || buildFallbackDiff(file.path, Object.values(toolCalls)), error: "" }))
          .catch((err: unknown) => {
            const fallbackDiff = buildFallbackDiff(file.path, Object.values(toolCalls));
            return { path: file.path, diff: fallbackDiff, error: fallbackDiff ? "" : messageFromError(err) || "Diff fetch failed." };
          }),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setDiffs(Object.fromEntries(results.map((result) => [result.path, result.diff])));
        setDiffError(Object.fromEntries(results.filter((result) => result.error).map((result) => [result.path, result.error])));
      })
      .finally(() => {
        if (!cancelled) setLoadingDiff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [files, open, toolCalls, workspacePath]);

  const totals = useMemo(
    () => ({
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    }),
    [files],
  );
  const orderedFiles = useMemo(() => {
    if (!initialPath) return files;
    return [...files].sort((a, b) => Number(b.path === initialPath) - Number(a.path === initialPath));
  }, [files, initialPath]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: { top: "var(--titlebar-height)" },
        },
      }}
      PaperProps={{
        sx: {
          top: "var(--titlebar-height)",
          height: "calc(100dvh - var(--titlebar-height))",
          width: { xs: "100vw", sm: 620 },
          bgcolor: "#151515",
          color: "text.primary",
          borderLeft: "1px solid",
          borderColor: "rgba(255,255,255,0.1)",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ height: 48, display: "flex", alignItems: "center", gap: 1, px: 1.25 }}>
          <Button
            size="small"
            color="inherit"
            variant="contained"
            startIcon={<FileDiff size={14} />}
            sx={{
              height: 30,
              borderRadius: "8px",
              bgcolor: "rgba(255,255,255,0.08)",
              boxShadow: "none",
              fontSize: 12,
              fontWeight: 800,
              "&:hover": { bgcolor: "rgba(255,255,255,0.12)", boxShadow: "none" },
            }}
          >
            Review
          </Button>
          <Typography sx={{ color: "text.secondary", fontSize: 20, lineHeight: 1 }}>+</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" sx={{ color: "text.secondary" }} aria-label="Expand review">
            <Maximize2 size={15} />
          </IconButton>
          <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary" }} aria-label="Close review">
            <X size={16} />
          </IconButton>
        </Box>

        <Box sx={{ height: 38, display: "flex", alignItems: "center", gap: 1, px: 1.5, borderBottom: "1px solid", borderColor: "rgba(255,255,255,0.1)" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
            {files.length ? `${files.length} changed ${files.length === 1 ? "file" : "files"}` : "Last turn"}
          </Typography>
          <Typography sx={{ color: "success.main", fontSize: 12, fontWeight: 800 }}>+{totals.additions}</Typography>
          <Typography sx={{ color: "error.main", fontSize: 12, fontWeight: 800 }}>-{totals.deletions}</Typography>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {loadingFiles && files.length === 0 ? (
            <PanelState icon={<CircularProgress size={16} />} label="Loading changed files..." />
          ) : error ? (
            <PanelState label={error} />
          ) : files.length === 0 ? (
            <PanelState label="No diff data available for this run." />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              {orderedFiles.map((file) => {
                const renderedLines = collapseContext(parseUnifiedDiff(diffs[file.path] ?? ""));
                return (
                  <Box key={file.path} sx={{ borderBottom: "1px solid", borderColor: "rgba(255,255,255,0.08)" }}>
                    <Box sx={{ position: "sticky", top: 0, zIndex: 2, bgcolor: "#151515", display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1 }}>
                      <ChevronRight size={14} />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.path}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ color: "success.main", fontSize: 12, fontWeight: 800 }}>+{file.additions}</Typography>
                      <Typography sx={{ color: "error.main", fontSize: 12, fontWeight: 800 }}>-{file.deletions}</Typography>
                    </Box>
                    {loadingDiff && !diffs[file.path] ? (
                      <PanelState icon={<CircularProgress size={18} />} label="Loading diff..." />
                    ) : diffError[file.path] ? (
                      <PanelState label={diffError[file.path]} />
                    ) : renderedLines.length === 0 ? (
                      <PanelState label="No file diff available." />
                    ) : (
                      <Box component="pre" sx={{ m: 0, minWidth: "max-content", py: 1 }}>
                        {renderedLines.map((line) => (
                          <DiffRow key={`${file.path}-${line.id}`} line={line} />
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "fold") {
    return (
      <Box
        component="code"
        sx={{
          display: "block",
          mx: 1,
          my: 0.75,
          px: 1,
          py: 0.55,
          borderRadius: "5px",
          bgcolor: "rgba(255,255,255,0.1)",
          color: "text.secondary",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        }}
      >
        {line.text}
      </Box>
    );
  }

  const tone = {
    add: { bg: "rgba(39, 174, 96, 0.22)", bar: "#2fe37f", fg: "#d9ffe8" },
    remove: { bg: "rgba(231, 76, 60, 0.22)", bar: "#ff5f57", fg: "#ffe1df" },
    hunk: { bg: "transparent", bar: "transparent", fg: "#8d96a0" },
    meta: { bg: "transparent", bar: "transparent", fg: "#6f7780" },
    context: { bg: "transparent", bar: "transparent", fg: "#d6d6d6" },
  }[line.kind];

  return (
    <Box
      component="code"
      sx={{
        display: "grid",
        gridTemplateColumns: "44px minmax(520px, 1fr)",
        position: "relative",
        bgcolor: tone.bg,
        color: tone.fg,
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        fontSize: 12,
        lineHeight: 1.75,
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: line.kind === "add" || line.kind === "remove" ? 4 : 0,
          bgcolor: tone.bar,
        },
      }}
    >
      <Box sx={{ pr: 1.25, textAlign: "right", color: line.kind === "add" ? "#46f28e" : "text.secondary", userSelect: "none" }}>
        {line.newNumber ?? line.oldNumber ?? ""}
      </Box>
      <Box sx={{ px: 1.25, whiteSpace: "pre" }}>{line.text || " "}</Box>
    </Box>
  );
}

function PanelState({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, color: "text.secondary" }}>
      {icon}
      <Typography sx={{ fontSize: 13 }}>{label}</Typography>
    </Box>
  );
}

function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines = diff.split(/\r?\n/);
  let oldNumber = 0;
  let newNumber = 0;

  return lines
    .filter((line, index) => index < lines.length - 1 || line.length > 0)
    .map((text, index) => {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
      if (hunk) {
        oldNumber = Number(hunk[1]);
        newNumber = Number(hunk[2]);
        return { id: `${index}-hunk`, kind: "hunk", text } satisfies DiffLine;
      }
      if (text.startsWith("diff --git") || text.startsWith("index ") || text.startsWith("--- ") || text.startsWith("+++ ") || text.startsWith("new file mode")) {
        return { id: `${index}-meta`, kind: "meta", text } satisfies DiffLine;
      }
      if (text.startsWith("+")) {
        return { id: `${index}-add`, kind: "add", text, newNumber: newNumber++ } satisfies DiffLine;
      }
      if (text.startsWith("-")) {
        return { id: `${index}-remove`, kind: "remove", text, oldNumber: oldNumber++ } satisfies DiffLine;
      }
      const row = { id: `${index}-context`, kind: "context", text, oldNumber, newNumber } satisfies DiffLine;
      oldNumber += 1;
      newNumber += 1;
      return row;
    });
}

function collapseContext(lines: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].kind !== "context") {
      result.push(lines[i]);
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i].kind === "context") i += 1;
    const group = lines.slice(start, i);
    i -= 1;
    if (group.length <= 8) {
      result.push(...group);
      continue;
    }
    result.push(...group.slice(0, 3));
    result.push({
      id: `${group[0].id}-fold`,
      kind: "fold",
      text: `${group.length - 6} unmodified lines`,
    });
    result.push(...group.slice(-3));
  }
  return result;
}

function fallbackChangedFiles(files: AgentEditedFile[]): AgentChangedFile[] {
  return files.map((file) => ({
    path: file.path,
    additions: file.additions,
    deletions: file.deletions,
    status: file.deletions > 0 ? "modified" : "added",
  }));
}

function buildFallbackDiff(path: string, toolCalls: AgentToolCall[]): string {
  const calls = toolCalls.filter((call) => call.status === "completed" && !call.isError && stringArg(call, "path") === path);
  if (!calls.length) return "";

  const chunks = calls
    .map((call) => {
      if (call.name === "apply_patch") {
        const oldText = stringArg(call, "expected_old_text") ?? "";
        const newText = stringArg(call, "replacement_text") ?? "";
        return syntheticDiff(path, oldText, newText);
      }
      if (call.name === "write_file") {
        return syntheticDiff(path, "", stringArg(call, "content") ?? "");
      }
      return "";
    })
    .filter(Boolean);

  return chunks.join("\n");
}

function syntheticDiff(path: string, oldText: string, newText: string): string {
  const oldLines = splitDiffText(oldText);
  const newLines = splitDiffText(newText);
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const header = [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${oldCount || 0} +1,${newCount || 0} @@`,
  ];
  return [
    ...header,
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`),
  ].join("\n");
}

function splitDiffText(text: string): string[] {
  if (!text) return [];
  return text.replace(/\n$/, "").split("\n");
}

function stringArg(call: AgentToolCall, key: string): string | undefined {
  const value = call.arguments?.[key];
  return typeof value === "string" ? value : undefined;
}

function messageFromError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "";
}

function friendlyGitError(error: string): string {
  if (!error) return "No diff data available for this run.";
  if (error.toLowerCase().includes("not a git repository")) return "No diff data available for this run.";
  return error;
}
