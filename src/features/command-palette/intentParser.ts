import type {
  CommandPaletteIntentArgs,
  CommandPaletteIntentCommand,
} from "./types";

export type ParsedIntent =
  | {
      command: "set-theme";
      args: CommandPaletteIntentArgs["set-theme"];
      confidence: number;
      display: IntentDisplay;
      destructive: false;
      matchedBy: "alias" | "keywords" | "fuzzy";
    }
  | {
      command: "delete-all-chats";
      args: CommandPaletteIntentArgs["delete-all-chats"];
      confidence: number;
      display: IntentDisplay;
      destructive: true;
      matchedBy: "alias" | "keywords" | "fuzzy";
    }
  | {
      command: "new-chat";
      args: CommandPaletteIntentArgs["new-chat"];
      confidence: number;
      display: IntentDisplay;
      destructive: false;
      matchedBy: "alias" | "keywords" | "fuzzy";
    }
  | {
      command: "open-settings";
      args: CommandPaletteIntentArgs["open-settings"];
      confidence: number;
      display: IntentDisplay;
      destructive: false;
      matchedBy: "alias" | "keywords" | "fuzzy";
    }
  | {
      command: "search-chats";
      args: CommandPaletteIntentArgs["search-chats"];
      confidence: number;
      display: IntentDisplay;
      destructive: false;
      matchedBy: "alias" | "keywords" | "fuzzy";
    }
  | {
      command: "rename-chat";
      args: CommandPaletteIntentArgs["rename-chat"];
      confidence: number;
      display: IntentDisplay;
      destructive: false;
      matchedBy: "alias" | "keywords" | "fuzzy";
    };

export type IntentDisplay = {
  action: string;
  argument?: string;
};

type CommandDefinition = {
  id: CommandPaletteIntentCommand;
  aliases: string[];
  keywords: string[];
  argumentSchema:
    | { type: "none" }
    | { type: "enum"; key: string; values: string[] }
    | { type: "text"; key: string; minWords: number };
  destructive: boolean;
  execute?: (args: CommandPaletteIntentArgs[CommandPaletteIntentCommand]) => void | Promise<void>;
};

type Candidate = ParsedIntent & { score: number };

const THEME_VALUES = ["light", "dark", "system"] as const;
const THEME_SYNONYMS: Record<string, (typeof THEME_VALUES)[number]> = {
  light: "light",
  bright: "light",
  white: "light",
  dark: "dark",
  black: "dark",
  night: "dark",
  system: "system",
  auto: "system",
  automatic: "system",
  default: "system",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "please",
  "mode",
  "view",
]);

export const commandRegistry = [
  {
    id: "set-theme",
    aliases: [
      "theme light",
      "light theme",
      "theme dark",
      "dark theme",
      "theme system",
      "system theme",
      "switch to light mode",
      "switch to dark mode",
      "use dark mode",
      "set appearance system",
    ],
    keywords: ["theme", "appearance", "mode", "switch", "use", "set"],
    argumentSchema: { type: "enum", key: "theme", values: [...THEME_VALUES] },
    destructive: false,
  },
  {
    id: "delete-all-chats",
    aliases: [
      "delete all",
      "delete all chats",
      "clear chats",
      "remove every conversation",
      "remove all conversations",
    ],
    keywords: ["delete", "remove", "clear", "all", "every", "chats", "conversations"],
    argumentSchema: { type: "none" },
    destructive: true,
  },
  {
    id: "new-chat",
    aliases: ["new chat", "new conversation", "start chat", "create chat"],
    keywords: ["new", "create", "start", "chat", "conversation"],
    argumentSchema: { type: "none" },
    destructive: false,
  },
  {
    id: "open-settings",
    aliases: ["open settings", "settings", "show settings", "go to settings"],
    keywords: ["open", "show", "go", "settings", "preferences"],
    argumentSchema: { type: "none" },
    destructive: false,
  },
  {
    id: "search-chats",
    aliases: ["search chats", "find chats", "search conversations", "find conversations"],
    keywords: ["search", "find", "look", "chats", "chat", "conversation", "conversations"],
    argumentSchema: { type: "text", key: "query", minWords: 1 },
    destructive: false,
  },
  {
    id: "rename-chat",
    aliases: ["rename chat", "rename conversation", "name chat", "title chat"],
    keywords: ["rename", "name", "title", "chat", "conversation"],
    argumentSchema: { type: "text", key: "title", minWords: 1 },
    destructive: false,
  },
] satisfies CommandDefinition[];

export function parseCommandIntent(input: string): ParsedIntent | null {
  const normalized = normalizeInput(input);
  if (!normalized) return null;

  const candidates = commandRegistry
    .map((definition) => buildCandidate(definition, normalized))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  const best = candidates[0];
  if (!best || best.confidence < 0.46) return null;

  const second = candidates[1];
  if (second && best.score - second.score < 0.03 && best.confidence < 0.9) {
    return null;
  }

  const { score: _score, ...intent } = best;
  return intent;
}

