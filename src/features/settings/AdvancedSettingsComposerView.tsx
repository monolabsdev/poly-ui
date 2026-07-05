import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDevStore } from "@/store/devStore";
import { registerView, useViewStore } from "@/lib/view-registry";
import { ADVANCED_SETTINGS_VIEW_ID } from "./settingsRegistry";
import { DeveloperToolsSection } from "./DeveloperToolsSection";
import { AdvancedSettingsContent } from "./tabs/AdvancedSettingsContent";

export function AdvancedSettingsComposerView() {
  const devMode = useDevStore((state) => state.devMode);
  const close = () => useViewStore.getState().setActiveView(null);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Advanced Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Experimental, developer, diagnostics, and low-level configuration.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={close}>
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-6">
          <AdvancedSettingsContent />
          {devMode ? <DeveloperToolsSection /> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

registerView(ADVANCED_SETTINGS_VIEW_ID, AdvancedSettingsComposerView);
