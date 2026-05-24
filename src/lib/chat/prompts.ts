export function getTemporalPrompt(): string {
  const now = new Date();
  return [
    "Temporal Awareness:",
    `- CURRENT_DATE: ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    `- CURRENT_TIME: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    `- CURRENT_WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long" })}`,
  ].join("\n");
}

export function buildSystemPrompt(userSystemPrompt: string, exaApiKey?: string): string {
  const temporal = getTemporalPrompt();
  const toolInstruction = exaApiKey
    ? `\n\n## Available Tools\n\nYou have access to the \`web_search\` tool. Call it using the \`web_search\` function with a \`query\` parameter when you need current information, recent events, or facts outside your training data. Do NOT refuse to search — use the tool when appropriate.`
    : "";
  const base = userSystemPrompt.trim()
    ? `${temporal}\nPersonalization/Custom Instructions:\n${userSystemPrompt}${toolInstruction}`
    : `${temporal}${toolInstruction}`;
  return base;
}
