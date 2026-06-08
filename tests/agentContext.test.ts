import { expect, test } from "bun:test";
import { buildAgentResolvedContext, isFollowUpInstruction } from "../src/features/agent/context";
import type { Message } from "../src/types/chat";

function user(content: string): Message {
  return {
    id: crypto.randomUUID(),
    conversationId: "c1",
    role: "user",
    content,
    createdAt: "2026-06-07T00:00:00.000Z",
  };
}

function agentWithCall(toolName: string, path: string): Message {
  return {
    id: crypto.randomUUID(),
    conversationId: "c1",
    role: "assistant",
    content: "",
    createdAt: "2026-06-07T00:00:00.000Z",
    agent: {
      status: "completed",
      startedAt: "2026-06-07T00:00:00.000Z",
      permissionPreset: "default",
      activities: [],
      toolCalls: {
        c1: {
          id: "c1",
          name: toolName,
          status: "completed",
          arguments: { path },
          isError: false,
        },
      },
      approvals: [],
      editedFiles: toolName === "apply_patch" ? [{ path, additions: 1, deletions: 0 }] : [],
    },
  };
}

test("follow-up uses file read after user names test.txt", () => {
  const context = buildAgentResolvedContext({
    messages: [user("test.txt"), agentWithCall("read_file", "test.txt")],
    prompt: "add another sentence",
    workspacePath: "C:/workspace",
  });

  expect(context.activeFile).toBe("test.txt");
  expect(context.recentlyViewedFiles).toContain("test.txt");
  expect(isFollowUpInstruction("add another sentence")).toBe(true);
});

test("follow-up without active file has no target", () => {
  const context = buildAgentResolvedContext({
    messages: [],
    prompt: "add another sentence",
    workspacePath: "C:/workspace",
  });

  expect(context.activeFile).toBeUndefined();
});

test("recent do-not-remove constraint is preserved", () => {
  const context = buildAgentResolvedContext({
    messages: [user("Add another sentence to it. DO NOT REMOVE ANY"), agentWithCall("read_file", "test.txt")],
    prompt: "add another sentence",
  });

  expect(context.activeFile).toBe("test.txt");
  expect(context.recentConstraints).toContain("Preserve existing content; do not remove anything.");
});

test("most recent read file wins over older edit", () => {
  const context = buildAgentResolvedContext({
    messages: [agentWithCall("apply_patch", "a.txt"), agentWithCall("read_file", "b.txt")],
    prompt: "add another sentence",
  });

  expect(context.activeFile).toBe("b.txt");
});

test("multiple recent files without active file asks later", () => {
  const context = buildAgentResolvedContext({
    messages: [
      {
        id: "m1",
        conversationId: "c1",
        role: "assistant",
        content: "",
        createdAt: "2026-06-07T00:00:00.000Z",
        agent: {
          status: "completed",
          startedAt: "2026-06-07T00:00:00.000Z",
          permissionPreset: "default",
          activities: [],
          toolCalls: {},
          approvals: [],
          editedFiles: [],
          context: {
            recentlyViewedFiles: ["a.txt", "b.txt"],
            recentlyEditedFiles: [],
          },
        },
      },
    ],
    prompt: "edit it",
  });

  expect(context.activeFile).toBeUndefined();
});

test("explicit file wins over previous active file", () => {
  const context = buildAgentResolvedContext({
    messages: [agentWithCall("read_file", "a.txt")],
    prompt: "add another sentence to test.txt",
  });

  expect(context.activeFile).toBe("test.txt");
});
