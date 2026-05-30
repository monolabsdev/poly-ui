import { memo } from "react";
import { X } from "lucide-react";
import { Box } from "@mui/material";
import { motion } from "motion/react";
import type { FeatureDef } from "@/lib/featureRegistry";

interface ActiveFeaturesListProps {
  activeFeatures: (FeatureDef & { active: boolean })[];
  hasAttachments: boolean;
}

export const ActiveFeaturesList = memo(function ActiveFeaturesList({
  activeFeatures,
  hasAttachments,
}: ActiveFeaturesListProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        px: 1.5,
        pt: 1,
        pb: hasAttachments ? 0 : 1,
      }}
    >
      {activeFeatures.map((feature) => {
        const Icon = feature.icon;
        return (
          <Box
            key={feature.id}
            component={motion.div}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.25,
              py: 0.5,
              borderRadius: "16px",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              "&:hover": {
                bgcolor: "primary.dark",
              },
            }}
            onClick={() => feature.toggle()}
          >
            <Icon size={14} />
            {feature.name}
            <X size={14} style={{ marginLeft: 4 }} />
          </Box>
        );
      })}
    </Box>
  );
});
