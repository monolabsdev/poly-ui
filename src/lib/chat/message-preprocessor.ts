export interface TemporalVariables {
  currentDate: string;
  currentTime: string;
  currentWeekday: string;
}

export interface MessagePreprocessor {
  preprocess(content: string): string;
}

export function createMessagePreprocessor(
  getVariables: () => TemporalVariables,
): MessagePreprocessor {
  return {
    preprocess(content: string): string {
      const { currentDate, currentTime, currentWeekday } = getVariables();

      return content
        .replace(/\{\{CURRENT_DATE\}\}/g, currentDate)
        .replace(/\{\{CURRENT_TIME\}\}/g, currentTime)
        .replace(/\{\{CURRENT_WEEKDAY\}\}/g, currentWeekday);
    },
  };
}

function getCurrentTemporalVariables(): TemporalVariables {
  const now = new Date();
  return {
    currentDate: now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    currentTime: now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    currentWeekday: now.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

export const defaultPreprocessor = createMessagePreprocessor(
  getCurrentTemporalVariables,
);

export function createMockPreprocessor(
  overrides: Partial<TemporalVariables> = {},
): MessagePreprocessor {
  const defaults: TemporalVariables = {
    currentDate: "January 1, 2025",
    currentTime: "12:00 AM",
    currentWeekday: "Monday",
    ...overrides,
  };

  return createMessagePreprocessor(() => defaults);
}