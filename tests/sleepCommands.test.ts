import { describe, expect, it } from "vitest";
import { matchesSleepCommand } from "../src/lib/dictation/sleepCommands";

describe("sleep commands", () => {
  it("matches whole-utterance sleep phrases", () => {
    for (const phrase of [
      "Go to sleep",
      "quit",
      "Shush!",
      "Shut down.",
      "go away",
      "Stop listening",
      "Goodbye",
    ]) {
      expect(matchesSleepCommand(phrase)).toBe(true);
    }
  });

  it("tolerates leading and trailing pleasantries", () => {
    expect(matchesSleepCommand("Okay, go to sleep now.")).toBe(true);
    expect(matchesSleepCommand("Please shut down, thanks.")).toBe(true);
    expect(matchesSleepCommand("Hey, shush please")).toBe(true);
  });

  it("never matches sleep phrases embedded in real questions", () => {
    expect(matchesSleepCommand("How do I shut down my PC?")).toBe(false);
    expect(matchesSleepCommand("Why won't my laptop go to sleep?")).toBe(false);
    expect(matchesSleepCommand("Tell me about sleep hygiene")).toBe(false);
    expect(matchesSleepCommand("Did the process quit unexpectedly?")).toBe(false);
  });
});
