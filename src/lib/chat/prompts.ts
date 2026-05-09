export function getTemporalPrompt(): string {
  const now = new Date();
  return [
    "Temporal Awareness:",
    `- CURRENT_DATE: ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    `- CURRENT_TIME: ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    `- CURRENT_WEEKDAY: ${now.toLocaleDateString("en-US", { weekday: "long" })}`,
  ].join("\n");
}

export function processTemporalVariables(content: string): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });

  return content
    .replace(/\{\{CURRENT_DATE\}\}/g, date)
    .replace(/\{\{CURRENT_TIME\}\}/g, time)
    .replace(/\{\{CURRENT_WEEKDAY\}\}/g, weekday);
}

export function buildSystemPrompt(userSystemPrompt: string): string {
  const temporal = getTemporalPrompt();
  return userSystemPrompt.trim()
    ? `${temporal}\nPersonalization/Custom Instructions:\n${userSystemPrompt}`
    : temporal;
}
