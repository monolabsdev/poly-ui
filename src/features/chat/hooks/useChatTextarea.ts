import { useRef, useEffect } from "react";
import { PRETEXT_FONTS, PRETEXT_LINE_HEIGHTS, measureTextHeight } from "@/lib/utils/pretext";

/**
 * Manages textarea auto-resizing based on the current draft content.
 * Returns a ref to attach to the textarea element.
 */
export function useChatTextarea(draft: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const width = textarea.clientWidth || 800;
    const height = measureTextHeight(
      draft,
      PRETEXT_FONTS.composer,
      width,
      PRETEXT_LINE_HEIGHTS.composer,
    );

    // Add some buffer for padding/line-height adjustments
    const finalHeight = Math.max(40, Math.min(height + 12, 200));
    textarea.style.height = `${finalHeight}px`;
  }, [draft]);

  return textareaRef;
}
