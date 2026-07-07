import { memo, useCallback, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { InputBase } from "@/components/ui/input-base";
import { cn } from "@/lib/utils";

type MobileChatInputProps = {
  onSubmit: (value: string) => void | Promise<void>;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  status?: string;
  isTemporary?: boolean;
};

export const MobileChatInput = memo(function MobileChatInput({
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  status,
  isTemporary,
}: MobileChatInputProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasContent = draft.trim().length > 0;

  const submit = useCallback(() => {
    if (isStreaming) {
      onStop?.();
      return;
    }
    const value = draft.trim();
    if (!value || disabled) return;
    setDraft("");
    void onSubmit(value);
  }, [disabled, draft, isStreaming, onStop, onSubmit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <Box className="relative w-full">
      <Box
        className={cn(
          "w-full rounded-3xl border bg-popover px-4 py-3 shadow-sm transition-colors duration-[var(--dur-fast)] ease-[var(--ease-soft)]",
          isTemporary
            ? "border-dashed border-border/60"
            : "border-transparent hover:border-border/60 focus-within:border-border/60",
        )}
        aria-label="Chat message composer"
      >
        <Box className="relative flex min-h-16 flex-col">
          <InputBase
            multiline
            inputRef={textareaRef}
            minRows={1}
            placeholder="How can I help you today?"
            value={draft}
            className="min-h-8 resize-none text-sm leading-6 placeholder:text-muted-foreground"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled && !isStreaming}
          />

          <Box className="mt-5 flex items-center justify-between gap-2 px-0 pb-0">
            <Box className="min-w-0 truncate text-xs text-muted-foreground">
              {status}
            </Box>
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={isStreaming ? false : disabled || !hasContent}
              aria-label={isStreaming ? "Stop generation" : "Send message"}
              className="size-9 rounded-full"
            >
              {isStreaming ? (
                <Square size={14} fill="currentColor" />
              ) : (
                <ArrowUp size={18} strokeWidth={2.5} />
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});
