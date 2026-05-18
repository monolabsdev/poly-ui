export function getTemporalPrompt(): string {
  const now = new Date();
  return [
    "Temporal Awareness:",
    `- CURRENT_DATE: ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    `- CURRENT_TIME: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    `- CURRENT_WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long" })}`,
  ].join("\n");
}

export function buildSystemPrompt(userSystemPrompt: string): string {
  const temporal = getTemporalPrompt();
  return userSystemPrompt.trim()
    ? `${temporal}\nPersonalization/Custom Instructions:\n${userSystemPrompt}`
    : temporal;
}
