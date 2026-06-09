import { expect, test } from "bun:test";
import { appendAgentEvent, addUniqueDetail } from "../src/features/agent/activity";
import { buildSteps, hasDisclosureContent } from "../src/features/agent/AgentActivity";
import {
  applyOutputDelta,
  applyOutputFinal,
  reconcileFinalText,
  type AgentOutputState,
} from "../src/features/agent/outputState";
import type { AgentMessageState } from "../src/features/agent/types";

function baseState(): AgentMessageState {
  return {
    status: "running",
    startedAt: "2026-06-07T00:00:00.000Z",
    permissionPreset: "default",
    request: {
      prompt: "Add a file. Call it amaze.txt. Add some nice text inside",
      fileEditRequested: true,
      targetFile: "amaze.txt",
    },
    activities: [],
    toolCalls: {},
    approvals: [],
    editedFiles: [],
  };
}

test("agent activity records approval prompt details", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "approval_required",
    timestamp: "now",
    data: {
      kind: "approval_required",
      value: {
        approval_id: "call-1",
        tool_name: "run_command",
        risk: "RequiresApproval",
        reason: "Installs dependencies.",
        command_preview: "bun install",
      },
    },
  });

  expect(state.status).toBe("waiting_for_approval");
  expect(state.approvals[0]).toMatchObject({
    approvalId: "call-1",
    toolName: "run_command",
    commandPreview: "bun install",
  });
});

test("agent activity summarizes created files from write_file args", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "tool_call_requested",
    timestamp: "now",
    data: {
      kind: "tool_call_requested",
      value: {
        tool_call_id: "call-3",
        tool_name: "write_file",
        arguments: {
          path: "amaze.txt",
          content: "Nice line one.\nNice line two.\n",
          mode: "create",
        },
      },
    },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "tool_call_finished",
    timestamp: "now",
    data: {
      kind: "tool_call_finished",
      value: {
        tool_call_id: "call-3",
        output: "Wrote amaze.txt",
        is_error: false,
        cached: false,
      },
    },
  });

  expect(state.editedFiles).toEqual([
    { path: "amaze.txt", additions: 2, deletions: 0 },
  ]);
});

test("agent activity summarizes edited files from real tool args", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "tool_call_requested",
    timestamp: "now",
    data: {
      kind: "tool_call_requested",
      value: {
        tool_call_id: "call-2",
        tool_name: "apply_patch",
        arguments: {
          path: "src/lib.rs",
          expected_old_text: "old\nlines\n",
          replacement_text: "new\nlines\nadded\n",
        },
      },
    },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "tool_call_finished",
    timestamp: "now",
    data: {
      kind: "tool_call_finished",
      value: {
        tool_call_id: "call-2",
        output: "Applied",
        is_error: false,
        cached: false,
      },
    },
  });

  expect(state.editedFiles).toEqual([
    { path: "src/lib.rs", additions: 3, deletions: 2 },
  ]);
});

test("agent activity hides raw approval preset names", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "tool_auto_approved",
    timestamp: "now",
    data: {
      kind: "tool_auto_approved",
      value: {
        reason: "preset-default",
      },
    },
  });

  expect(state.activities[0]).toMatchObject({
    label: "Approved automatically",
    detail: "Default preset allowed this action.",
  });
});

test("agent activity marks file-edit no-tool guard as failed", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "failed",
    timestamp: "now",
    data: {
      kind: "failed",
      value: {
        error: "File edit was requested, but no file changes were produced.",
      },
    },
  });

  expect(state.status).toBe("failed");
  expect(state.error).toContain("no file changes were produced");
});

test("agent activity renders structured safe activity event", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "now",
    data: {
      kind: "activity",
      value: {
        phase: "context_loading",
        title: "Reading files",
        summary: "Loaded test.txt from the selected workspace.",
        details: ["Target: test.txt"],
        status: "completed",
      },
    },
  });

  expect(state.activities[0]).toMatchObject({
    label: "Reading files",
    detail: "Loaded test.txt from the selected workspace.",
    status: "complete",
  });
  expect(state.activities[0].details).toContain("Loaded test.txt from the selected workspace.");
  expect(state.activities[0].details).toContain("Target: test.txt");
});

