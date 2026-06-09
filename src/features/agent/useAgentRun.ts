import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { useNotify } from "@/hooks/useNotify";
import { useProviderStore } from "@/services/providers";
import type { ModelProvider } from "@/store/modelStore";
import { appendAgentEvent } from "./activity";
import { cancelAgent, listenToAgentEvents, runAgent } from "./agentClient";
import { detectFileEditIntent, extractFileMentions } from "./context";
import { sanitizeOutput } from "@/lib/chat/sanitize";
import { triggerTitleGeneration } from "@/lib/chat/title-generation";
import type { AgentMessageState, AgentResolvedContext, AgentRunStatus, AgentWorkspaceSelection, PermissionPreset } from "./types";
import {
  applyOutputDelta,
  applyOutputFinal,
  emptyOutputState,
  type AgentOutputState,
} from "./outputState";

type UseAgentRunArgs = {
  selectedModels: string[];
  selectedProviders: ModelProvider[];
};

export function useAgentRun({ selectedModels, selectedProviders }: UseAgentRunArgs) {
  const addMessage = useChatStore((state) => state.actions.addMessage);
  const setStreamingMessage = useChatStore((state) => state.actions.setStreamingMessage);
  const patchStreamingMessage = useChatStore((state) => state.actions.patchStreamingMessage);
  const setStreamingConversationId = useChatStore((state) => state.actions.setStreamingConversationId);
  const notify = useNotify();
  const [status, setStatus] = useState<AgentRunStatus>("idle");
  const activeRef = useRef<{ runId: string; messageId: string; conversationId: string } | null>(null);
  const outputRef = useRef<AgentOutputState>(emptyOutputState());
  const agentRef = useRef<AgentMessageState | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;
    let rafId: number | null = null;

    const flush = () => {
      rafId = null;
      const active = activeRef.current;
      const agent = agentRef.current;
      if (!active || !agent) return;
      patchStreamingMessage(active.messageId, {
        content: outputRef.current.displayedText,
        agent,
        status: agent.status === "failed" ? "error" : "streaming",
        errorMessage: agent.error,
      });
    };

    const scheduleFlush = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    };

    listenToAgentEvents((event) => {
      const active = activeRef.current;
      if (!active || event.run_id !== active.runId) return;

      const kind = event.data.kind;
      const value = event.data.value ?? {};
      const isDelta = kind === "final_response_delta" || kind === "model_token_delta" || kind === "text_delta";
      const isTerminal = ["finished", "run_finished", "failed", "run_failed", "cancelled", "run_cancelled"].includes(kind);

      if (kind === "final_response_delta") {
        outputRef.current = applyOutputDelta(outputRef.current, value.text ?? "", value.mode);
      } else if (
        (kind === "text_delta" || kind === "model_token_delta") &&
        !hasFinalDelta(agentRef.current)
      ) {
        outputRef.current = applyOutputDelta(outputRef.current, value.text ?? "", value.mode);
      } else if (isTerminal && typeof value.text === "string") {
        outputRef.current = applyOutputFinal(outputRef.current, value.text);
      }

      const nextAgent = appendAgentEvent(agentRef.current!, event);
      agentRef.current = nextAgent;
      setStatus(nextAgent.status);

      if (isTerminal) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        patchStreamingMessage(active.messageId, {
          content: outputRef.current.displayedText,
          agent: nextAgent,
          status: nextAgent.status === "failed" ? "error" : "streaming",
          errorMessage: nextAgent.error,
        });
        void finish(active, nextAgent);
      } else if (isDelta) {
        scheduleFlush();
      } else {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        patchStreamingMessage(active.messageId, {
          content: outputRef.current.displayedText,
          agent: nextAgent,
          status: nextAgent.status === "failed" ? "error" : "streaming",
          errorMessage: nextAgent.error,
        });
      }
    }).then((unlisten) => {
      if (mounted) cleanup = unlisten;
      else unlisten();
    });

    return () => {
      mounted = false;
      cleanup?.();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [patchStreamingMessage]);

  const finish = useCallback(
    async (
      active: { runId: string; messageId: string; conversationId: string },
      agent: AgentMessageState,
    ) => {
      const rawContent = outputRef.current.displayedText.trim();
      const finalContent =
        agent.status === "failed"
          ? fallbackAgentText(agent)
          : rawContent
            ? sanitizeOutput(rawContent)
            : fallbackAgentText(agent);
      await addMessage({
        id: active.messageId,
        conversationId: active.conversationId,
        role: "assistant",
        content: finalContent,
        model: "Poly Agent",
        status:
          agent.status === "failed"
            ? "error"
            : agent.status === "cancelled"
              ? "aborted"
              : "complete",
        errorMessage: agent.error,
        agent,
      });
      setStreamingMessage(active.messageId, null);
      setStreamingConversationId(null);
      activeRef.current = null;
      setStatus(agent.status);

      if (agent.status === "completed") {
        triggerTitleGeneration(active.conversationId);
      }
    },
    [addMessage, setStreamingConversationId, setStreamingMessage],
  );

  const startAgentRun = useCallback(
    async (input: {
      conversationId: string;
      prompt: string;
      workspacePath?: string;
      workspaceSelection: AgentWorkspaceSelection;
      permissionPreset: PermissionPreset;
      resolvedContext?: AgentResolvedContext;
    }) => {
      const model = selectedModels[0];
      const provider = selectedProviders[0];
      if (!model || !provider) {
        notify.warn("Poly Agent unavailable", "Select a model before starting an agent run.");
        return;
      }

      const providers = useProviderStore.getState().providers;
      const providerConfig = providers.find((item) => item.config.provider_type === provider)?.config;
      const messageId = crypto.randomUUID();
      const fileEditRequested = detectFileEditIntent(input.prompt);
      const targetFile = extractFileMentions(input.prompt)[0]
        ?? (fileEditRequested ? input.resolvedContext?.activeFile : undefined);
      const agent: AgentMessageState = {
        status: "running",
        startedAt: new Date().toISOString(),
        request: {
          prompt: input.prompt,
          fileEditRequested,
          targetFile,
        },
        workspacePath: input.workspacePath,
        workspaceSelection: input.workspaceSelection,
        context: input.resolvedContext ?? {
          activeWorkspace: input.workspacePath ?? `sandbox:${input.workspaceSelection.type === "sandbox" ? input.workspaceSelection.chatId : ""}`,
          recentlyViewedFiles: [],
          recentlyEditedFiles: [],
          recentConstraints: [],
        },
        permissionPreset: input.permissionPreset,
        activities: [],
        toolCalls: {},
        approvals: [],
        editedFiles: [],
        debugEvents: [],
        responseText: "",
        respondedStreaming: false,
      };
      outputRef.current = emptyOutputState();
      agentRef.current = agent;
      setStatus("running");
      setStreamingConversationId(input.conversationId);
      setStreamingMessage(messageId, {
        id: messageId,
        conversationId: input.conversationId,
        role: "assistant",
        content: "",
        model: "Poly Agent",
        createdAt: new Date().toISOString(),
        status: "streaming",
        isStreaming: true,
        agent,
      });

      try {
        const runId = await runAgent({
          prompt: buildAgentPrompt(input.prompt, fileEditRequested, targetFile),
          model,
          provider,
          workspacePath: input.workspacePath,
          workspaceSelection: input.workspaceSelection,
          permissionPreset: input.permissionPreset,
          resolvedContext: input.resolvedContext,
          baseUrl:
            provider === "OpenAICompatible"
              ? providerConfig?.api_base_url
              : providerConfig?.ollama_api_base_url ?? providerConfig?.ollama_host,
          apiKey:
            provider === "OpenAICompatible"
              ? providerConfig?.api_key
              : providerConfig?.ollama_api_key,
          debug: import.meta.env.DEV,
        });
        const nextAgent = { ...agent, runId };
        agentRef.current = nextAgent;
        activeRef.current = { runId, messageId, conversationId: input.conversationId };
        patchStreamingMessage(messageId, { agent: nextAgent });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const failedAgent = { ...agent, status: "failed" as const, error: message };
        agentRef.current = failedAgent;
        await finish({ runId: "", messageId, conversationId: input.conversationId }, failedAgent);
        notify.error("Poly Agent failed", message);
      }
    },
    [
      finish,
      notify,
      patchStreamingMessage,
      selectedModels,
      selectedProviders,
      setStreamingConversationId,
      setStreamingMessage,
    ],
  );

  const cancelAgentRun = useCallback(async () => {
    const active = activeRef.current;
    if (!active) return;
    setStatus("cancelling");
    if (agentRef.current) {
      agentRef.current = { ...agentRef.current, status: "cancelling" };
      patchStreamingMessage(active.messageId, { agent: agentRef.current });
    }
    try {
      await cancelAgent(active.runId);
    } catch (err) {
      notify.error("Cancel failed", err instanceof Error ? err.message : String(err));
    }
  }, [notify, patchStreamingMessage]);

  return { startAgentRun, cancelAgentRun, agentStatus: status };
}

