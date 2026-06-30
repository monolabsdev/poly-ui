import { selectAgentProviderConfig } from "../src/features/agent/providerConfig";
import type { ProviderStatusResponse } from "../src/features/providers";

describe("agent provider config selection", () => {
  it("uses the model's matching OpenAI-compatible connection when config id is missing", () => {
    const providers: ProviderStatusResponse[] = [
      provider(1, "openai", "https://api.openai.com/v1", ["gpt-4o"]),
      provider(2, "openrouter", "https://openrouter.ai/api/v1", ["openrouter/free"]),
    ];

    const selected = selectAgentProviderConfig(
      providers,
      "OpenAICompatible",
      "openrouter/free",
    );

    expect(selected?.id).toBe(2);
  });
});

function provider(
  id: number,
  preset: string,
  api_base_url: string,
  models: string[],
): ProviderStatusResponse {
  return {
    provider_type: "OpenAICompatible",
    status: "Online",
    config: {
      id,
      provider_type: "OpenAICompatible",
      enabled: true,
      priority: id,
      preset,
      api_base_url,
      model_suggestions: JSON.stringify(models),
    },
  };
}