test("agent activity groups duplicate file events with details", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "tool_call_planned",
    timestamp: "now",
    data: {
      kind: "tool_call_planned",
      value: {
        tool_call_id: "read-1",
        tool_name: "read_file",
        arguments: { path: "package.json" },
      },
    },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "later",
    data: {
      kind: "activity",
      value: {
        phase: "context_loading",
        title: "Reading files",
        summary: "Loaded package.json.",
        details: ["Target: package.json"],
        status: "completed",
      },
    },
  });

  expect(state.activities).toHaveLength(1);
  expect(state.activities[0]).toMatchObject({
    label: "Reading files",
    status: "complete",
  });
  expect(state.activities[0].details).toContain("Target: package.json");
  expect(state.activities[0].details).toContain("Loaded package.json.");
});

test("agent activity sanitizes unsafe summary details", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "now",
    data: {
      kind: "activity",
      value: {
        phase: "reasoning",
        title: "Thinking",
        summary: "<|fim_prefix|> functions.propose_edit {\"path\":\"x\"}",
        details: ["functions.write_file {\"content\":\"secret\"}"],
        status: "running",
      },
    },
  });

  expect(JSON.stringify(state.activities)).not.toContain("fim_");
  expect(JSON.stringify(state.activities)).not.toContain("functions.");
  expect(JSON.stringify(state.activities)).not.toContain("{\"content\"");
});

test("agent activity accepts new run event aliases", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "run_started",
    timestamp: "now",
    data: { kind: "run_started" },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "run_cancelled",
    timestamp: "later",
    data: { kind: "run_cancelled" },
  });

  expect(state.status).toBe("cancelled");
  expect(state.activities.at(-1)?.label).toBe("Cancelled");
});

test("agent activity records final response deltas as responding state", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "final_response_delta",
    timestamp: "now",
    data: {
      kind: "final_response_delta",
      value: { text: "Hello" },
    },
  });

  expect(state.activities[0]).toMatchObject({
    label: "Responding",
    detail: "Receiving the model response.",
    status: "running",
  });
  expect(state.responseText).toBe("Hello");
  expect(state.respondedStreaming).toBe(true);
  expect(state.debugEvents?.[0]).toMatchObject({ kind: "final_response_delta" });
});

test("agent activity merges duplicate thinking events into one phase", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "model_call_started",
    timestamp: "now",
    data: { kind: "model_call_started", value: { step: 0 } },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "later",
    data: {
      kind: "activity",
      value: {
        phase: "reasoning",
        title: "Thinking",
        summary: "Understanding the request before choosing the next action.",
        status: "running",
      },
    },
  });

  const thinking = state.activities.filter((item) => item.toolCallId === "thinking");
  expect(thinking).toHaveLength(1);
  expect(buildSteps(state).filter((step) => step.label === "Thinking")).toHaveLength(1);
});

test("agent activity dedupes summaries and display details", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "now",
    data: {
      kind: "activity",
      value: {
        phase: "thinking",
        title: "Thinking",
        summary: "Waiting for the model response.",
        details: [
          "Waiting for the model response.",
          "waiting for the model response!",
          "Choosing files.",
        ],
        status: "running",
      },
    },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "later",
    data: {
      kind: "activity",
      value: {
        phase: "thinking",
        title: "Thinking",
        summary: "Waiting for the model response.",
        details: ["Choosing files."],
        status: "running",
      },
    },
  });

  expect(addUniqueDetail(["Waiting."], "waiting!")).toEqual(["Waiting."]);
  const step = buildSteps(state)[0];
  expect(step.summary).toBe("Waiting for the model response.");
  expect(step.details).toEqual(["Choosing files."]);
});

test("agent activity displays out-of-order phases in logical order", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "now",
    data: {
      kind: "activity",
      value: {
        phase: "file_read",
        title: "Reading files",
        summary: "Reading files.",
        status: "running",
      },
    },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "later",
    data: {
      kind: "activity",
      value: {
        phase: "workspace_inspection",
        title: "Inspecting workspace",
        summary: "Checking workspace.",
        status: "completed",
      },
    },
  });

  expect(buildSteps(state).map((step) => step.label)).toEqual([
    "Inspecting workspace",
    "Reading files",
  ]);
});

test("agent activity keeps only latest active major phase running", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "model_call_started",
    timestamp: "now",
    data: { kind: "model_call_started", value: { step: 0 } },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "tool_call_planned",
    timestamp: "later",
    data: {
      kind: "tool_call_planned",
      value: {
        tool_call_id: "search-1",
        tool_name: "search_files",
        arguments: { query: "Clarity" },
      },
    },
  });

  const steps = buildSteps(state);
  expect(steps.find((step) => step.label === "Thinking")?.status).toBe("complete");
  expect(steps.find((step) => step.label === "Searching files")?.status).toBe("running");
});

