import { Square, Plus, ArrowUp, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { useRef, useEffect, useState, useCallback, memo } from "react";
import { Box, InputBase, IconButton, Typography } from "@mui/material";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useChatStore } from "@/store/chatStore";
import { Attachment } from "@/types/chat";
import { isImageAttachment, createDataUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useTiming, ANIMATION_VARIANTS } from "@/lib/motion";
import { PRETEXT_FONTS, PRETEXT_LINE_HEIGHTS, measureTextHeight } from "@/lib/pretext";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileAccept, setFileAccept] = useState<string>("*");
  const [draft, setDraft] = useState("");
  const timing = useTiming();

  const currentAttachments = useChatStore((state) => state.currentAttachments);
  const addCurrentAttachment = useChatStore(
    (state) => state.actions.addCurrentAttachment,
  );
  const removeCurrentAttachment = useChatStore(
    (state) => state.actions.removeCurrentAttachment,
  );

  const canUploadImages = true;

  const handleFileClick = (accept: string) => {
    setFileAccept(accept);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleSubmit = () => {
    const hasContent = draft.trim().length > 0 || currentAttachments.length > 0;
    if (!hasContent || isStreaming) return;
    onSubmit(draft);
    setDraft("");
  };

  const handleAction = () => {
    if (isStreaming) {
      onStop();
      return;
    }
    handleSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const reader = new FileReader();

        const attachment: Attachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
        };

        const isImage = isImageAttachment(file.type);
        reader.onload = (e) => {
          const result = e.target?.result as string;
          attachment.content = isImage ? result.split(",")[1] : result;
          addCurrentAttachment(attachment);
        };

        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      }
    },
    [addCurrentAttachment],
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const width = textarea.clientWidth || 800; // fallback width
    const height = measureTextHeight(
      draft, 
      PRETEXT_FONTS.composer, 
      width, 
      PRETEXT_LINE_HEIGHTS.composer
    );
    
    // Add some buffer for padding/line-height adjustments
    const finalHeight = Math.max(40, Math.min(height + 12, 200));
    textarea.style.height = `${finalHeight}px`;
  }, [draft]);

  const canSubmit =
    draft.trim() || currentAttachments.length > 0 || isStreaming;
  const isInputDisabled = isStreaming || (!selectedModel && !allowEmptyModel);

  return (
    <Box
      sx={{
        shrink: 0,
        bgcolor: "transparent",
        px: 2,
        pb: 3,
        pt: 2,
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
      <Box sx={{ mx: "auto", width: "100%", maxWidth: 840 }}>
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
            transition: "background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
            border: isDragging ? "2px dashed" : isTemporary ? "1px dashed" : "1px solid",
            borderColor: isDragging || isTemporary ? "border.main" : "divider",
            "&:focus-within": {
              borderColor: "border.main",
              boxShadow: (theme) => `0 0 0 1px ${theme.palette.border.main}`,
            },
          }}
        >
          <AnimatePresence>
            {currentAttachments.length > 0 ? (
              <Box
                component={motion.div}
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: timing.duration("base"), ease: timing.ease }}
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1.5,
                  px: 1.5,
                  pt: 1,
                  pb: 1,
                }}
              >
                <AnimatePresence>
                {currentAttachments.map((att) => (
                  <Box
                    component={motion.div}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                    key={att.id}
                    sx={{
                      position: "relative",
                      width: 64,
                      height: 64,
                      borderRadius: "12px",
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "action.hover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {att.type.startsWith("image/") ? (
                      <img
                        src={createDataUrl(att.type, att.content || "")}
                        alt={att.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <Paperclip size={24} style={{ color: "text.secondary" }} />
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeCurrentAttachment(att.id)}
                      sx={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        bgcolor: "background.paper",
                        boxShadow: 1,
                        p: 0.5,
                        "&:hover": { bgcolor: "action.selected" },
                      }}
                    >
                      <X size={12} />
                    </IconButton>
                  </Box>
                ))}
                </AnimatePresence>
              </Box>
            ) : null}
          </AnimatePresence>

          <InputBase
            multiline
            inputRef={textareaRef}
            placeholder="How can I help you today?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
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

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mt: 1,
              px: 0.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <IconButton
                    size="small"
                    sx={{ color: "text.secondary", p: 1 }}
                    disabled={isStreaming}
                  >
                    <Plus size={20} />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {canUploadImages ? (
                    <DropdownMenuItem
                      onClick={() => handleFileClick("image/*")}
                      sx={{ display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <ImageIcon size={16} />
                      <Typography variant="body2">Upload images</Typography>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => handleFileClick("*")}
                    sx={{ display: "flex", alignItems: "center", gap: 2 }}
                  >
                    <Paperclip size={16} />
                    <Typography variant="body2">Upload files</Typography>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton
                component={motion.button}
                variants={ANIMATION_VARIANTS.interactive}
                whileHover="hover"
                whileTap="tap"
                animate={{
                  scale: canSubmit || isStreaming ? 1 : 0.95,
                  opacity: canSubmit || isStreaming ? 1 : 0.3,
                }}
                transition={{ duration: timing.duration("fast"), ease: timing.ease }}
                onClick={handleAction}
                disabled={isStreaming ? false : !canSubmit || isInputDisabled}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0,
                  bgcolor: "white",
                  color: "black",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 0.5,
                  mr: 0.5,
                  "&:hover": {
                    bgcolor: "white",
                    opacity: 0.9,
                  },
                  "&.Mui-disabled": {
                    bgcolor: "action.hover",
                    color: "text.disabled",
                    opacity: 0.3,
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