export function normalizeInput(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getIntentSummary(intent: ParsedIntent): IntentDisplay {
  return intent.display;
}

function buildCandidate(
  definition: (typeof commandRegistry)[number],
  normalized: string,
): Candidate | null {
  if (definition.id === "set-theme") return themeCandidate(normalized);
  if (definition.id === "search-chats")
    return textCandidate(definition, normalized, "query", "Search chats for");
  if (definition.id === "rename-chat")
    return textCandidate(definition, normalized, "title", "Rename current chat to");
  return noArgCandidate(definition, normalized);
}

function themeCandidate(normalized: string): Candidate | null {
  const words = tokenise(normalized);
  const theme = words.map((word) => THEME_SYNONYMS[word]).find(Boolean);
  if (!theme) return null;

  const definition = commandRegistry[0];
  const aliasScore = aliasMatch(definition.aliases, normalized);
  const keywordHits = countHits(words, definition.keywords);
  const hasThemeKeyword = words.some((word) =>
    ["theme", "appearance", "mode"].includes(word),
  );
  const hasAction = words.some((word) =>
    ["switch", "use", "set", "change", "make"].includes(word),
  );
  const fuzzyScore = fuzzyPhraseScore(normalized, "theme");
  const score = Math.max(aliasScore, 0.55 + keywordHits * 0.07);
  const confidence = clamp(
    Math.max(aliasScore, score + (hasThemeKeyword ? 0.12 : 0) + (hasAction ? 0.08 : 0) + fuzzyScore * 0.05),
  );

  if (confidence < 0.48) return null;
  return {
    command: "set-theme",
    args: { theme },
    confidence,
    display: { action: "Set theme to", argument: titleCase(theme) },
    destructive: false,
    matchedBy: aliasScore >= 0.95 ? "alias" : fuzzyScore > 0.65 ? "fuzzy" : "keywords",
    score: confidence,
  };
}

function noArgCandidate(
  definition: Exclude<(typeof commandRegistry)[number], { id: "set-theme" | "search-chats" | "rename-chat" }>,
  normalized: string,
): Candidate | null {
  const words = tokenise(normalized);
  const aliasScore = Math.max(
    aliasMatch(definition.aliases, normalized),
    aliasPrefixMatch(definition.aliases, normalized),
  );
  const keywordHits = countHits(words, definition.keywords);
  const fuzzyScore = Math.max(
    ...definition.aliases.map((alias) => fuzzyPhraseScore(normalized, alias)),
  );
  const requiredOk =
    definition.id === "delete-all-chats"
      ? hasAny(words, ["delete", "remove", "clear"]) &&
        hasAny(words, ["all", "every", "chats", "chat", "conversation", "conversations"])
      : keywordHits >= 2 || aliasScore > 0;
  if (!requiredOk) return null;

  const confidence = clamp(
    Math.max(aliasScore, 0.42 + keywordHits * 0.1, fuzzyScore * 0.78),
  );
  if (confidence < 0.5) return null;

  const command = definition.id;
  const display =
    command === "delete-all-chats"
      ? { action: "Delete all chats" }
      : command === "new-chat"
        ? { action: "Create new chat" }
        : { action: "Open settings" };

  return {
    command,
    args: {},
    confidence,
    display,
    destructive: definition.destructive,
    matchedBy: aliasScore >= 0.95 ? "alias" : fuzzyScore > 0.75 ? "fuzzy" : "keywords",
    score: confidence,
  } as Candidate;
}

function textCandidate(
  definition: Extract<(typeof commandRegistry)[number], { id: "search-chats" | "rename-chat" }>,
  normalized: string,
  key: "query" | "title",
  action: string,
): Candidate | null {
  const words = tokenise(normalized);
  const aliasScore = aliasMatch(definition.aliases, normalized);
  const firstKeywordIndex = words.findIndex((word) =>
    definition.keywords.includes(word),
  );
  const keywordHits = countHits(words, definition.keywords);
  if (firstKeywordIndex < 0 || keywordHits < 1) return null;

  const argWords = words.filter(
    (word, index) =>
      index > firstKeywordIndex &&
      !definition.keywords.includes(word) &&
      !STOP_WORDS.has(word),
  );
  const flexibleArgWords =
    argWords.length > 0
      ? argWords
      : words.filter(
          (word) => !definition.keywords.includes(word) && !STOP_WORDS.has(word),
        );
  if (flexibleArgWords.length < 1) return null;

  const argument = flexibleArgWords.join(" ");
  const confidence = clamp(
    Math.max(aliasScore, 0.52 + keywordHits * 0.08 + flexibleArgWords.length * 0.02),
  );
  return {
    command: definition.id,
    args: { [key]: argument },
    confidence,
    display: { action, argument },
    destructive: false,
    matchedBy: aliasScore >= 0.95 ? "alias" : "keywords",
    score: confidence,
  } as Candidate;
}

function aliasMatch(aliases: string[], normalized: string) {
  return aliases.some((alias) => normalizeInput(alias) === normalized) ? 1 : 0;
}

function aliasPrefixMatch(aliases: string[], normalized: string) {
  return aliases.some((alias) => normalized.startsWith(`${normalizeInput(alias)} `))
    ? 0.92
    : 0;
}

function tokenise(normalized: string) {
  return normalized.split(" ").filter(Boolean);
}

function countHits(words: string[], keywords: string[]) {
  return words.filter((word) => keywords.includes(word)).length;
}

function hasAny(words: string[], values: string[]) {
  return words.some((word) => values.includes(word));
}

function fuzzyPhraseScore(input: string, phrase: string) {
  let score = 0;
  let index = 0;
  for (const char of phrase) {
    const found = input.indexOf(char, index);
    if (found === -1) return 0;
    score += found === index ? 2 : 1;
    index = found + 1;
  }
  return score / (phrase.length * 2);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(2))));
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
