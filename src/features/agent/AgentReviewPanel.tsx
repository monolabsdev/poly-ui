import { useEffect, useMemo, useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/spinner";
import { Drawer } from "@/components/ui/drawer";
import { IconButton } from "@/components/ui/icon-button";
import { Typography } from "@/components/ui/Typography";

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
      PaperProps={{
        className: "top-[var(--titlebar-height)] h-[calc(100dvh-var(--titlebar-height))] w-screen border-l border-border bg-background text-foreground sm:w-[620px]",
      }}
    >
      <Box>
        <Box>
          <Button
            size="small"
            color="inherit"
            variant="contained"
            startIcon={<FileDiff size={14} />}
          >
            Review
          </Button>
          <Typography>+</Typography>
          <Box />
          <IconButton size="small" aria-label="Expand review">
            <Maximize2 size={15} />
          </IconButton>
          <IconButton size="small" onClick={onClose} aria-label="Close review">
            <X size={16} />
          </IconButton>
        </Box>

        <Box>
          <Typography>
            {files.length ? `${files.length} changed ${files.length === 1 ? "file" : "files"}` : "Last turn"}
          </Typography>
          <Typography>+{totals.additions}</Typography>
          <Typography>-{totals.deletions}</Typography>
        </Box>

        <Box>
          {loadingFiles && files.length === 0 ? (
            <PanelState icon={<CircularProgress size={16} />} label="Loading changed files..." />
          ) : error ? (
            <PanelState label={error} />
          ) : files.length === 0 ? (
            <PanelState label="No diff data available for this run." />
          ) : (
            <Box>
              {orderedFiles.map((file) => {
                const renderedLines = collapseContext(parseUnifiedDiff(diffs[file.path] ?? ""));
                return (
                  <Box key={file.path}>
                    <Box>
                      <ChevronRight size={14} />
                      <Typography>
                        {file.path}
                      </Typography>
                      <Box />
                      <Typography>+{file.additions}</Typography>
                      <Typography>-{file.deletions}</Typography>
                    </Box>
                    {loadingDiff && !diffs[file.path] ? (
                      <PanelState icon={<CircularProgress size={18} />} label="Loading diff..." />
                    ) : diffError[file.path] ? (
                      <PanelState label={diffError[file.path]} />
                    ) : renderedLines.length === 0 ? (
                      <PanelState label="No file diff available." />
                    ) : (
                      <Box as="pre">
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
        as="code"
      >
        {line.text}
      </Box>
    );
  }

  return (
    <Box
      as="code"
    >
      <Box>
        {line.newNumber ?? line.oldNumber ?? ""}
      </Box>
      <Box>{line.text || " "}</Box>
    </Box>
  );
}

function PanelState({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <Box>
      {icon}
      <Typography>{label}</Typography>
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
