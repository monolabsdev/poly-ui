export type AgentOutputState = {
  streamedText: string;
  finalText: string | null;
  displayedText: string;
  hasReceivedDeltas: boolean;
  isFinalized: boolean;
};

export function emptyOutputState(): AgentOutputState {
  return {
    streamedText: "",
    finalText: null,
    displayedText: "",
    hasReceivedDeltas: false,
    isFinalized: false,
  };
}

export function applyOutputDelta(
  state: AgentOutputState,
  text: string,
  mode?: "delta" | "snapshot",
): AgentOutputState {
  if (!text) return state;
  const streamedText = mode === "snapshot" ? text : state.streamedText + text;
  return {
    ...state,
    streamedText,
    displayedText: streamedText,
    hasReceivedDeltas: true,
  };
}

export function applyOutputFinal(state: AgentOutputState, finalText: string): AgentOutputState {
  const displayedText = reconcileFinalText(state.streamedText, finalText);
  return {
    ...state,
    finalText,
    displayedText,
    isFinalized: true,
  };
}

export function reconcileFinalText(streamedText: string, finalText: string | null | undefined): string {
  const streamed = streamedText ?? "";
  const finalValue = finalText ?? "";
  if (!finalValue.trim()) return streamed;
  if (!streamed.trim()) return finalValue;

  const streamedTrim = streamed.trim();
  const finalTrim = finalValue.trim();
  if (normaliseText(streamedTrim) === normaliseText(finalTrim)) return finalValue;
  if (finalValue.startsWith(streamed)) return finalValue;
  if (streamed.startsWith(finalValue)) return streamed;
  if (finalValue.includes(streamedTrim)) return finalValue;
  if (streamed.includes(finalTrim)) return streamed;

  const strippedStreamed = stripMarkdown(streamedTrim);
  const strippedFinal = stripMarkdown(finalTrim);
  if (normaliseText(strippedStreamed) === normaliseText(strippedFinal)) {
    return streamedText;
  }

  const overlap = suffixPrefixOverlap(streamed, finalValue);
  if (overlap > 0) return streamed + finalValue.slice(overlap);

  const streamedSentences = sentenceSet(strippedStreamed);
  const finalSentences = sentenceSet(strippedFinal);
  if (finalSentences.size > 0 && [...finalSentences].every((s) => streamedSentences.has(s))) {
    return streamedText;
  }

  return finalValue.length >= streamed.length ? finalValue : streamedText;
}

function suffixPrefixOverlap(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  for (let size = max; size > 0; size--) {
    if (left.slice(-size) === right.slice(0, size)) return size;
  }
  return 0;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/[*_`~#>\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseText(value: string): string {
  return stripMarkdown(value).toLowerCase().replace(/[.!?…]+$/g, "");
}

function sentenceSet(value: string): Set<string> {
  return new Set(
    value
      .split(/(?<=[.!?])\s+/)
      .map(normaliseText)
      .filter(Boolean),
  );
}
