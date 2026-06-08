import { expect, test } from "bun:test";
import {
  buildAgentResolvedContext,
  detectFileEditIntent,
  extractFileMentions,
} from "../src/features/agent/context";
import type { Message } from "../src/types/chat";

test("new explicit file target overrides previous agent file context", () => {
  const messages: Message[] = [
    {
      id: "a1",
      conversationId: "c1",
      role: "assistant",
      content: "Done",
      createdAt: "2026-06-08T00:00:00.000Z",
      status: "complete",
      agent: {
        status: "completed",
        startedAt: "2026-06-08T00:00:00.000Z",
        permissionPreset: "default",
        activities: [],
        toolCalls: {},
        approvals: [],
        editedFiles: [{ path: "test.txt", additions: 1, deletions: 0 }],
        context: {
          activeFile: "test.txt",
          recentlyViewedFiles: ["test.txt"],
          recentlyEditedFiles: ["test.txt"],
        },
      },
    },
  ];

  const context = buildAgentResolvedContext({
    messages,
    prompt: "Add a file. Call it amaze.txt. Add some nice text inside",
    workspacePath: "sandbox:c1",
  });

  expect(extractFileMentions("Call it amaze.txt")).toEqual(["amaze.txt"]);
  expect(context.activeFile).toBe("amaze.txt");
  expect(detectFileEditIntent("Add a file. Call it amaze.txt. Add some nice text inside")).toBe(true);
});

test("conversational prompt does not become stale file edit intent", () => {
  expect(detectFileEditIntent("Hi")).toBe(false);
  expect(extractFileMentions("Hi")).toEqual([]);
});
