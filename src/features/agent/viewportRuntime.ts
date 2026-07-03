import * as native from "./native";
import {
  composeSnapshot,
  type ViewportObservation,
  type ViewportSnapshotResult,
} from "./viewportObservation";

/**
 * Browser-runtime cache: remembers the last observation per run so repeated
 * snapshots cost the model a diff (or "No DOM changes.") instead of a full
 * page description. Lives outside React; reset when the viewport (re)opens.
 */
let last: { runId: string; observation: ViewportObservation } | null = null;

export function resetViewportRuntime(): void {
  last = null;
}

function assertNoCollectorError(raw: unknown): asserts raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object") throw new Error("The page returned no observation.");
  const error = (raw as Record<string, unknown>).error;
  if (typeof error === "string") throw new Error(error);
}

export async function snapshotViewport(runId: string): Promise<ViewportSnapshotResult> {
  const raw = await native.agentViewportObserve("snapshot");
  assertNoCollectorError(raw);
  const observation = raw as ViewportObservation;
  const prev = last?.runId === runId ? last.observation : null;
  const result = composeSnapshot(prev, observation);
  last = { runId, observation };
  return result;
}

export async function inspectViewport(selector: string): Promise<Record<string, unknown>> {
  const raw = await native.agentViewportObserve("inspect", selector);
  assertNoCollectorError(raw);
  return raw;
}
