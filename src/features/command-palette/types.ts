import type { ReactNode } from "react";

export type CommandPaletteCategory =
  | "conversation"
  | "action"
  | "setting"
  | "feature";

export interface CommandPaletteItem {
  id: string;
  title: string;
  description?: string;
  category: CommandPaletteCategory;
  keywords?: string[];
  icon?: ReactNode;
  shortcut?: string;
  execute: () => void;
}

