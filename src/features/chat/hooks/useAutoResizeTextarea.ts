import { useRef, useLayoutEffect } from "react";
import { estimateTextareaHeight } from "@/lib/utils/pretext";

const FONT_SIZE = 17;
const LINE_HEIGHT = 1.5;
const LINE_PX = FONT_SIZE * LINE_HEIGHT;
const MAX_LINES = 6;
const MIN_HEIGHT = 40;
export const MAX_HEIGHT = Math.ceil(LINE_PX * MAX_LINES + 16);

export function useAutoResizeTextarea(draft: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (!draft.trim()) {
      el.style.height = `${MIN_HEIGHT}px`;
      el.scrollTop = 0;
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const estimatedHeight = estimateTextareaHeight({
        text: draft,
        width: el.clientWidth,
        minHeight: MIN_HEIGHT,
        maxHeight: MAX_HEIGHT,
      });
      el.style.height = `${estimatedHeight}px`;
      const scrollHeight = el.scrollHeight;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(scrollHeight, MAX_HEIGHT),
      );

      el.style.height = `${newHeight}px`;
    });

    return () => cancelAnimationFrame(frameId);
  }, [draft]);

  return textareaRef;
}
