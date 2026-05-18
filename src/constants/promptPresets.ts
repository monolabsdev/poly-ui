export type PromptPresetId = "default" | "technical" | "creative" | "concise";

export type PromptPreset = {
  id: PromptPresetId;
  name: string;
  content: string;
};

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "default",
    name: "Default",
    content: "You are a helpful, harmless, and honest AI assistant.",
  },
  {
    id: "technical",
    name: "Technical",
    content:
      "You are a technical AI assistant. Prioritise accuracy, clarity, and depth in your responses. When asked about code, provide working examples with explanations. Use precise terminology and acknowledge edge cases.",
  },
  {
    id: "creative",
    name: "Creative",
    content:
      "You are a creative AI assistant. Encourage narrative, storytelling, and imaginative responses. Feel free to use metaphor, vivid language, and explore ideas from multiple angles.",
  },
  {
    id: "concise",
    name: "Concise",
    content:
      "You are a concise AI assistant. Give short, direct answers optimised for quick consumption. Avoid preamble and unnecessary detail. Get straight to the point.",
  },
];

export function getPresetContent(id: PromptPresetId): string {
  const preset = PROMPT_PRESETS.find((p) => p.id === id);
  return preset?.content ?? "";
}
