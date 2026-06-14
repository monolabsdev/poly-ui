import { describe, expect, it } from "vitest";
import { parseCommandIntent } from "../src/features/command-palette/intentParser";

describe("command palette intent parser", () => {
  it.each([
    ["theme light", "light"],
    ["light theme", "light"],
    ["switch to light mode", "light"],
    ["use dark mode", "dark"],
    ["switch to dark mode", "dark"],
    ["set appearance system", "system"],
    ["appearance auto", "system"],
    ["make it night mode", "dark"],
  ])("parses theme intent: %s", (input, theme) => {
    const intent = parseCommandIntent(input);
    expect(intent?.command).toBe("set-theme");
    expect(intent?.args).toEqual({ theme });
    expect(intent?.confidence).toBeGreaterThanOrEqual(0.62);
  });

  it.each([
    "delete all",
    "delete all chats",
    "clear chats",
    "remove every conversation",
    "remove all conversations",
  ])("parses destructive delete intent: %s", (input) => {
    const intent = parseCommandIntent(input);
    expect(intent?.command).toBe("delete-all-chats");
    expect(intent?.args).toEqual({});
    expect(intent?.destructive).toBe(true);
  });

  it.each([
    "new chat",
    "new conversation",
    "start chat",
    "create chat",
  ])("parses new chat intent: %s", (input) => {
    const intent = parseCommandIntent(input);
    expect(intent?.command).toBe("new-chat");
    expect(intent?.args).toEqual({});
  });

  it.each([
    "open settings",
    "settings",
    "show settings",
    "go to settings",
  ])("parses settings intent: %s", (input) => {
    const intent = parseCommandIntent(input);
    expect(intent?.command).toBe("open-settings");
    expect(intent?.args).toEqual({});
  });

  it.each([
    ["search chats project alpha", "project alpha"],
    ["find conversations budget plan", "budget plan"],
    ["project alpha search chats", "project alpha"],
  ])("parses search intent: %s", (input, query) => {
    const intent = parseCommandIntent(input);
    expect(intent?.command).toBe("search-chats");
    expect(intent?.args).toEqual({ query });
  });

  it.each([
    ["rename chat budget plan", "budget plan"],
    ["rename conversation project alpha", "project alpha"],
    ["budget plan rename chat", "budget plan"],
  ])("parses rename intent: %s", (input, title) => {
    const intent = parseCommandIntent(input);
    expect(intent?.command).toBe("rename-chat");
    expect(intent?.args).toEqual({ title });
  });

  it("returns null for unknown input", () => {
    expect(parseCommandIntent("what is the weather tomorrow")).toBeNull();
  });
});
