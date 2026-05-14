import { useToolStore, type PendingToolCall } from "@/store/toolStore";
import { type ToolInvocationPayload } from "./event-bus";
import { loggedInvoke } from "@/lib/utils";

export interface ToolApprovalHandler {
  handleToolInvocation(payload: ToolInvocationPayload): void;
  approve(invocationId: string, alwaysAllow?: boolean): void;
  deny(invocationId: string): void;
  getPendingApproval(): PendingToolCall | null;
}

interface ToolApprovalDeps {
  setPendingApproval: (pending: PendingToolCall | null) => void;
  invoke: typeof loggedInvoke;
}

export function createToolApprovalHandler(deps: ToolApprovalDeps): ToolApprovalHandler {
  return {
    handleToolInvocation(payload: ToolInvocationPayload) {
      const { invocation_id, request_id, tool_name, tool_args, requires_approval } =
        payload;

      if (requires_approval) {
        deps.setPendingApproval({
          invocationId: invocation_id,
          requestId: request_id,
          toolName: tool_name,
          toolArgs: tool_args,
        });
      }
    },

    async approve(invocationId: string, alwaysAllow = false) {
      try {
        await deps.invoke("approve_tool", {
          response: {
            invocationId,
            approved: true,
            alwaysAllow,
          },
        });
      } catch (err) {
        console.error("Failed to approve tool:", err);
      }
      deps.setPendingApproval(null);
    },

    async deny(invocationId: string) {
      try {
        await deps.invoke("approve_tool", {
          response: {
            invocationId,
            approved: false,
            alwaysAllow: false,
          },
        });
      } catch (err) {
        console.error("Failed to deny tool:", err);
      }
      deps.setPendingApproval(null);
    },

    getPendingApproval() {
      return useToolStore.getState().pendingApproval;
    },
  };
}

export const toolApprovalHandler = createToolApprovalHandler({
  setPendingApproval: (pending) =>
    useToolStore.getState().actions.setPendingApproval(pending),
  invoke: loggedInvoke,
});