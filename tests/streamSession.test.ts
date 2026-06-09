import { expect, test } from "bun:test";
import { StreamSession } from "../src/lib/chat/stream-session";

test("completes request bookkeeping and pending stream count", () => {
  const session = new StreamSession();
  session.start(2);
  session.register({ requestId: "req-1", messageId: "msg-1", conversationId: "chat-1" });
  session.register({ requestId: "req-2", messageId: "msg-2", conversationId: "chat-1" });

  expect(session.finish("req-1")).toBe(1);
  expect(session.messageIdForRequest("req-1")).toBeUndefined();
  expect(session.messageIdForRequest("req-2")).toBe("msg-2");
  expect(session.isComplete()).toBe(false);

  expect(session.finish("req-2")).toBe(0);
  expect(session.isComplete()).toBe(true);
});

test("accumulates chunks and returns completed content", () => {
  const session = new StreamSession();
  session.start(1);
  session.register({ requestId: "req-1", messageId: "msg-1", conversationId: "chat-1" });

  expect(session.applyChunk({ request_id: "req-1", content: "Hel", done: false })).toBeNull();
  const completed = session.applyChunk({ request_id: "req-1", content: "lo", done: true });

  expect(completed).toMatchObject({
    requestId: "req-1",
    messageId: "msg-1",
    conversationId: "chat-1",
    content: "Hello",
  });
});

test("merges web search results by url", () => {
  const session = new StreamSession();
  session.start(1);
  session.register({ requestId: "req-1", messageId: "msg-1", conversationId: "chat-1" });

  const patch = session.applyWebSearch(
    {
      request_id: "req-1",
      query: "polyui",
      status: "complete",
      results: [
        { title: "A", url: "https://a.example", highlights: [] },
        { title: "B", url: "https://b.example", highlights: [] },
      ],
    },
    {
      id: "msg-1",
      conversationId: "chat-1",
      role: "assistant",
      content: "",
      createdAt: "",
      webSearch: {
        request_id: "req-1",
        query: "polyui",
        status: "searching",
        results: [{ title: "A old", url: "https://a.example", highlights: [] }],
      },
    },
  );

  expect(patch?.webSearch?.results?.map((result) => result.url)).toEqual([
    "https://a.example",
    "https://b.example",
  ]);
});
