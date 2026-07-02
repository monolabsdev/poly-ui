import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sanitizeOutput } from "@/lib/chat/sanitize";
import { StreamSession } from "@/lib/chat/stream-session";
import { StreamAccumulator } from "@/lib/chat/stream-accumulator";

// No vi.* helpers here — CI runs this under `bun test`, whose vitest shim
// lacks stubGlobal/useFakeTimers. Plain assignment works in both runners.
const g = globalThis as Record<string, unknown>;
const realNow = Date.now;

beforeAll(() => {
  // Node env has no rAF; accumulator schedules flushes with it
  g.requestAnimationFrame = (cb: (t: number) => void) => {
    cb(0);
    return 0;
  };
  g.cancelAnimationFrame = () => {};
});

afterAll(() => {
  Date.now = realNow;
  delete g.requestAnimationFrame;
  delete g.cancelAnimationFrame;
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
    let now = 1_000_000;
    Date.now = () => now;
    const session = makeSession();
    session.applyThinking({ request_id: "r1", thinking: "hmm", is_thinking: true });
    now += 3000;
    session.applyThinking({ request_id: "r1", thinking: "hmm done", is_thinking: false });
    now += 60000; // long answer afterwards
    expect(session.thinkingDuration("r1")).toBe(3);
    Date.now = realNow;
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
    g.requestAnimationFrame = () => 1;
    acc.queueTokenBatch("m2", "sibling content");
    acc.reset(["r1"]); // one stream finished
    g.requestAnimationFrame = (cb: (t: number) => void) => {
      cb(0);
      return 0;
    };

    acc.flush();
    expect(flushed).toEqual([{ m2: "sibling content" }]);
  });
});
