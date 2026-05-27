export function getTemporalPrompt(): string {
  const now = new Date();
  return [
    "Temporal Awareness:",
    `- CURRENT_DATE: ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    `- CURRENT_TIME: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    `- CURRENT_WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long" })}`,
  ].join("\n");
}

export function buildSystemPrompt(userSystemPrompt: string, exaApiKey?: string, forceSearch?: boolean): string {
  const temporal = getTemporalPrompt();
  const formatting = [
    "Response Formatting:",
    "- Use Markdown for prose.",
    "- For mathematical notation, use LaTeX delimiters: inline math as \\(...\\) and display equations as \\[...\\].",
    "- Do not wrap equations in backticks or fenced code blocks unless the user asks for literal source code.",
  ].join("\n");
  const toolInstruction = exaApiKey
    ? `\n\n## Available Tools\n\nYou have access to the \`web_search\` tool. Call it using the \`web_search\` function with a \`query\` parameter when you need current information, recent events, or facts outside your training data. Do NOT refuse to search — use the tool when appropriate.${forceSearch ? "\n\n**Important:** Web search is currently ENABLED. You SHOULD use the \`web_search\` tool proactively whenever the user's request could benefit from up-to-date information, even if you're unsure whether your training data is sufficient. If nothing needs searching, simply answer normally." : ""}`
    : "";
  const base = userSystemPrompt.trim()
    ? `${temporal}\n\n${formatting}\n\nPersonalization/Custom Instructions:\n${userSystemPrompt}${toolInstruction}`
    : `${temporal}\n\n${formatting}${toolInstruction}`;
  return base;
}
