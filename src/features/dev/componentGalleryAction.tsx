import { Boxes } from "lucide-react";
import type { CommandPaletteItem } from "@/features/command-palette/types";
import { registerView, useViewStore } from "@/lib/view-registry";
import { ComponentGallery } from "./ComponentGallery";

const COMPONENT_GALLERY_VIEW = "component-gallery";

if (import.meta.env.DEV) {
  registerView(COMPONENT_GALLERY_VIEW, ComponentGallery);
}

export function getDevComponentGalleryAction(
  isDev: boolean,
  devMode: boolean,
): CommandPaletteItem | null {
  if (!isDev || !devMode) return null;

  return {
    id: "action:component-gallery",
    title: "Open Component Gallery",
    description: "Browse shared UI components",
    category: "action",
    keywords: ["dev", "components", "gallery", "ui"],
    icon: <Boxes size={16} />,
    execute: () => useViewStore.getState().setActiveView(COMPONENT_GALLERY_VIEW),
  };
}
