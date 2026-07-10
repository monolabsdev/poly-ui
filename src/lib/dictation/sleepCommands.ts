const SLEEP_PHRASES = new Set([
  "go to sleep",
  "sleep",
  "quit",
  "shush",
  "shut down",
  "shutdown",
  "shut up",
  "go away",
  "stop listening",
  "goodbye",
  "good bye",
]);

/**
 * True when the transcript, as a whole utterance, is a command to stop
 * listening. Plain phrase matching, no model: leading/trailing pleasantries
 * are stripped, but a sleep phrase embedded in a longer sentence ("how do I
 * shut down my pc") never matches.
 */
export function matchesSleepCommand(transcript: string): boolean {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:ok(?:ay)? |hey |please |now |just )+/, "")
    .replace(/(?: please| now| thanks| thank you)+$/, "");
  return SLEEP_PHRASES.has(normalized);
}
