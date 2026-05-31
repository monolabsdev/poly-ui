import { expect, test } from "bun:test";
import {
  filterModelOptions,
  mergeModelOptions,
  shouldLoadExternalDefault,
  shouldShowModelLoadingState,
  shouldLoadExternalModels,
} from "../src/lib/models/model-selector";

const local = {
  name: "llama3.2",
  provider_type: "OllamaLocal" as const,
};
const external = {
  name: "OpenAI: GPT-5 Nano",
  provider_type: "OpenAICompatible" as const,
};

test("filters model options by source and case-insensitive search", () => {
  const models = [local, external];

  expect(filterModelOptions(models, "local", "")).toEqual([local]);
  expect(filterModelOptions(models, "external", "")).toEqual([external]);
  expect(filterModelOptions(models, "all", "gpt-5")).toEqual([external]);
});

test("merges provider-aware model options without collapsing shared names", () => {
  const sharedLocal = { ...local, name: "shared-model" };
  const sharedExternal = { ...external, name: "shared-model" };

  expect(
    mergeModelOptions([sharedLocal], [sharedExternal, sharedExternal]),
  ).toEqual([sharedLocal, sharedExternal]);
});

test("loads external models only after selector opens", () => {
  expect(shouldLoadExternalModels(false, false, false)).toBe(false);
  expect(shouldLoadExternalModels(true, false, false)).toBe(true);
  expect(shouldLoadExternalModels(true, true, false)).toBe(false);
  expect(shouldLoadExternalModels(true, false, true)).toBe(false);
});

test("keeps ready model rows visible while external models load", () => {
  expect(shouldShowModelLoadingState(true, 1)).toBe(false);
  expect(shouldShowModelLoadingState(true, 0)).toBe(true);
  expect(shouldShowModelLoadingState(false, 0)).toBe(false);
});

test("loads saved external default before falling back to a local model", () => {
  expect(
    shouldLoadExternalDefault(
      "OpenAICompatible:gpt-5",
      false,
      false,
    ),
  ).toBe(true);
  expect(shouldLoadExternalDefault("OllamaLocal:llama3.2", false, false)).toBe(
    false,
  );
  expect(
    shouldLoadExternalDefault(
      "OpenAICompatible:gpt-5",
      true,
      false,
    ),
  ).toBe(false);
});
