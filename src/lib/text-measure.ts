import { prepare, layout, PreparedText } from '@chenglou/pretext';

interface MeasureConfig {
  font: string;
  lineHeight: number;
  whiteSpace?: 'normal' | 'pre-wrap';
  wordBreak?: 'normal' | 'keep-all' | 'break-word';
  letterSpacing?: number;
}

const DEFAULT_CONFIG: MeasureConfig = {
  font: '15px Inter', // Matches Message.tsx fontSize: "15px"
  lineHeight: 25.6,   // 15px * 1.6 (lineHeight: 1.6) + approx padding/margin
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const cache = new Map<string, PreparedText>();

export function measureTextHeight(text: string, width: number, config: Partial<MeasureConfig> = {}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const cacheKey = `${text}|${settings.font}|${settings.whiteSpace}|${settings.wordBreak}|${settings.letterSpacing}`;

  let prepared = cache.get(cacheKey);
  if (!prepared) {
    prepared = prepare(text, settings.font, {
      whiteSpace: settings.whiteSpace as any,
      wordBreak: settings.wordBreak as any,
      letterSpacing: settings.letterSpacing,
    });
    cache.set(cacheKey, prepared);
  }

  const { height } = layout(prepared, width, settings.lineHeight);
  return height;
}

export function clearTextCache() {
  cache.clear();
}
