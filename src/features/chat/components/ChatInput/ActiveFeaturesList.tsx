import { memo } from "react";
import { X } from "lucide-react";
import type { FeatureDef } from "@/lib/featureRegistry";

interface ActiveFeaturesListProps {
  activeFeatures: (FeatureDef & { active: boolean })[];
  hasAttachments: boolean;
}

export const ActiveFeaturesList = memo(function ActiveFeaturesList({
  activeFeatures,
  hasAttachments: _hasAttachments,
}: ActiveFeaturesListProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-1">
      {activeFeatures.map((feature) => {
        const Icon = feature.icon;
        return (
          <button
            key={feature.id}
            type="button"
            onClick={() => feature.toggle()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium cursor-pointer select-none"
          >
            <Icon size={12} />
            <span>{feature.name}</span>
            <X size={12} className="opacity-60" />
          </button>
        );
      })}
    </div>
  );
});
