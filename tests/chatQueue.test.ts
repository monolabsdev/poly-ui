import { expect, test } from "bun:test";
import { getNextQueuedMessage } from "../src/lib/chat/queue";

test("returns queued prompts in send order", () => {
  const queue = [
    { id: "first", conversationId: "chat-1", content: "A" },
    { id: "other", conversationId: "chat-2", content: "ignore" },
    { id: "second", conversationId: "chat-1", content: "B" },
  ];

  expect(getNextQueuedMessage(queue, "chat-1")?.id).toBe("first");
});
