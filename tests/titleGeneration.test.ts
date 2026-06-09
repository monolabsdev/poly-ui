import { expect, test } from "bun:test";

/* Pure functions inlined to avoid store import chain. Keep sync with title-generation.ts */

const REJECTED_TITLES = new Set([
  "new chat", "untitled", "chat", "conversation", "help",
  "greeting", "greetings", "hi", "hello", "hey",
]);

function sanitizeTitle(raw: string | null | undefined, userMessage?: string): string | null {
  if (!raw) return null;
  let t = raw.trim();
  if (!t || t.length < 2) return null;
  if (t.includes("\n")) return null;
  if (/```/.test(t)) return null;
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/\.$/, "");
  t = t.replace(/[#*_~`>|\\]/g, "");
  t = t.replace(/\s+/g, " ");
  if (t.length > 48) return null;
  if (userMessage) {
    const userNorm = userMessage.replace(/[^a-z0-9\s]/gi, "").toLowerCase().trim();
    const titleNorm = t.replace(/[^a-z0-9\s]/gi, "").toLowerCase().trim();
    if (userNorm.startsWith(titleNorm) && userNorm.length > titleNorm.length) return null;
  }
  const lower = t.toLowerCase();
  if (REJECTED_TITLES.has(lower)) return null;
  if (/^(i|i'm|i'll|i'd|i've|me|my|you|your|we|let's)\b/i.test(t)) return null;
  if (t.includes("{") && t.includes("}")) {
    const bc = (t.match(/{/g) || []).length + (t.match(/}/g) || []).length;
    if (bc > 4) return null;
  }
  if (/function\s*\(|tool_call|<\|(fim|channel)|\$\{|process\.\w+/.test(t)) return null;
  if (/^\d+$/.test(t)) return null;
  return t;
}

function fallbackFromFirstUser(content: string): string {
  let clean = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[`"'\u201C\u201D]/g, "")
    .trim();
  if (clean.length > 40) clean = clean.slice(0, 40).trimEnd();

  const fileMatch = content.match(/(?:edit|create|add|update|delete|remove|rename)\s+.*?(\S+\.\w+)/i);
  if (fileMatch) return `Edit ${fileMatch[1]}`;

  const topicPatterns = [
    /(?:help\s+me\s+)?(?:understand|learn|explain|know|figure\s+out)\s+(?:what|how|why|about\s+)?(.+)/i,
    /(?:tell|talk|speak)\s+me\s+about\s+(.+)/i,
    /(?:i\s+need\s+(?:you\s+to\s+)?|could\s+you|can\s+you|would\s+you)\s+(?:help\s+)?(.+)/i,
    /what\s+is\s+(.+)/i,
    /explain\s+(.+)/i,
    /describe\s+(.+)/i,
    /show\s+me\s+(.+)/i,
  ];
  for (const pat of topicPatterns) {
    const m = content.match(pat);
    if (m) {
      const topic = m[1]
        .replace(/[?.!,;]+$/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (topic && topic.length >= 3) {
        const topicWords = topic.split(/\s+/).slice(0, 5);
        if (topicWords.length < 4) return topicWords.join(" ");
        return topicWords.map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
      }
    }
  }

  const qwords = clean.split(/\s+/);
  const first = qwords[0]?.toLowerCase() ?? "";
  const questionWords = ["what", "how", "why", "when", "where", "who", "is", "are", "can", "does", "do", "explain", "describe"];
  if (questionWords.includes(first)) {
    const rest = qwords.slice(1, 5);
    if (rest.length === 0) return first.charAt(0).toUpperCase() + first.slice(1);
    return rest.map((w, i) => {
      const stripped = w.replace(/[?.!,;]+$/, "");
      return i === 0 ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : stripped;
    }).filter(Boolean).join(" ");
  }

  const words = qwords.slice(0, 6);
  if (words.length === 1) return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(" ");
}

test("sanitizeTitle strips surrounding quotes", () => {
  expect(sanitizeTitle('"Clarity App Overview"')).toBe("Clarity App Overview");
  expect(sanitizeTitle("'Swift Video Blur'")).toBe("Swift Video Blur");
  expect(sanitizeTitle("`Edit test.txt`")).toBe("Edit test.txt");
});

test("sanitizeTitle rejects empty/null/too-short", () => {
  expect(sanitizeTitle(null)).toBe(null);
  expect(sanitizeTitle("")).toBe(null);
  expect(sanitizeTitle("  ")).toBe(null);
  expect(sanitizeTitle("A")).toBe(null);
});

test("sanitizeTitle strips trailing period", () => {
  expect(sanitizeTitle("Clarity App Overview.")).toBe("Clarity App Overview");
});

test("sanitizeTitle removes markdown formatting", () => {
  expect(sanitizeTitle("**Clarity App**")).toBe("Clarity App");
  expect(sanitizeTitle("*italic title*")).toBe("italic title");
  expect(sanitizeTitle("~~strikethrough~~")).toBe("strikethrough");
});

test("sanitizeTitle removes HTML tags", () => {
  expect(sanitizeTitle("<b>Clarity App</b>")).toBe("Clarity App");
});

test("sanitizeTitle rejects newlines", () => {
  expect(sanitizeTitle("Title\nwith\nnewlines")).toBe(null);
});

test("sanitizeTitle rejects overly long titles", () => {
  expect(sanitizeTitle("This is a very long title that exceeds the maximum character limit")).toBe(null);
});

test("sanitizeTitle rejects generic titles", () => {
  expect(sanitizeTitle("New Chat")).toBe(null);
  expect(sanitizeTitle("Untitled")).toBe(null);
  expect(sanitizeTitle("Chat")).toBe(null);
  expect(sanitizeTitle("Conversation")).toBe(null);
  expect(sanitizeTitle("Help")).toBe(null);
});

test("sanitizeTitle rejects raw user-message prefixes", () => {
  const msg = "I need you to help me understand what the clarity project is";
  expect(sanitizeTitle("I need you to help", msg)).toBe(null);
  expect(sanitizeTitle("I need you", msg)).toBe(null);
  expect(sanitizeTitle("Clarity App", msg)).toBe("Clarity App");
});

test("sanitizeTitle rejects first-person pronoun titles", () => {
  expect(sanitizeTitle("I need you to help me")).toBe(null);
  expect(sanitizeTitle("I think this is good")).toBe(null);
  expect(sanitizeTitle("You should know that")).toBe(null);
  expect(sanitizeTitle("My project overview")).toBe(null);
  expect(sanitizeTitle("Let's start with hello")).toBe(null);
});

test("sanitizeTitle rejects tool/debug syntax", () => {
  expect(sanitizeTitle("```json")).toBe(null);
  expect(sanitizeTitle('function(a, b)')).toBe(null);
  expect(sanitizeTitle("process.env.SECRET")).toBe(null);
});

test("sanitizeTitle accepts valid titles", () => {
  expect(sanitizeTitle("Clarity App Overview")).toBe("Clarity App Overview");
  expect(sanitizeTitle("Swift Video Blur")).toBe("Swift Video Blur");
  expect(sanitizeTitle("Edit test.txt")).toBe("Edit test.txt");
  expect(sanitizeTitle("Project File Overview")).toBe("Project File Overview");
});

test("sanitizeTitle compacts whitespace", () => {
  expect(sanitizeTitle("Clarity   App   Overview")).toBe("Clarity App Overview");
});

test("fallbackFromFirstUser extracts topic from request patterns", () => {
  const r = fallbackFromFirstUser("I need you to help me understand what the clarity project is");
  expect(r).toMatch(/clarity/i);
  expect(r).not.toMatch(/^I /);
  expect(r).not.toContain("need");
});

test("fallbackFromFirstUser extracts topic from tell-me-about", () => {
  const r = fallbackFromFirstUser("Tell me about the Clarity app");
  expect(r).toMatch(/clarity/i);
  expect(r).not.toMatch(/^tell/i);
});

test("fallbackFromFirstUser handles what-is", () => {
  const r = fallbackFromFirstUser("What is the Clarity app project");
  expect(r).toMatch(/clarity/i);
});

test("fallbackFromFirstUser handles file edit intent", () => {
  expect(fallbackFromFirstUser("add any sentence to test.txt")).toBe("Edit test.txt");
  expect(fallbackFromFirstUser("edit README.md to include instructions")).toBe("Edit README.md");
  expect(fallbackFromFirstUser("create new file index.html")).toBe("Edit index.html");
});

test("fallbackFromFirstUser handles short single word", () => {
  expect(fallbackFromFirstUser("Hello")).toBe("Hello");
  expect(fallbackFromFirstUser("hello")).toBe("Hello");
});

test("fallbackFromFirstUser strips code blocks", () => {
  const r = fallbackFromFirstUser("add console.log to the file");
  expect(r).not.toContain("`");
});

test("fallbackFromFirstUser caps at 40 chars", () => {
  const r = fallbackFromFirstUser("a".repeat(50));
  expect(r.length).toBeLessThanOrEqual(40);
});

test("fallbackFromFirstUser strips quotes", () => {
  const r = fallbackFromFirstUser('"testing 1 2 3"');
  expect(r).not.toContain('"');
});

test("fallbackFromFirstUser produces title-case for short prompts", () => {
  expect(fallbackFromFirstUser("testing 1 2 3")).toBe("Testing 1 2 3");
  expect(fallbackFromFirstUser("hello world")).toBe("Hello world");
});
