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

const cache = new Map<string, number>();
const MAX_CACHE = 100;

export const measureTextHeight = (
  text: string,
  font: string,
  width: number,
  lineHeight: number
) => {
  if (!text || width <= 0) return 0;
  const key = `${text}|${font}|${width}|${lineHeight}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  try {
    const prepared = prepare(text, font);
    const result = layout(prepared, width, lineHeight);
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, result.height);
    return result.height;
  } catch (e) {
    console.warn("Pretext measurement failed:", e);
    return 0;
  }
};
