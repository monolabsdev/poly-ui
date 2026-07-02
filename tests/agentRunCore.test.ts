import { describe, expect, it } from "vitest";
import {
  canTransition,
  decideApproval,
  isMutatingTool,
  isTerminalStatus,
  mutationKey,
  replaceExact,
  synthesizeCompletionSummary,
  toolErr,
  toolOk,
  truncateForEvent,
  type SdkRunStatus,
} from "@/features/agent/runCore";

describe("run state machine", () => {
  it("allows only valid transitions", () => {
    expect(canTransition("running", "waiting_for_approval")).toBe(true);
    expect(canTransition("running", "finished")).toBe(true);
    expect(canTransition("running", "failed")).toBe(true);
    expect(canTransition("running", "cancelled")).toBe(true);
    expect(canTransition("waiting_for_approval", "running")).toBe(true);
    expect(canTransition("waiting_for_approval", "cancelled")).toBe(true);
    expect(canTransition("waiting_for_approval", "finished")).toBe(false);
  });

  it("terminal states accept no transitions", () => {
    const terminals: SdkRunStatus[] = ["finished", "failed", "cancelled"];
    const all: SdkRunStatus[] = ["running", "waiting_for_approval", "finished", "failed", "cancelled"];
    for (const from of terminals) {
      expect(isTerminalStatus(from)).toBe(true);
      for (const to of all) expect(canTransition(from, to)).toBe(false);
    }
    expect(isTerminalStatus("running")).toBe(false);
    expect(isTerminalStatus("waiting_for_approval")).toBe(false);
  });
});

describe("decideApproval", () => {
  it("sandbox auto-approves everything", () => {
    expect(decideApproval("default", true, "run_command").mode).toBe("auto_approve");
    expect(decideApproval("default", true, "write_file").mode).toBe("auto_approve");
  });

  it("full-access auto-approves everything", () => {
    expect(decideApproval("full-access", false, "run_command").mode).toBe("auto_approve");
    expect(decideApproval("full-access", false, "edit").mode).toBe("auto_approve");
  });

  it("auto-review approves file edits but asks for commands", () => {
    expect(decideApproval("auto-review", false, "write_file").mode).toBe("auto_approve");
    expect(decideApproval("auto-review", false, "edit").mode).toBe("auto_approve");
    expect(decideApproval("auto-review", false, "multi_edit").mode).toBe("auto_approve");
    expect(decideApproval("auto-review", false, "run_command").mode).toBe("ask");
  });

  it("default asks for every mutating tool", () => {
    expect(decideApproval("default", false, "write_file").mode).toBe("ask");
    expect(decideApproval("default", false, "edit").mode).toBe("ask");
    expect(decideApproval("default", false, "run_command").mode).toBe("ask");
  });
});

describe("mutation dedup keys", () => {
  it("classifies mutating tools", () => {
    expect(isMutatingTool("write_file")).toBe(true);
    expect(isMutatingTool("edit")).toBe(true);
    expect(isMutatingTool("multi_edit")).toBe(true);
    expect(isMutatingTool("run_command")).toBe(true);
    expect(isMutatingTool("read_file")).toBe(false);
    expect(isMutatingTool("grep")).toBe(false);
  });

  it("keys identical calls identically and different args differently", () => {
    const a = mutationKey("edit", { path: "a.ts", old_string: "x", new_string: "y" });
    const b = mutationKey("edit", { path: "a.ts", old_string: "x", new_string: "y" });
    const c = mutationKey("edit", { path: "a.ts", old_string: "x", new_string: "z" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("tool results", () => {
  it("builds structured success and failure", () => {
    const ok = toolOk({ path: "a.ts" }, "Wrote a.ts.", 12);
    expect(ok).toEqual({ ok: true, data: { path: "a.ts" }, summary: "Wrote a.ts.", durationMs: 12 });
    const err = toolErr("approval_denied", "declined", false, 5);
    expect(err.ok).toBe(false);
    if (!err.ok) {
      expect(err.error.code).toBe("approval_denied");
      expect(err.error.recoverable).toBe(false);
    }
  });
});

describe("truncateForEvent", () => {
  it("passes short text through and truncates long text with a marker", () => {
    expect(truncateForEvent("short")).toBe("short");
    const long = "x".repeat(5000);
    const truncated = truncateForEvent(long);
    expect(truncated.length).toBeLessThan(5000);
    expect(truncated).toContain("[truncated");
  });
});

describe("synthesizeCompletionSummary", () => {
  it("returns empty when nothing succeeded", () => {
    expect(synthesizeCompletionSummary([])).toBe("");
    expect(synthesizeCompletionSummary([{ name: "edit", ok: false, path: "a.ts" }])).toBe("");
  });

  it("summarizes edited files and commands", () => {
    const summary = synthesizeCompletionSummary([
      { name: "edit", ok: true, path: "src/a.ts" },
      { name: "write_file", ok: true, path: "src/b.ts" },
      { name: "run_command", ok: true, command: "bun run test" },
    ]);
    expect(summary).toContain("Edited 2 files");
    expect(summary).toContain("src/a.ts");
    expect(summary).toContain("Ran 1 command");
  });

  it("summarizes read-only work without inventing changes", () => {
    const summary = synthesizeCompletionSummary([{ name: "read_file", ok: true, path: "a.ts" }]);
    expect(summary).toContain("without file changes");
  });
});

describe("replaceExact", () => {
  it("replaces a unique occurrence", () => {
    expect(replaceExact("a b c", "b", "x", false)).toBe("a x c");
  });

  it("rejects empty, identical, missing, and ambiguous inputs", () => {
    expect(() => replaceExact("a", "", "x", false)).toThrow();
    expect(() => replaceExact("a", "a", "a", false)).toThrow();
    expect(() => replaceExact("a", "z", "x", false)).toThrow();
    expect(() => replaceExact("a a", "a", "x", false)).toThrow(/not unique/);
  });

  it("replace_all replaces every occurrence", () => {
    expect(replaceExact("a a a", "a", "b", true)).toBe("b b b");
  });
});
