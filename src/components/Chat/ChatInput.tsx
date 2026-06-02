import { Square, Plus, ArrowUp, Paperclip, Image as ImageIcon, Mic, AlertTriangle } from "lucide-react";
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
import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { useTiming } from "@/lib/motion";
import { useFeatures, type FeatureDef } from "@/lib/featureRegistry";
import { useChatAttachments } from "@/hooks/useChatAttachments";
import { useChatTextarea } from "@/hooks/useChatTextarea";
import { useSlashCommand } from "@/hooks/useSlashCommand";
import { useDictation } from "@/hooks/useDictation";
import { ActiveFeaturesList } from "@/components/Chat/ChatInput/ActiveFeaturesList";
import { SlashCommandMenu } from "@/components/Chat/ChatInput/SlashCommandMenu";
import { ChatAttachmentsList } from "@/components/Chat/ChatInput/ChatAttachmentsList";
import { useNotify } from "@/hooks/useNotify";

interface ChatInputProps {
  onSubmit: (value: string) => void | Promise<void>;
  onStop: () => void;
  isStreaming: boolean;
  selectedModel: string;
  hasMessages: boolean;
  allowEmptyModel?: boolean;
  onFocusChange?: (focused: boolean) => void;
  isTemporary?: boolean;
}

export const ChatInput = memo(function ChatInput({
  onSubmit,
  onStop,
  isStreaming,
  selectedModel,
  allowEmptyModel = false,
  onFocusChange,
  isTemporary,
}: ChatInputProps) {
  const [draft, setDraft] = useState("");
  const timing = useTiming();
  const notify = useNotify();

  // Hooks
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
      ? features.filter((f) =>
          [f.name, f.description, f.id].some((field) =>
            field?.toLowerCase().includes(query),
          ),
        )
      : features;
  }, [features, slashQuery]);
  const appendTranscript = useCallback((text: string) => {
    setDraft((prev) => {
      const cleanText = text.trim();
      if (!cleanText) {
        return prev;
      }

      if (!prev.trim()) {
        return cleanText;
      }

      const separator = /\s$/.test(prev) ? "" : " ";
      return `${prev}${separator}${cleanText}`;
    });
    textareaRef.current?.focus();
  }, [textareaRef]);

  const { isRecording, isTranscribing, isAvailable: isDictationAvailable, toggle } = useDictation({
    onTranscript: appendTranscript,
    onError: (message) => notify.error("Dictation failed", message),
  });

  useEffect(() => {
    setSlashMenuIndex(0);
  }, [slashQuery]);

  // Derived state
  const activeFeatures = useMemo(
    () => features.filter((feature) => feature.active),
    [features],
  );
  const hasContent = draft.trim() || currentAttachments.length > 0;
  const isInputDisabled = isStreaming || (!selectedModel && !allowEmptyModel);
  const canUploadImages = true;

  // Handlers
  const handleSubmit = useCallback(() => {
    const hasMsg = draft.trim().length > 0 || currentAttachments.length > 0;
    if (!hasMsg || isStreaming) return;
    onSubmit(draft);
    setDraft("");
  }, [currentAttachments.length, draft, isStreaming, onSubmit]);

  const handleAction = useCallback(() => {
    if (isStreaming) {
      onStop();
      return;
    }
    handleSubmit();
  }, [handleSubmit, isStreaming, onStop]);

  const handleSlashSelect = useCallback((feature: FeatureDef & { active: boolean; warning?: string }) => {
    feature.toggle();
    setDraft((prev) => prev.replace(/\s?\/?$/, ""));
    closeSlashMenu();
    textareaRef.current?.focus();
  }, [closeSlashMenu, textareaRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSlashMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenuIndex((prev) => (prev + 1) % (filteredFeatures.length || 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenuIndex((prev) => (prev - 1 + (filteredFeatures.length || 1)) % (filteredFeatures.length || 1));
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
  }, [closeSlashMenu, filteredFeatures, handleSlashSelect, handleSubmit, showSlashMenu, slashMenuIndex]);

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
      <Box sx={{ mx: "auto", width: "100%", maxWidth: 840, position: "relative" }}>
        {/* Slash command menu */}
        <AnimatePresence>
          {showSlashMenu && (
            <SlashCommandMenu features={filteredFeatures} onSelect={handleSlashSelect} selectedIndex={slashMenuIndex} slashQuery={slashQuery} />
          )}
        </AnimatePresence>

        {/* Main input container */}
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
            borderRadius: "24px",
            bgcolor: isDragging ? "action.selected" : "background.paper",
            p: 1.5,
            border: isDragging ? "2px dashed" : isTemporary ? "1px dashed" : "1px solid",
            borderColor: isDragging || isTemporary ? "border.main" : "divider",
            "&:focus-within": {
              borderColor: "border.main",
              boxShadow: (theme) => `0 0 0 1px ${theme.palette.border.main}`,
            },
          }}
        >
          {/* Active feature badges */}
          <AnimatePresence>
            {activeFeatures.length > 0 && (
              <motion.div
                key="feature-badges-container"
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: timing.duration("base"), ease: timing.ease }}
              >
                <ActiveFeaturesList
                  activeFeatures={activeFeatures}
                  hasAttachments={currentAttachments.length > 0}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attachments */}
          <AnimatePresence>
            {currentAttachments.length > 0 && (
              <ChatAttachmentsList
                attachments={currentAttachments}
                onRemove={removeCurrentAttachment}
              />
            )}
          </AnimatePresence>

          {/* Textarea */}
          <InputBase
            multiline
            inputRef={textareaRef}
            placeholder="How can I help you today?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => onFocusChange?.(false)}
            disabled={isInputDisabled}
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

          {/* Bottom toolbar */}
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
            {/* Left: plus menu */}
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, sm: 0.5 }, flexShrink: 0 }}>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <IconButton
                    size="small"
                    aria-label="Add attachment"
                    sx={{ color: "text.secondary", p: 1 }}
                    disabled={isStreaming}
                  >
                    <Plus size={20} />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {canUploadImages ? (
                    <DropdownMenuItem
                      onClick={() => openFilePicker("image/*")}
                      sx={{ display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <ImageIcon size={16} />
                      <Typography variant="body2">Upload images</Typography>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => openFilePicker("*")}
                    sx={{ display: "flex", alignItems: "center", gap: 2 }}
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
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Icon size={16} />
                          <Typography variant="body2">{feature.name}</Typography>
                          {feature.warning && (
                            <Tooltip title={feature.warning} arrow>
                              <Box sx={{ display: "flex", alignItems: "center" }}>
                                <AlertTriangle size={14} style={{ color: "orange" }} />
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
            </Box>

            {/* Right: send / stop button */}
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
              <IconButton
                onClick={toggle}
                disabled={!isDictationAvailable || isStreaming || isTranscribing}
                aria-label={isRecording ? "Stop dictation" : "Start dictation"}
                title={
                  isDictationAvailable
                    ? isRecording
                      ? "Stop dictation"
                      : "Start dictation"
                    : "Dictation disabled in this build"
                }
                sx={{
                  width: 32,
                  height: 32,
                  p: 0,
                  color: isRecording ? "error.main" : "text.secondary",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 0.5,
                  "&.Mui-disabled": {
                    color: "text.disabled",
                    opacity: 0.5,
                  },
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {isTranscribing ? (
                    <motion.div
                      key="dictation-loading"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                      transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                    >
                      <Ring2
                        size="16"
                        stroke="4"
                        strokeLength="0.28"
                        bgOpacity="0.1"
                        speed="0.8"
                        color="currentColor"
                      />
                    </motion.div>
                  ) : isRecording ? (
                    <motion.div
                      key="dictation-stop"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                      transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                    >
                      <Square size={14} fill="currentColor" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dictation-mic"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      initial={{ scale: 0.5, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.5, opacity: 0, y: -10 }}
                      transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                    >
                      <Mic size={18} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </IconButton>
              <IconButton
                onClick={handleAction}
                disabled={isStreaming ? false : !hasContent || isInputDisabled || isRecording || isTranscribing}
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
                <AnimatePresence mode="popLayout" initial={false}>
                  {isStreaming ? (
                    <motion.div
                      key="stop"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                      transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                    >
                      <Square size={14} fill="currentColor" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="send"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      initial={{ scale: 0.5, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.5, opacity: 0, y: -10 }}
                      transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                    >
                      <ArrowUp size={20} strokeWidth={2.5} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});