test("agent activity skips empty unknown activity summaries", () => {
  const state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "activity",
    timestamp: "now",
    data: {
      kind: "activity",
      value: {
        phase: "",
        title: "",
        summary: "   ",
        details: [" "],
        status: "running",
      },
    },
  });

  expect(buildSteps(state)).toHaveLength(0);
});

test("agent output reconciles delta plus same final once", () => {
  let output = outputState();
  output = applyOutputDelta(output, "Acknowledged.");
  output = applyOutputFinal(output, "Acknowledged.");
  expect(output.displayedText).toBe("Acknowledged.");
});

test("agent output replaces partial delta with full final", () => {
  let output = outputState();
  output = applyOutputDelta(output, "Hello");
  output = applyOutputFinal(output, "Hello world");
  expect(output.displayedText).toBe("Hello world");
});

test("agent output does not duplicate markdown equivalent final", () => {
  expect(reconcileFinalText("**Acknowledged.**", "Acknowledged.")).toBe("Acknowledged.");
  expect(reconcileFinalText("**Acknowledged.**", "Acknowledged.")).not.toBe("**Acknowledged.**Acknowledged.");
});

test("agent reducer reconciles streamed response with run_finished text", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "final_response_delta",
    timestamp: "now",
    data: {
      kind: "final_response_delta",
      value: { text: "**Acknowledged.**" },
    },
  });

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "run_finished",
    timestamp: "later",
    data: {
      kind: "run_finished",
      value: { text: "Acknowledged." },
    },
  });

  expect(state.responseText).toBe("Acknowledged.");
  expect(state.responseText).not.toBe("**Acknowledged.**Acknowledged.");
});

test("agent trace has no disclosure for empty completed step", () => {
  expect(hasDisclosureContent({
    type: "default",
    summary: "",
    details: [],
  })).toBe(false);
});

test("simple chat hides completed row", () => {
  let state = appendAgentEvent(baseState(), {
    run_id: "run-1",
    event_type: "final_response_delta",
    timestamp: "now",
    data: {
      kind: "final_response_delta",
      value: { text: "Hello" },
    },
  });
  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "run_finished",
    timestamp: "later",
    data: {
      kind: "run_finished",
      value: { text: "Hello" },
    },
  });

  expect(buildSteps(state).map((step) => step.label)).not.toContain("Completed");
});

test("trace persists after completion - run_finished preserves tool steps", () => {
  let state = baseState();
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "run_started", timestamp: "1", data: { kind: "run_started" } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_started", timestamp: "2", data: { kind: "model_call_started", value: { step: 0 } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_finished", timestamp: "3", data: { kind: "model_call_finished" } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "tool_call_planned", timestamp: "4", data: { kind: "tool_call_planned", value: { tool_call_id: "search-1", tool_name: "search_files", arguments: { query: "test" } } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "tool_call_finished", timestamp: "5", data: { kind: "tool_call_finished", value: { tool_call_id: "search-1", is_error: false, output: "found" } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "final_response_delta", timestamp: "6", data: { kind: "final_response_delta", value: { text: "Done" } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "run_finished", timestamp: "7", data: { kind: "run_finished", value: { text: "Done" } } });

  const steps = buildSteps(state);
  expect(steps.length).toBeGreaterThan(0);
  expect(steps.some(s => s.label.includes("Search"))).toBe(true);
  expect(steps.some(s => s.label.includes("Respond"))).toBe(true);
  expect(steps.every(s => s.status === "complete" || s.status === "error")).toBe(true);
});

test("run_finished completes all running phases", () => {
  let state = baseState();
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "run_started", timestamp: "1", data: { kind: "run_started" } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_started", timestamp: "2", data: { kind: "model_call_started", value: { step: 0 } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "run_finished", timestamp: "3", data: { kind: "run_finished", value: { text: "Hello" } } });

  const steps = buildSteps(state);
  const running = steps.filter(s => s.status === "running");
  expect(running).toHaveLength(0);
});

test("final_response_delta snapshot mode replaces responseText", () => {
  let state = baseState();
  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "final_response_delta",
    timestamp: "1",
    data: { kind: "final_response_delta", value: { text: "# Test", mode: "snapshot" } },
  });
  expect(state.responseText).toBe("# Test");

  state = appendAgentEvent(state, {
    run_id: "run-1",
    event_type: "final_response_delta",
    timestamp: "2",
    data: { kind: "final_response_delta", value: { text: "# Test Response\n- Received.", mode: "snapshot" } },
  });
  expect(state.responseText).toBe("# Test Response\n- Received.");
  expect(state.responseText).not.toBe("# Test# Test Response\n- Received.");
});

