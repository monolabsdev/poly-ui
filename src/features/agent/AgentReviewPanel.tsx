import { useEffect, useMemo, useState } from "react";
import { Box } from "@/components/ui/Box";
import { CircularProgress } from "@/components/ui/spinner";
import { IconButton } from "@/components/ui/icon-button";
import { Typography } from "@/components/ui/Typography";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

import { FileDiff, X } from "lucide-react";
import { highlight } from "sugar-high";
import * as presets from "sugar-high/presets";
import { getAgentChangedFiles, getAgentFileDiff } from "./agentClient";
import { collapseContext, getDiffLanguage, parseUnifiedDiff, type DiffLine } from "./reviewDiff";
import type { AgentChangedFile, AgentEditedFile, AgentToolCall } from "./types";

type AgentReviewPanelProps = {
  open: boolean;
  workspacePath?: string;
  initialPath?: string;
  fallbackFiles?: AgentEditedFile[];
  toolCalls?: Record<string, AgentToolCall>;
  onClose: () => void;
};

const LANGUAGE_PRESETS = {
  c: presets.c,
  css: presets.css,
  diff: presets.diff,
  go: presets.go,
  java: presets.java,
  py: presets.python,
  python: presets.python,
  rs: presets.rust,
  rust: presets.rust,
} as const;

const JAVASCRIPT_LANGUAGES = new Set([
  "js",
  "javascript",
  "jsx",
  "ts",
  "tsx",
  "typescript",
]);

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
  const [selectedPath, setSelectedPath] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setSelectedPath(initialPath);
  }, [initialPath, open]);

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
  }, [fallbackFiles, open, workspacePath]);

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

  useEffect(() => {
    if (!open || orderedFiles.length === 0) return;
    if (selectedPath && orderedFiles.some((file) => file.path === selectedPath)) return;
    setSelectedPath(orderedFiles[0].path);
  }, [open, orderedFiles, selectedPath]);

  const selectedFile = orderedFiles.find((file) => file.path === selectedPath) ?? orderedFiles[0];
  const selectedDiffLines = useMemo(
    () => selectedFile ? collapseContext(parseUnifiedDiff(diffs[selectedFile.path] ?? "")) : [],
    [diffs, selectedFile],
  );
  const selectedLanguage = selectedFile ? getDiffLanguage(selectedFile.path) : undefined;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="min-h-0 w-screen gap-0 bg-background text-foreground sm:w-[760px] sm:max-w-none lg:w-[900px]"
      >
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          <FileDiff className="size-4 shrink-0 text-muted-foreground" />
          <Box className="min-w-0 flex-1">
            <SheetTitle className="truncate text-sm font-medium">
              Review changes
            </SheetTitle>
            <SheetDescription className="truncate text-xs">
              {files.length ? `${files.length} changed ${files.length === 1 ? "file" : "files"} · +${totals.additions} -${totals.deletions}` : "Last turn"}
            </SheetDescription>
          </Box>
          <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Git diff
          </span>
          <IconButton size="small" onClick={onClose} aria-label="Close review" title="Close review">
            <X size={14} />
          </IconButton>
        </header>

        <Box className="min-h-0 flex-1 overflow-hidden">
          {loadingFiles && files.length === 0 ? (
            <PanelState icon={<CircularProgress size={16} />} label="Loading changed files..." />
          ) : error ? (
            <PanelState label={error} />
          ) : orderedFiles.length === 0 ? (
            <PanelState label="No diff data available for this run." />
          ) : (
            <Box className="h-full min-h-0">
              <section className="flex min-h-0 min-w-0 flex-col">
                <Box className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
                  <Typography className="min-w-0 flex-1 truncate text-sm font-medium">
                    {selectedFile?.path}
                  </Typography>
                  {selectedLanguage ? (
                    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {selectedLanguage}
                    </span>
                  ) : null}
                </Box>

                {selectedFile && loadingDiff && !diffs[selectedFile.path] ? (
                  <PanelState icon={<CircularProgress size={18} />} label="Loading diff..." />
                ) : selectedFile && diffError[selectedFile.path] ? (
                  <PanelState label={diffError[selectedFile.path]} />
                ) : selectedDiffLines.length === 0 ? (
                  <PanelState label="No file diff available." />
                ) : (
                  <Box className="min-h-0 flex-1 overflow-auto bg-muted/10">
                    <Box as="pre" className="min-w-max p-3 font-mono text-[12px] leading-5">
                      {selectedDiffLines.map((line) => (
                        <DiffRow key={`${selectedFile.path}-${line.id}`} line={line} language={selectedLanguage} />
                      ))}
                    </Box>
                  </Box>
                )}
              </section>
            </Box>
          )}
        </Box>
      </SheetContent>
    </Sheet>
  );
}

function DiffRow({ line, language }: { line: DiffLine; language?: string }) {
  if (line.kind === "fold") {
    return (
      <Box as="code" className="block border-l-2 border-transparent px-3 py-1 text-center text-muted-foreground">
        {line.text}
      </Box>
    );
  }

  const source = splitSourceLine(line);
  const highlightedHtml = getHighlightedHtml(source.code, line.kind === "meta" || line.kind === "hunk" ? "diff" : language);

  return (
    <Box
      as="code"
      className={[
        "grid grid-cols-[3.25rem_3.25rem_minmax(0,1fr)] border-l-2",
        line.kind === "add" ? "border-success/50 bg-success-soft" : "",
        line.kind === "remove" ? "border-error/50 bg-error-soft" : "",
        line.kind === "hunk" ? "border-info/50 bg-info-soft text-info" : "",
        line.kind === "meta" ? "border-transparent text-muted-foreground" : "",
        line.kind === "context" ? "border-transparent" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="select-none pr-3 text-right text-muted-foreground/60">{line.oldNumber ?? ""}</span>
      <span className="select-none pr-3 text-right text-muted-foreground/60">{line.newNumber ?? ""}</span>
      <span className="flex min-w-0 whitespace-pre pr-3">
        <span
          className={[
            "w-5 shrink-0 select-none text-muted-foreground/60",
            line.kind === "add" ? "text-success" : "",
            line.kind === "remove" ? "text-error" : "",
          ].filter(Boolean).join(" ")}
        >
          {source.prefix}
        </span>
        {highlightedHtml ? (
          <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <span>{source.code}</span>
        )}
      </span>
    </Box>
  );
}

function PanelState({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <Box className="flex h-full min-h-40 items-center justify-center gap-2 p-6 text-muted-foreground">
      {icon}
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}

function getHighlightedHtml(value: string, language?: string | null): string | null {
  const normalizedLanguage = language?.toLowerCase();
  if (!normalizedLanguage) return null;
  if (JAVASCRIPT_LANGUAGES.has(normalizedLanguage)) return highlight(value);

  const preset = LANGUAGE_PRESETS[normalizedLanguage as keyof typeof LANGUAGE_PRESETS];
  return preset ? highlight(value, preset) : null;
}

function splitSourceLine(line: DiffLine): { prefix: string; code: string } {
  if (line.kind !== "add" && line.kind !== "remove" && line.kind !== "context") {
    return { prefix: "", code: line.text || " " };
  }

  const prefix = line.text[0] === "+" || line.text[0] === "-" || line.text[0] === " " ? line.text[0] : " ";
  return { prefix, code: line.text.slice(prefix === " " && line.text[0] !== " " ? 0 : 1) || " " };
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
