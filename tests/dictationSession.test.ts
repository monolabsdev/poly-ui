import { expect, test } from "bun:test";
import { runDictationTranscription } from "../src/hooks/dictationSession";

test("delivers a transcript when async transcription completes", async () => {
  const delivered: string[] = [];
  const errors: string[] = [];

  await runDictationTranscription({
    isCurrentSession: () => true,
    transcribe: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "hello from dictation";
    },
    onTranscript: (text) => delivered.push(text),
    onError: (message) => errors.push(message),
  });

  expect(delivered).toEqual(["hello from dictation"]);
  expect(errors).toEqual([]);
});

test("ignores stale dictation results", async () => {
  const delivered: string[] = [];

  await runDictationTranscription({
    isCurrentSession: () => false,
    transcribe: async () => "stale text",
    onTranscript: (text) => delivered.push(text),
  });

  expect(delivered).toEqual([]);
});

test("delivers empty transcript when speech not detected", async () => {
  const delivered: string[] = [];

  await runDictationTranscription({
    isCurrentSession: () => true,
    transcribe: async () => "",
    onTranscript: (text) => delivered.push(text),
  });

  expect(delivered).toEqual([""]);
});

test("surfaces transcription errors to onError", async () => {
  const delivered: string[] = [];
  const errors: string[] = [];

  await runDictationTranscription({
    isCurrentSession: () => true,
    transcribe: async () => {
      throw new Error("model not loaded");
    },
    onTranscript: (text) => delivered.push(text),
    onError: (message) => errors.push(message),
  });

  expect(delivered).toEqual([]);
  expect(errors).toEqual(["model not loaded"]);
});

test("suppresses errors from stale sessions", async () => {
  const errors: string[] = [];

  await runDictationTranscription({
    isCurrentSession: () => false,
    transcribe: async () => {
      throw new Error("model not loaded");
    },
    onTranscript: () => {},
    onError: (message) => errors.push(message),
  });

  expect(errors).toEqual([]);
});
