/**
 * Pure logic for the agent viewport's compact observations: console
 * summaries and DOM diffing. The collector script (Rust side) produces
 * `ViewportObservation`s; these helpers turn them into the smallest useful
 * payload for the model. No Tauri or React imports — unit-testable.
 */

export type ViewportInput = { label: string; type: string; value: string | null };
export type ViewportHeading = { level: number; text: string };
export type ViewportNetworkFailure = { url: string; status: number };

export type ViewportObservation = {
  url: string;
  title: string;
  readyState: string;
  viewport: { width: number; height: number; scrollY: number };
  focusedElement: string | null;
  buttons: string[];
  links: string[];
  inputs: ViewportInput[];
  headings: ViewportHeading[];
  forms: number;
  regions: string[];
  textSummary: string;
  consoleErrors: string[];
  consoleErrorCount: number;
  consoleWarnings: string[];
  consoleWarningCount: number;
  networkFailures: ViewportNetworkFailure[];
  networkFailureCount: number;
  domHash: string;
};

export type ViewportSnapshotResult =
  | { kind: "full"; observation: ViewportObservation; console: string }
  | { kind: "unchanged"; url: string; title: string; note: string; console: string }
  | {
      kind: "diff";
      url: string;
      title: string;
      changes: string[];
      console: string;
      consoleErrors?: string[];
      networkFailures?: ViewportNetworkFailure[];
    };

export function consoleSummary(obs: ViewportObservation): string {
  const parts: string[] = [];
  if (obs.consoleErrorCount > 0) parts.push(`${obs.consoleErrorCount} console error${obs.consoleErrorCount === 1 ? "" : "s"}`);
  if (obs.consoleWarningCount > 0) parts.push(`${obs.consoleWarningCount} console warning${obs.consoleWarningCount === 1 ? "" : "s"}`);
  if (obs.networkFailureCount > 0) parts.push(`${obs.networkFailureCount} failed network request${obs.networkFailureCount === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "No console errors, warnings, or network failures.";
}

function setDiff(prev: string[], next: string[], noun: string, changes: string[]) {
  const before = new Set(prev);
  const after = new Set(next);
  for (const item of after) if (!before.has(item)) changes.push(`Added ${noun}: ${item}`);
  for (const item of before) if (!after.has(item)) changes.push(`Removed ${noun}: ${item}`);
}

export function diffObservations(prev: ViewportObservation, next: ViewportObservation): string[] {
  const changes: string[] = [];
  if (prev.url !== next.url) changes.push(`URL: ${prev.url} → ${next.url}`);
  if (prev.title !== next.title) changes.push(`Title: "${prev.title}" → "${next.title}"`);

  setDiff(prev.buttons, next.buttons, "button", changes);
  setDiff(prev.headings.map(headingKey), next.headings.map(headingKey), "heading", changes);
  setDiff(
    prev.inputs.map((i) => `${i.type} "${i.label}"`),
    next.inputs.map((i) => `${i.type} "${i.label}"`),
    "input",
    changes,
  );

  const prevValues = new Map(prev.inputs.map((i) => [`${i.type} "${i.label}"`, i.value]));
  for (const input of next.inputs) {
    const key = `${input.type} "${input.label}"`;
    if (prevValues.has(key) && prevValues.get(key) !== input.value) {
      changes.push(`Input ${key} value: "${prevValues.get(key) ?? ""}" → "${input.value ?? ""}"`);
    }
  }

  if (prev.links.length !== next.links.length) {
    changes.push(`Visible links: ${prev.links.length} → ${next.links.length}`);
  }
  if (prev.focusedElement !== next.focusedElement && next.focusedElement) {
    changes.push(`Focus: ${next.focusedElement}`);
  }
  const newErrors = next.consoleErrorCount - prev.consoleErrorCount;
  if (newErrors > 0) {
    changes.push(`${newErrors} new console error${newErrors === 1 ? "" : "s"}: ${next.consoleErrors.slice(-1)[0] ?? ""}`);
  }
  const newFailures = next.networkFailureCount - prev.networkFailureCount;
  if (newFailures > 0) {
    const last = next.networkFailures.slice(-1)[0];
    changes.push(`${newFailures} new failed network request${newFailures === 1 ? "" : "s"}${last ? `: ${last.url} (${last.status || "network error"})` : ""}`);
  }

  // Text changed but nothing structural caught it — surface the new text.
  if (changes.length === 0 && prev.textSummary !== next.textSummary) {
    changes.push(`Visible text now: "${next.textSummary.slice(0, 250)}"`);
  }
  return changes;
}

export function composeSnapshot(
  prev: ViewportObservation | null,
  next: ViewportObservation,
): ViewportSnapshotResult {
  const consoleLine = consoleSummary(next);
  if (!prev) return { kind: "full", observation: next, console: consoleLine };
  if (prev.domHash === next.domHash && prev.url === next.url) {
    return { kind: "unchanged", url: next.url, title: next.title, note: "No DOM changes.", console: consoleLine };
  }
  return {
    kind: "diff",
    url: next.url,
    title: next.title,
    changes: diffObservations(prev, next),
    console: consoleLine,
    ...(next.consoleErrorCount > 0 ? { consoleErrors: next.consoleErrors } : {}),
    ...(next.networkFailureCount > 0 ? { networkFailures: next.networkFailures } : {}),
  };
}

function headingKey(h: ViewportHeading): string {
  return `h${h.level} "${h.text}"`;
}
