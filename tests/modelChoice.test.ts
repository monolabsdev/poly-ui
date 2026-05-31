import { expect, test } from "bun:test";
import {
  findDefaultModelChoice,
  modelChoiceId,
  parseModelChoiceId,
} from "../src/lib/models/model-choice";

test("round trips provider-aware model choice ids", () => {
  const id = modelChoiceId("OpenAICompatible", "vendor/model:latest");

  expect(parseModelChoiceId(id)).toEqual({
    provider: "OpenAICompatible",
    model: "vendor/model:latest",
  });
});

test("finds stored provider-aware default model", () => {
  const models = [
    { name: "shared-model", provider_type: "OllamaLocal" as const },
    { name: "shared-model", provider_type: "OpenAICompatible" as const },
  ];

  expect(
    findDefaultModelChoice(
      models,
      modelChoiceId("OpenAICompatible", "shared-model"),
    ),
  ).toEqual(models[1]);
});

test("supports legacy model-only defaults", () => {
  const models = [
    { name: "llama3.2", provider_type: "OllamaLocal" as const },
  ];

  expect(findDefaultModelChoice(models, "llama3.2")).toEqual(models[0]);
});
