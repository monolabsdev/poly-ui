import { describe, expect, it } from "vitest";
import { modelChoiceId } from "@/lib/models/model-choice";

describe("modelChoiceId", () => {
  it("keeps same-name models from separate provider connections distinct", () => {
    expect(modelChoiceId("OpenAICompatible", "openai/gpt-4.1-mini", 11)).not.toBe(
      modelChoiceId("OpenAICompatible", "openai/gpt-4.1-mini", 22),
    );
  });
});