function buildAgentPrompt(prompt: string, fileEditRequested: boolean, targetFile?: string) {
  if (fileEditRequested) {
    const targetLine = targetFile
      ? `Target file for this current request: ${targetFile}`
      : "No target file was parsed; infer the target only from this current request or ask for clarification.";

    return [
      prompt,
      "",
      "[Poly UI current-run instruction]",
      "This current request is a file edit/create request.",
      targetLine,
      "Use write_file for new file creation/replacement, or apply_patch for edits/appends.",
      "Do not answer as complete unless the file tool succeeds. If no file tool can be used, explain why no file changes were produced.",
      ...agentMarkdownStyleInstructions(),
    ].join("\n");
  }

  return [
    prompt,
    "",
    "[Poly UI current-run instruction]",
    ...agentMarkdownStyleInstructions(),
  ].join("\n");
}

function agentMarkdownStyleInstructions() {
  return [
    "Format your final response using concise Markdown.",
    "Prefer headings, bullet points, and short paragraphs for project summaries.",
    "Avoid Markdown tables by default, especially for project summaries, file trees, feature lists, or long explanations.",
    "Use tables only for compact comparisons with short cell content.",
    "Never put long paragraphs, file trees, multi-line code, or feature lists inside table cells.",
    "Do NOT output raw HTML tags like <br> or <br/>. Use Markdown line breaks instead.",
    "Keep any code blocks short and focused.",
  ];
}

function fallbackAgentText(agent: AgentMessageState) {
  if (agent.status === "failed") {
    return agent.error
      ? `The Poly Agent encountered an error:\n\n> ${agent.error}`
      : "The Poly Agent encountered an error while processing your request.";
  }
  if (agent.editedFiles.length > 0) {
    const file = agent.editedFiles[0];
    return agent.editedFiles.length === 1
      ? `**${file.additions > 0 && file.deletions === 0 ? "Created" : "Edited"}** \`${file.path}\``
      : `**Edited ${agent.editedFiles.length} files**`;
  }
  if (agent.request?.fileEditRequested) {
    return agent.request.targetFile
      ? `Attempted to modify \`${agent.request.targetFile}\` but no file changes were returned.`
      : "Attempted the requested file change but no file changes were returned.";
  }
  return "The Poly Agent run completed.";
}

function hasFinalDelta(agent: AgentMessageState | null) {
  return Boolean(
    agent?.debugEvents?.some((event) => event.kind === "final_response_delta"),
  );
}
