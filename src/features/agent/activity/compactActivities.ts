import type { AgentMessageState } from "../types";

export function compactActivities(
  activities: AgentMessageState["activities"],
) {
  return activities.reduce<AgentMessageState["activities"]>(
    (items, item) => {
      const prev = items[items.length - 1];
      if (!prev) { items.push(item); return items; }

      const sameLabel = prev.label === item.label;
      if (sameLabel) {
        if (item.status === "complete" || item.status === "error") {
          items[items.length - 1] = { ...prev, status: item.status, detail: item.detail ?? prev.detail };
          return items;
        }
        if (prev.status === "running" && item.status === "running") {
          items[items.length - 1] = { ...prev, detail: item.detail ?? prev.detail };
          return items;
        }
      }

      items.push(item);
      return items;
    },
    [],
  );
}
