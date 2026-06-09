import {
  applyFinalResponseDelta,
  applyOutputDelta,
  applyOutputFinal,
  emptyOutputState,
} from "../src/features/agent/outputState";

describe("agent output state", () => {
  it("does not duplicate text when PolyAgent emits token and final-response deltas", () => {
    let state = emptyOutputState();

    state = applyOutputDelta(state, "Hello", "delta");
    state = applyFinalResponseDelta(state, "Hello");
    state = applyFinalResponseDelta(state, " world");

    expect(state.displayedText).toBe("Hello world");
    expect(state.streamedText).toBe("Hello world");
  });

  it("reconciles terminal final text without duplicating streamed content", () => {
    let state = emptyOutputState();

    state = applyOutputDelta(state, "Hello", "delta");
    state = applyFinalResponseDelta(state, "Hello");
    state = applyFinalResponseDelta(state, " world");
    state = applyOutputFinal(state, "Hello world");

    expect(state.displayedText).toBe("Hello world");
  });
});
