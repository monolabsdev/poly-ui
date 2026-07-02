import { beforeAll, describe, expect, it, vi } from "vitest";
import { sanitizeOutput } from "@/lib/chat/sanitize";
import { StreamSession } from "@/lib/chat/stream-session";
import { StreamAccumulator } from "@/lib/chat/stream-accumulator";

beforeAll(() => {
  // Node env has no rAF; accumulator schedules flushes with it
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

describe("sanitizeOutput", () => {
  it("passes short legit answers through untouched", () => {
    expect(sanitizeOutput("4")).toBe("4");
    expect(sanitizeOutput("Yes.")).toBe("Yes.");
  });

  it("still falls back when sanitization guts the response", () => {
    expect(sanitizeOutput("<|assistant|>")).toMatch(/formatting issue/);
  });

  it("strips chat-template tokens but keeps legit markup", () => {
    expect(sanitizeOutput("Use <user> tags in your XML schema")).toBe(
      "Use <user> tags in your XML schema",
    );
    expect(sanitizeOutput("Hello <|user|> world")).toBe("Hello  world");
  });
});

describe("StreamSession", () => {
  function makeSession() {
    const session = new StreamSession();
    session.start(1);
    session.register({ requestId: "r1", messageId: "m1", conversationId: "c1" });
    return session;
  }

  it("thinking duration excludes answer generation time", () => {
    vi.useFakeTimers();
    const session = makeSession();
    session.applyThinking({ request_id: "r1", thinking: "hmm", is_thinking: true });
    vi.advanceTimersByTime(3000);
    session.applyThinking({ request_id: "r1", thinking: " done", is_thinking: false });
    vi.advanceTimersByTime(60000); // long answer afterwards
    expect(session.thinkingDuration("r1")).toBe(3);
    vi.useRealTimers();
  });

  it("thinking events carry full text — latest payload wins, no duplication", () => {
    const session = makeSession();
    session.applyThinking({ request_id: "r1", thinking: "a", is_thinking: true });
    const update = session.applyThinking({ request_id: "r1", thinking: "ab", is_thinking: true });
    expect(update?.patch.thinking).toBe("ab");
  });

  it("finish is idempotent so double-settled errors cannot end the session early", () => {
    const session = new StreamSession();
    session.start(2);
    session.register({ requestId: "r1", messageId: "m1", conversationId: "c1" });
    session.register({ requestId: "r2", messageId: "m2", conversationId: "c1" });
    session.finish("r1");
    session.finish("r1"); // duplicate settle
    expect(session.isComplete()).toBe(false);
    session.finish("r2");
    expect(session.isComplete()).toBe(true);
  });
});

describe("StreamAccumulator partial reset", () => {
  it("keeps sibling streams' pending updates when one stream finishes", () => {
    const acc = new StreamAccumulator();
    const flushed: Record<string, string>[] = [];
    acc.onFlush((updates) => flushed.push(updates));

    // Simulate a sibling with a queued update, without letting rAF fire yet
    vi.stubGlobal("requestAnimationFrame", () => 1);
    acc.queueTokenBatch("m2", "sibling content");
    acc.reset(["r1"]); // one stream finished

    acc.flush();
    expect(flushed).toEqual([{ m2: "sibling content" }]);
  });
});
