import { appendAgentEvent } from "../src/features/agent/activity";
import { buildAgentPrompt } from "../src/features/agent/prompt";
import type { AgentMessageState } from "../src/features/agent/types";
import type { AgentRawEvent } from "../src/features/agent/agentClient";
import { readFileSync } from "node:fs";

describe("Poly Agent workflow", () => {
  it("builds a Poly Agent execution prompt for file edits", () => {
    const prompt = buildAgentPrompt("Fix the header", true, "src/App.tsx");

    expect(prompt).toContain("You are Poly Agent");
    expect(prompt).toContain("Execute, don't echo");
    expect(prompt).toContain("read -> understand -> change -> verify");
    expect(prompt).toContain("Prefer apply_patch for targeted edits");
    expect(prompt).toContain("Target file for this current request: src/App.tsx");
    expect(prompt).toContain("Do not answer as complete unless the file tool succeeds");
  });

  it("maps agent tool names into Poly activity phases", () => {
    let state = baseAgentState();

    state = appendAgentEvent(state, toolRequested("1", "grep", { pattern: "Agent", path: "src" }));
    state = appendAgentEvent(state, toolRequested("2", "edit", { path: "src/App.tsx" }));
    state = appendAgentEvent(state, toolRequested("3", "bash_run", { command: "npm test" }));

    expect(state.activities.map((item) => item.toolCallId)).toEqual([
      "file_search",
      "editing",
      "command:bash_run",
    ]);
    expect(state.activities.map((item) => item.label)).toEqual([
      "Searching files",
      "Editing files",
      "Running command",
    ]);
  });

  it("streams provider reasoning deltas into Poly Agent activity", () => {
    const runtime = readFileSync("src/features/agent/sdkRuntime.ts", "utf8");

    expect(runtime).toContain("reasoning: \"medium\"");
    expect(runtime).toContain("reasoning-delta");
    expect(runtime).toContain("part.text");
  });
});

function baseAgentState(): AgentMessageState {
  return {
    status: "running",
    startedAt: "2026-06-30T00:00:00.000Z",
    permissionPreset: "default",
    activities: [],
    toolCalls: {},
    approvals: [],
    editedFiles: [],
    debugEvents: [],
  };
}

function toolRequested(
  id: string,
  name: string,
  args: Record<string, unknown>,
): AgentRawEvent {
  return {
    run_id: "run-1",
    event_type: "agent",
    timestamp: "2026-06-30T00:00:00.000Z",
    data: {
      kind: "tool_call_requested",
      value: {
        tool_call_id: id,
        tool_name: name,
        arguments: args,
      },
    },
  } as AgentRawEvent;
}
