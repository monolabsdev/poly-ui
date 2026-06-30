import { buildSteps } from "../src/features/agent/activity/buildSteps";
import type { AgentMessageState } from "../src/features/agent/types";

describe("agent activity steps", () => {
  it("shows one clean file edit step after a completed full-access write", () => {
    const agent: AgentMessageState = {
      status: "completed",
      startedAt: "2026-06-30T00:00:00.000Z",
      completedAt: "2026-06-30T00:00:02.000Z",
      permissionPreset: "full-access",
      activities: [
        { id: "edit", kind: "tool", label: "Editing files", status: "complete", toolCallId: "write-1", detail: "Preparing a targeted file change for random.txt.", details: ["Target: random.txt"] },
        { id: "respond", kind: "reasoning", label: "Responding", status: "complete", toolCallId: "responding", detail: "Response complete." },
        { id: "approval", kind: "auto_review", label: "Approved automatically", status: "complete", detail: "Full access enabled." },
      ],
      toolCalls: {
        "write-1": {
          id: "write-1",
          name: "write_file",
          status: "completed",
          arguments: { path: "random.txt", content: "hello" },
        },
      },
      approvals: [],
      editedFiles: [{ path: "random.txt", additions: 1, deletions: 0 }],
    };

    const steps = buildSteps(agent);

    expect(steps.map((step) => step.label)).toEqual(["Updated random.txt"]);
    expect(steps[0]?.files).toEqual(agent.editedFiles);
  });
});
