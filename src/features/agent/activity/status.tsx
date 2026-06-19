import { useEffect, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, ShieldAlert } from "lucide-react";
import type { AgentMessageState } from "../types";
import type { StepDef } from "./buildSteps";
import type { AgentResult } from "./summaries";

export function statusMeta(
  status: AgentMessageState["status"],
  result: AgentResult,
) {
  if (status === "running" || status === "cancelling") {
    return {
      label: status === "cancelling" ? "Cancelling" : "Running",
      color: "primary.main",
      bg: "info.soft",
      border: "info.soft",
      icon: (
        <LoaderCircle
          size={14}
          className="animate-spin"
          aria-hidden
        />
      ),
    };
  }
  if (status === "waiting_for_approval") {
    return {
      label: "Waiting",
      color: "warning.main",
      bg: "warning.soft",
      border: "warning.soft",
      icon: <ShieldAlert size={14} aria-hidden />,
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      color: "error.main",
      bg: "error.soft",
      border: "error.soft",
      icon: <AlertTriangle size={14} aria-hidden />,
    };
  }
  if (status === "completed" && result.tone === "warning") {
    return {
      label: "No changes",
      color: "warning.main",
      bg: "warning.soft",
      border: "warning.soft",
      icon: <AlertTriangle size={14} aria-hidden />,
    };
  }
  return {
    label: status === "cancelled" ? "Cancelled" : "Completed",
    color: "success.main",
    bg: "success.soft",
    border: "success.soft",
    icon: <Check size={14} aria-hidden />,
  };
}

export function useHeaderStatus(agent: AgentMessageState, steps: StepDef[]): string | undefined {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (agent.status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [agent.status]);

  if (agent.status === "completed") return "Completed";
  if (agent.status === "failed") return "Failed";
  if (agent.status === "cancelled") return "Cancelled";
  if (agent.status === "waiting_for_approval") return "Waiting for approval...";
  if (agent.status !== "running" || !agent.startedAt) return undefined;
  const active = steps.find((step) => step.status === "running");
  if (active?.label) {
    const label = active.label.toLowerCase();
    if (label.includes("thinking")) return "Thinking...";
    if (label.includes("search")) return "Searching files...";
    if (label.includes("read")) return "Reading files...";
    if (label.includes("summar")) return "Summarizing...";
    if (label.includes("respond")) return "Responding...";
    if (label.includes("edit")) return "Editing files...";
    if (label.includes("verify")) return "Verifying...";
    if (label.includes("inspect") || label.includes("workspace")) return "Inspecting workspace...";
  }
  const elapsed = now - new Date(agent.startedAt).getTime();
  const seconds = Math.floor(elapsed / 1000);
  if (seconds > 30) return "Taking longer than usual.";
  if (seconds > 15) return "Still waiting for the model...";
  if (seconds > 5) return "Waiting for model response...";
  return undefined;
}
export function useElapsed(
  startedAt: string,
  status: string,
  completedAt?: string,
): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (
      !["running", "waiting_for_approval", "cancelling"].includes(status)
    )
      return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  if (!startedAt) return null;

  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) return null;

  const endTime = ["running", "waiting_for_approval", "cancelling"].includes(
    status,
  )
    ? now
    : completedAt
      ? new Date(completedAt).getTime()
      : now;

  if (Number.isNaN(endTime)) return null;

  const ms = endTime - startMs;
  if (ms < 0) return null;

  const seconds = Math.floor(ms / 1000);
  if (
    !["running", "waiting_for_approval", "cancelling"].includes(status) &&
    seconds < 1
  )
    return "briefly";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${seconds}s`;
}
