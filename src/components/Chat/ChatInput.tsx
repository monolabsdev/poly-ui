import {
  Square,
  Plus,
  ArrowUp,
  Paperclip,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";
import { useState, memo, useEffect, useCallback, useMemo } from "react";
import { Box, InputBase, IconButton, Typography, Tooltip } from "@mui/material";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "motion/react";

import { useTiming } from "@/lib/motion";
import { useFeatures, type FeatureDef } from "@/lib/featureRegistry";
import { useChatAttachments } from "@/hooks/useChatAttachments";
import { useChatTextarea } from "@/hooks/useChatTextarea";
import { useSlashCommand } from "@/hooks/useSlashCommand";
import { ActiveFeaturesList } from "@/components/Chat/ChatInput/ActiveFeaturesList";
import { SlashCommandMenu } from "@/components/Chat/ChatInput/SlashCommandMenu";
import { ChatAttachmentsList } from "@/components/Chat/ChatInput/ChatAttachmentsList";

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
  const timing = useTiming();
  const experimentalFeatures = useSettingsStore(
    (state) => state.general.experimentalFeatures,
  );
  const agentEnabled =
    useAgentStore((state) => state.enabled) && experimentalFeatures;

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
    isDragging,
    currentAttachments,
    removeCurrentAttachment,
    openFilePicker,
    handleFileChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
  } = useChatAttachments();

  const textareaRef = useChatTextarea(draft);
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

  const hasContent = draft.trim() || currentAttachments.length > 0;

  // Feature flag: toggle to disable image uploads in the attachment menu.
  const canUploadImages = true;

  const handleSubmit = useCallback(() => {
    if (!hasContent) return;
    if (agentEnabled && !hasWorkspace) return;

    onSubmit(draft);
    setDraft("");
  }, [hasContent, agentEnabled, hasWorkspace, draft, onSubmit]);

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
      textareaRef.current?.focus();
    },
    [closeSlashMenu, textareaRef],
  );

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
      handleSlashSelect,
      handleSubmit,
      showSlashMenu,
      slashMenuIndex,
    ],
  );

  return (
    <Box
      sx={{
        shrink: 0,
        bgcolor: "transparent",
        px: 2,
        pb: { xs: 2, sm: 3 },
        pt: { xs: 1.5, sm: 2 },
        position: "relative",
        zIndex: 10,
      }}
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        accept={fileAccept}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <Box
        sx={{
          mx: "auto",
          width: "100%",
          maxWidth: 840,
          minWidth: 0,
          position: "relative",
          pb: agentEnabled ? { xs: "52px", sm: "54px" } : 0,
        }}
      >
        <AnimatePresence>
          {showSlashMenu && (
            <SlashCommandMenu
              features={filteredFeatures}
              onSelect={handleSlashSelect}
              selectedIndex={slashMenuIndex}
              slashQuery={slashQuery}
            />
          )}
        </AnimatePresence>

        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            mb: agentEnabled ? "-8px" : 0,
            borderRadius: "24px",
            overflow: "hidden",
            bgcolor: isDragging ? "action.selected" : "background.paper",
            border: isDragging
              ? "2px dashed"
              : isTemporary
                ? "1px dashed"
                : "1px solid",
            borderColor: isDragging || isTemporary ? "border.main" : "divider",
            boxShadow: agentEnabled ? 2 : 1,
            transition: (theme) =>
              theme.transitions.create(
                ["border-color", "box-shadow", "background-color"],
                {
                  duration: theme.transitions.duration.short,
                },
              ),
            "&:focus-within": {
              borderColor: "border.main",
              boxShadow: (theme) =>
                agentEnabled ? theme.shadows[3] : theme.shadows[2],
            },
          }}
        >
          <Box
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: currentAttachments.length > 0 ? 160 : 120,
              width: "100%",
              borderRadius: "inherit",
              bgcolor: "transparent",
              p: 1.5,
            }}
          >
            <AnimatePresence>
              {activeFeatures.length > 0 && (
                <motion.div
                  key="feature-badges-container"
                  initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: timing.duration("base"),
                    ease: timing.ease,
                  }}
                >
                  <ActiveFeaturesList
                    activeFeatures={activeFeatures}
                    hasAttachments={currentAttachments.length > 0}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {currentAttachments.length > 0 && (
                <ChatAttachmentsList
                  attachments={currentAttachments}
                  onRemove={removeCurrentAttachment}
                />
              )}
            </AnimatePresence>

            <InputBase
              multiline
              inputRef={textareaRef}
              placeholder={
                agentEnabled
                  ? hasWorkspace
                    ? "Ask Poly Agent..."
                    : "Select a project or sandbox to use Poly Agent..."
                  : "How can I help you today?"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => onFocusChange?.(true)}
              onBlur={() => onFocusChange?.(false)}
              sx={{
                flex: 1,
                color: "text.primary",
                fontSize: "17px",
                px: 1.5,
                pt: 1,
                "& .MuiInputBase-input": {
                  p: 0,
                  "&::placeholder": {
                    color: "text.secondary",
                    opacity: 1,
                  },
                },
              }}
            />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 1,
                px: { xs: 0, sm: 0.5 },
                gap: 1,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 0, sm: 0.5 },
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <IconButton
                      size="small"
                      aria-label="Add attachment"
                      sx={{
                        color: "text.secondary",
                        p: 1,
                      }}
                      disabled={isStreaming}
                    >
                      <Plus size={20} />
                    </IconButton>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start">
                    {canUploadImages ? (
                      <DropdownMenuItem
                        onClick={() => openFilePicker("image/*")}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <ImageIcon size={16} />
                        <Typography variant="body2">Upload images</Typography>
                      </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuItem
                      onClick={() => openFilePicker("*")}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <Paperclip size={16} />
                      <Typography variant="body2">Upload files</Typography>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {features.map((feature) => {
                      const Icon = feature.icon;

                      return (
                        <DropdownMenuItem
                          key={feature.id}
                          onClick={() => feature.toggle()}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            justifyContent: "space-between",
                            minWidth: { xs: 140, sm: 160 },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Icon size={16} />
                            <Typography variant="body2">
                              {feature.name}
                            </Typography>

                            {feature.warning && (
                              <Tooltip title={feature.warning} arrow>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <AlertTriangle
                                    size={14}
                                    style={{ color: "orange" }}
                                  />
                                </Box>
                              </Tooltip>
                            )}
                          </Box>

                          {feature.active && (
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: "primary.main",
                              }}
                            />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {agentEnabled && (
                  <AgentComposerControls
                    disabled={isStreaming}
                    chatId={workspaceSelectionKey}
                    mode="permission"
                  />
                )}
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 0.5, sm: 1 },
                  flexShrink: 0,
                }}
              >
                <IconButton
                  onClick={handleAction}
                  disabled={
                    isStreaming
                      ? false
                      : !hasContent ||
                        (agentEnabled && !hasWorkspace)
                  }
                  aria-label={isStreaming ? "Stop generation" : "Send message"}
                  sx={{
                    width: 32,
                    height: 32,
                    p: 0,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 0.5,
                    mr: 0.5,
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                    "&.Mui-disabled": {
                      bgcolor: "action.disabledBackground",
                      color: "text.disabled",
                      opacity: 1,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
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
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
              width: "100%",
              minHeight: { xs: 56, sm: 58 },
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-start",
              px: { xs: 2.5, sm: 3 },
              pt: { xs: 3.4, sm: 3.6 },
              pb: { xs: 1.15, sm: 1.25 },
              borderRadius: "0 0 24px 24px",
              overflow: "hidden",
              pointerEvents: "auto",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.026)"
                  : "rgba(15,23,42,0.03)",
              border: "1px solid",
              borderTopColor: "transparent",
              borderColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.055)"
                  : "rgba(15,23,42,0.065)",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "inset 0 -1px 0 rgba(255,255,255,0.025)"
                  : "inset 0 -1px 0 rgba(255,255,255,0.45)",
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 28,
                pointerEvents: "none",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? "linear-gradient(to bottom, rgba(0,0,0,0.42), rgba(0,0,0,0))"
                    : "linear-gradient(to bottom, rgba(15,23,42,0.08), rgba(15,23,42,0))",
              },
            }}
          >
            <Box
              sx={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                minWidth: 0,
                maxWidth: "100%",
                opacity: 0.78,
                "& button": {
                  minHeight: 28,
                },
              }}
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
    </Box>
  );
});
