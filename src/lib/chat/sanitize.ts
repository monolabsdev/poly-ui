const FIM_PATTERNS = [
  /<\|?fim[-_](?:prefix|middle|postfix)\|?.*?(?:>|$)/gi,
  /\|fim[-_](?:prefix|middle|postfix)\|?.*?(?:>|$)/gi,
];

const TOOL_LEAK_PATTERNS = [
  /commentary\s+to=functions\.\w+/gi,
  // require the template pipe (<|user|>) so legit markup like <user> in code survives
  /<\|(?:assistant|system|user|tool)(?:\|[^\n>]*)?>?/gi,
  /<!--\s*(?:Assistant|System|Tool)\s+(?:greeting|instruction|note).*?-->/gi,
];

const FALLBACK_TEXT = "I hit an internal formatting issue while generating that response. Please try again.";

export function sanitizeOutput(text: string): string {
  if (!text) return text;

  let result = text;

  for (const pattern of FIM_PATTERNS) {
    result = result.replace(pattern, "");
  }

  for (const pattern of TOOL_LEAK_PATTERNS) {
    result = result.replace(pattern, "");
  }

  result = result.trim();

  // Fall back only when sanitization gutted a non-empty response —
  // short legit answers ("4", "Yes.") must pass through untouched.
  if (!result && text.trim()) {
    return FALLBACK_TEXT;
  }

  return result;
}
