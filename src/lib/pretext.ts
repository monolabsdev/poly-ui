import { prepare, layout } from "@chenglou/pretext";

/**
 * Pretext configurations for efficient text measurement.
 */

const FONT_FAMILY = '"Geist Variable", "Inter", "system-ui", "sans-serif"';

export const PRETEXT_FONTS = {
  message: `400 15px/1.6 ${FONT_FAMILY}`,
  userMessage: `400 15.5px/1.6 ${FONT_FAMILY}`,
  composer: `400 17px/1.5 ${FONT_FAMILY}`,
  sidebarItem: `400 13.5px/1.5 ${FONT_FAMILY}`,
};

export const PRETEXT_LINE_HEIGHTS = {
  message: 1.6,
  userMessage: 1.6,
  composer: 1.5,
  sidebarItem: 1.5,
};

/**
 * Helper to measure text height for a given width.
 * Note: Pretext prepare() should be cached if the text doesn't change.
 * For streaming text, we prepare on each chunk.
 */
export const measureTextHeight = (
  text: string,
  font: string,
  width: number,
  lineHeight: number
) => {
  if (!text || width <= 0) return 0;
  try {
    const prepared = prepare(text, font);
    const result = layout(prepared, width, lineHeight);
    return result.height;
  } catch (e) {
    console.warn("Pretext measurement failed:", e);
    return 0;
  }
};