test("completed step has deterministic summary when detail is empty", () => {
  const steps = buildSteps({
    status: "completed",
    startedAt: "now",
    permissionPreset: "default",
    activities: [
      { id: "t1", toolCallId: "thinking", kind: "reasoning", label: "Thinking", status: "complete" },
      { id: "r1", toolCallId: "responding", kind: "reasoning", label: "Responding", status: "complete" },
    ],
    toolCalls: {},
    approvals: [],
    editedFiles: [],
  });
  expect(steps.length).toBeGreaterThan(0);
  for (const step of steps) {
    expect(step.summary).toBeTruthy();
    expect(step.summary?.length).toBeGreaterThan(0);
  }
});

test("hasDisclosureContent false when all fields empty", () => {
  expect(hasDisclosureContent({ type: "default", summary: "", details: [] })).toBe(false);
  expect(hasDisclosureContent({ type: "default", summary: "has text", details: [] })).toBe(true);
  expect(hasDisclosureContent({ type: "default", summary: "", details: ["has text"] })).toBe(true);
});

test("disclosure content and summaries survive run_finished", () => {
  let state = baseState();
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "run_started", timestamp: "1", data: { kind: "run_started" } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_started", timestamp: "2", data: { kind: "model_call_started", value: { step: 0 } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_finished", timestamp: "3", data: { kind: "model_call_finished" } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "tool_call_planned", timestamp: "4", data: { kind: "tool_call_planned", value: { tool_call_id: "search-1", tool_name: "search_files", arguments: { query: "clarity" } } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "tool_call_finished", timestamp: "5", data: { kind: "tool_call_finished", value: { tool_call_id: "search-1", is_error: false, output: "found" } } });
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "final_response_delta", timestamp: "6", data: { kind: "final_response_delta", value: { text: "Done" } } });

  /* Capture steps before finish */
  const beforeSteps = buildSteps(state);
  const thinkingBefore = beforeSteps.find(s => s.label === "Thinking");
  expect(thinkingBefore?.summary?.length).toBeGreaterThan(0);
  const searchBefore = beforeSteps.find(s => s.label.includes("Search"));
  expect(searchBefore?.summary?.length).toBeGreaterThan(0);

  /* Apply run_finished */
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "run_finished", timestamp: "7", data: { kind: "run_finished", value: { text: "Done" } } });
  const afterSteps = buildSteps(state);

  /* Steps still exist */
  expect(afterSteps.length).toBeGreaterThan(1);

  /* Thinking summary survives */
  const thinkingAfter = afterSteps.find(s => s.label === "Thinking");
  expect(thinkingAfter).toBeDefined();
  expect(thinkingAfter?.summary?.length).toBeGreaterThan(0);
  expect(thinkingAfter?.summary).toBe(thinkingBefore?.summary);

  /* Searching files summary survives */
  const searchAfter = afterSteps.find(s => s.label.includes("Search"));
  expect(searchAfter).toBeDefined();
  expect(searchAfter?.summary?.length).toBeGreaterThan(0);

  /* All completed steps with content must have hasDisclosureContent = true */
  for (const step of afterSteps) {
    if (step.summary?.trim() || step.details?.length) {
      expect(hasDisclosureContent(step)).toBe(true);
    }
  }

  /* Tool details still present */
  const editSteps = afterSteps.filter(s => s.type === "default");
  for (const s of editSteps) {
    if (s.summary) {
      expect(hasDisclosureContent(s)).toBe(true);
    }
  }
});

test("sparse completed event does not wipe rich step summary", () => {
  let state = baseState();
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_started", timestamp: "1", data: { kind: "model_call_started", value: { step: 0 } } });
  const before = buildSteps(state);
  const thinkingSummary = before.find(s => s.label === "Thinking")?.summary;
  expect(thinkingSummary?.length).toBeGreaterThan(0);

  /* model_call_finished only changes status, not detail */
  state = appendAgentEvent(state, { run_id: "run-1", event_type: "model_call_finished", timestamp: "2", data: { kind: "model_call_finished" } });
  const after = buildSteps(state);
  const thinkingAfter = after.find(s => s.label === "Thinking");
  expect(thinkingAfter?.summary).toBe(thinkingSummary);
  expect(thinkingAfter?.status).toBe("complete");
});

function outputState(): AgentOutputState {
  return {
    streamedText: "",
    finalText: null,
    displayedText: "",
    hasReceivedDeltas: false,
    isFinalized: false,
  };
}
