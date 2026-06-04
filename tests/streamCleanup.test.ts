import { expect, test } from "bun:test";
import { clearRequestBookkeeping } from "../src/lib/chat/stream-cleanup";

test("clears failed request bookkeeping and decrements pending streams", () => {
  const messageIds = { "req-1": "msg-1", "req-2": "msg-2" };
  const conversationIds = { "req-1": "chat-1", "req-2": "chat-1" };

  const pending = clearRequestBookkeeping(
    "req-1",
    messageIds,
    conversationIds,
    2,
  );

  expect(pending).toBe(1);
  expect(messageIds).toEqual({ "req-2": "msg-2" });
  expect(conversationIds).toEqual({ "req-2": "chat-1" });
});

test("never decrements pending stream count below zero", () => {
  expect(clearRequestBookkeeping("missing", {}, {}, 0)).toBe(0);
});
