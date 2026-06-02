import { describe, expect, test } from "bun:test";
import { filterSearchConversations } from "./conversation-search";

const conversations = [
  { id: "1", title: "Alpha plan", createdAt: "2026-06-01", updatedAt: "2026-06-01", isArchived: false },
  { id: "2", title: "Beta notes", createdAt: "2026-06-01", updatedAt: "2026-06-01", isArchived: false },
  { id: "3", title: "Alpha archive", createdAt: "2026-06-01", updatedAt: "2026-06-01", isArchived: true },
];

describe("filterSearchConversations", () => {
  test("filters titles case-insensitively and excludes archived chats", () => {
    expect(filterSearchConversations(conversations, "ALPHA").map((chat) => chat.id)).toEqual(["1"]);
  });
});
