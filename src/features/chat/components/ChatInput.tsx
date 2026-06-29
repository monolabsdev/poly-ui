import {
  Square,
  Plus,
  ArrowUp,
  Paperclip,
  Image as ImageIcon,
  AlertTriangle,
  Mic,
  X,
  LayoutGrid,
} from "lucide-react";
import { useState, memo, useEffect, useCallback, useMemo } from "react";
import { Box } from "@/components/ui/Box";
import { InputBase } from "@/components/ui/input-base";
import { IconButton } from "@/components/ui/icon-button";
import { Typography } from "@/components/ui/Typography";
import { TooltipLabel as Tooltip } from "@/components/ui/tooltip-label";

import { Square as StopIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { useFeatures, type FeatureDef } from "@/lib/featureRegistry";
import { useChatAttachments } from "@/features/chat/hooks/useChatAttachments";
import { useFileDragDetection } from "@/features/chat/hooks/useFileDragDetection";
import {
  useAutoResizeTextarea,
} from "@/features/chat/hooks/useAutoResizeTextarea";
import { useSlashCommand } from "@/features/chat/hooks/useSlashCommand";
import { Spinner } from "@/components/ui/spinner";
import { useDictation } from "@/hooks/useDictation";
import { DictationModelDialog } from "@/features/dictation/DictationModelDialog";
import { ActiveFeaturesList } from "@/features/chat/components/ChatInput/ActiveFeaturesList";
import { SlashCommandMenu } from "@/features/chat/components/ChatInput/SlashCommandMenu";
import { ChatAttachmentsList } from "@/features/chat/components/ChatInput/ChatAttachmentsList";
import { cn } from "@/lib/utils";

import {
  DRAFT_WORKSPACE_SELECTION_CHAT_ID,
  useAgentStore,
} from "@/features/agent/agentStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AgentComposerControls } from "@/features/agent/AgentComposerControls";

interface ChatInputProps {
  onSubmit: (value: string) => void | Promise<void>;
  onStop: () => void;
  isStreaming: boolean;
  onFocusChange?: (focused: boolean) => void;
  isTemporary?: boolean;
  conversationId?: string | null;
}

export const ChatInput = memo(function ChatInput({
  onSubmit,
  onStop,
  isStreaming,
  onFocusChange,
  isTemporary,
  conversationId,
}: ChatInputProps) {
  const [draft, setDraft] = useState("");
  const [pastedPreview, setPastedPreview] = useState<{
    id: string;
    text: string;
    preview: string;
    lines: number;
    chars: number;
  } | null>(null);
  const experimentalFeatures = useSettingsStore(
    (state) => state.general.experimentalFeatures,
  );
  const agentEnabled =
    useAgentStore((state) => state.enabled) && experimentalFeatures;
  const dictationEnabled = useSettingsStore(
    (state) => state.dictation.enabled,
  );

  const workspaceSelectionKey =
    conversationId ?? DRAFT_WORKSPACE_SELECTION_CHAT_ID;

  const hasWorkspace = !!useAgentStore((state) =>
    workspaceSelectionKey
      ? state.workspaceSelections[workspaceSelectionKey]
      : undefined,
  );

  const {
    fileInputRef,
    fileAccept,
    currentAttachments,
    removeCurrentAttachment,
    processFiles,
    openFilePicker,
    handleFileChange,
    handlePaste,
  } = useChatAttachments();
  const { isDraggingFiles } = useFileDragDetection({
    onFilesDropped: processFiles,
  });

  const handleTextPaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const lines = text.split("\n").length;
    const chars = text.length;
    if (chars > 500 || lines > 5) {
      e.preventDefault();
      e.stopPropagation();
      setPastedPreview({
        id: crypto.randomUUID(),
        text,
        preview: text.split("\n").slice(0, 3).join("\n").slice(0, 250),
        lines,
        chars,
      });
    }
  }, []);

  const handlePasteCombined = useCallback(
    (e: React.ClipboardEvent) => {
      handleTextPaste(e);
      if (!e.defaultPrevented) {
        handlePaste(e);
      }
    },
    [handlePaste, handleTextPaste],
  );

  const dismissPastedPreview = useCallback(() => {
    setPastedPreview(null);
  }, []);

  const textareaRef = useAutoResizeTextarea(draft);
  const { showSlashMenu, slashQuery, closeSlashMenu } = useSlashCommand(draft);

  const features = useFeatures();
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);

  const filteredFeatures = useMemo(() => {
    const query = slashQuery.toLowerCase().trim();

    return query
      ? features.filter((feature) =>
          [feature.name, feature.description, feature.id].some((field) =>
            field?.toLowerCase().includes(query),
          ),
        )
      : features;
  }, [features, slashQuery]);

  useEffect(() => {
    setSlashMenuIndex(0);
  }, [slashQuery]);

  const activeFeatures = useMemo(
    () => features.filter((feature) => feature.active),
    [features],
  );

  const hasContent =
    draft.trim() || currentAttachments.length > 0 || !!pastedPreview;
  const appendTranscript = useCallback((text: string) => {
    const transcript = text.trim();
    if (!transcript) return;

    setDraft((previous) =>
      previous.trim() ? `${previous.trimEnd()} ${transcript}` : transcript,
    );
  }, []);
  const {
    recording,
    start,
    stop,
    installOpen,
    models,
    selectedModelId,
    installingModelId,
    downloadProgress,
    closeInstall,
    installModel,
    selectInstalledModel,
    processing,
  } = useDictation(appendTranscript);

  const downloadPercent =
    downloadProgress?.totalBytes && downloadProgress.totalBytes > 0
      ? Math.round(
          (downloadProgress.downloadedBytes / downloadProgress.totalBytes) *
            100,
        )
      : null;

  // Feature flag: toggle to disable image uploads in the attachment menu.
  const canUploadImages = true;

  const handleSubmit = useCallback(() => {
    if (!hasContent && !pastedPreview) return;
    if (agentEnabled && !hasWorkspace) return;

    const finalText = pastedPreview
      ? draft.trim()
        ? `${draft}\n\n${pastedPreview.text}`
        : pastedPreview.text
      : draft;

    const trimmed = finalText.trim();
    onSubmit(trimmed);
    setDraft("");
    setPastedPreview(null);
  }, [
    hasContent,
    agentEnabled,
    hasWorkspace,
    draft,
    pastedPreview,
    onSubmit,
  ]);

  const handleAction = useCallback(() => {
    if (isStreaming) {
      onStop();
      return;
    }

    handleSubmit();
  }, [handleSubmit, isStreaming, onStop]);

  const handleSlashSelect = useCallback(
    (feature: FeatureDef & { active: boolean; warning?: string }) => {
      feature.toggle();
      setDraft((prev) => prev.replace(/(?:^|\s)\/\w*$/, ""));
      closeSlashMenu();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => textareaRef.current?.focus());
      });
    },
    [closeSlashMenu, textareaRef],
  );

  const openFeaturePicker = useCallback(() => {
    setDraft((previous) => (previous.trim() ? previous : "/"));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => textareaRef.current?.focus());
    });
  }, [textareaRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSlashMenu) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashMenuIndex(
            (prev) => (prev + 1) % (filteredFeatures.length || 1),
          );
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashMenuIndex(
            (prev) =>
              (prev - 1 + (filteredFeatures.length || 1)) %
              (filteredFeatures.length || 1),
          );
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();

          if (filteredFeatures[slashMenuIndex]) {
            handleSlashSelect(filteredFeatures[slashMenuIndex]);
          }

          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          closeSlashMenu();
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [
      closeSlashMenu,
      filteredFeatures,
      draft,
      handleSlashSelect,
      handleSubmit,
      showSlashMenu,
      slashMenuIndex,
    ],
  );

  return (
    <Box className="relative w-full">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        accept={fileAccept}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <Box className="relative w-full">
        {showSlashMenu && (
            <SlashCommandMenu
              features={filteredFeatures}
              onSelect={handleSlashSelect}
              selectedIndex={slashMenuIndex}
              slashQuery={slashQuery}
            />
          )}

        <Box
          className={cn(
            "chat-file-drop-target w-full rounded-3xl border bg-popover/95 px-4 py-3 shadow-sm backdrop-blur-md transition-colors duration-[var(--dur-fast)] ease-[var(--ease-soft)]",
            isTemporary
              ? "border-dashed border-border/60"
              : "border-transparent hover:border-border/60 focus-within:border-border/60",
            isDraggingFiles && "chat-file-drop-target--active",
          )}
          aria-label="Chat message composer. Drop files here to attach them."
          aria-describedby={isDraggingFiles ? "chat-file-drop-status" : undefined}
          data-file-drag-active={isDraggingFiles ? "true" : "false"}
        >
          <Box className="relative flex min-h-16 flex-col">
            <Box
              id="chat-file-drop-status"
              aria-live="polite"
            >
              {isDraggingFiles ? "Drop files to attach them to this message." : ""}
            </Box>
            <Box
              className="chat-file-drop-label"
              aria-hidden="true"
            >
              Drop files to attach
            </Box>
            {activeFeatures.length > 0 && (
                <ActiveFeaturesList
                  activeFeatures={activeFeatures}
                  hasAttachments={currentAttachments.length > 0}
                />
              )}

            {currentAttachments.length > 0 && (
                <ChatAttachmentsList
                  attachments={currentAttachments}
                  onRemove={removeCurrentAttachment}
                />
              )}

            <InputBase
              multiline
              inputRef={textareaRef}
              minRows={1}
              placeholder={
                agentEnabled
                  ? hasWorkspace
                    ? "Ask Poly Agent..."
                    : "Select a project or sandbox to use Poly Agent..."
                  : "How can I help you today?"
              }
              value={draft}
              className="min-h-8 resize-none text-sm leading-6 placeholder:text-muted-foreground"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePasteCombined}
              onFocus={() => onFocusChange?.(true)}
              onBlur={() => onFocusChange?.(false)}
            />

            {pastedPreview && (
                <Box
                  className="animate-fade-in"
                >
                  <Box>
                    <Box
                    >
                      <Typography
                        variant="caption"
                      >
                        PASTED
                      </Typography>
                      <Typography
                        variant="caption"
                      >
                        {pastedPreview.lines} lines · {pastedPreview.chars}{" "}
                        chars
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                    >
                      {pastedPreview.preview}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={dismissPastedPreview}
                    aria-label="Remove pasted content"
                  >
                    <X size={14} />
                  </IconButton>
                </Box>
              )}

            <Box className="mt-2 flex items-center justify-between gap-3">
              <Box className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      size="small"
                      aria-label="Add attachment"
                      disabled={isStreaming}
                      className="size-8 rounded-full"
                    >
                      <Plus size={20} />
                    </IconButton>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="min-w-48">
                    {canUploadImages ? (
                      <DropdownMenuItem
                        className="gap-2 px-3 py-2 whitespace-nowrap"
                        onClick={() => openFilePicker("image/*")}
                      >
                        <ImageIcon />
                        <span>Upload images</span>
                      </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuItem
                      className="gap-2 px-3 py-2 whitespace-nowrap"
                      onClick={() => openFilePicker("*")}
                    >
                      <Paperclip />
                      <span>Upload files</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {features.map((feature) => {
                      const Icon = feature.icon;

                      return (
                        <DropdownMenuItem
                          key={feature.id}
                          className="gap-2 px-3 py-2 whitespace-nowrap"
                          onClick={() => feature.toggle()}
                        >
                          <Icon />
                          <span>{feature.name}</span>
                          {feature.warning && (
                            <Tooltip title={feature.warning} arrow>
                              <AlertTriangle
                                className="text-[var(--warning)]"
                              />
                            </Tooltip>
                          )}

                          {feature.active && (
                            <Box
                              className="ml-auto size-2 rounded-full bg-primary"
                            />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <IconButton
                  size="small"
                  aria-label="Open feature picker"
                  disabled={isStreaming}
                  onClick={openFeaturePicker}
                  className="size-8 rounded-full"
                >
                  <LayoutGrid size={16} />
                </IconButton>

                {agentEnabled && (
                  <AgentComposerControls
                    disabled={isStreaming}
                    chatId={workspaceSelectionKey}
                    mode="permission"
                  />
                )}
              </Box>

              <Box className="flex items-center gap-1">
                {dictationEnabled && (
                  <IconButton
                    onClick={recording ? stop : start}
                    disabled={isStreaming}
                    aria-label={recording ? "Stop dictation" : "Start dictation"}
                    className="size-8 rounded-full"
                  >
                    {processing ? (
                      <Box
                      >
                        <Spinner className="size-4 text-muted-foreground" />
                      </Box>
                    ) : recording ? (
                      <StopIcon />
                    ) : (
                      <Mic size={18} />
                    )}
                  </IconButton>
                )}
                <IconButton
                  onClick={handleAction}
                  disabled={
                    isStreaming
                      ? false
                      : !hasContent || (agentEnabled && !hasWorkspace)
                  }
                  aria-label={isStreaming ? "Stop generation" : "Send message"}
                  className="size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                >
                  <Box
                  >
                    {isStreaming ? (
                      <Square size={14} fill="currentColor" />
                    ) : (
                      <ArrowUp size={20} strokeWidth={2.5} />
                    )}
                  </Box>
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {agentEnabled && (
          <Box
          >
            <Box
            >
              <AgentComposerControls
                disabled={isStreaming}
                chatId={workspaceSelectionKey}
                mode="workspace"
              />
            </Box>
          </Box>
        )}
      </Box>

      <DictationModelDialog
        open={installOpen}
        models={models}
        selectedModelId={selectedModelId}
        installingModelId={installingModelId}
        downloadPercent={downloadPercent}
        onClose={closeInstall}
        onInstall={installModel}
        onSelect={selectInstalledModel}
      />
    </Box>
  );
});
