import { Box, Typography } from "@mui/material";
import { motion } from "motion/react";
import { useTiming } from "@/lib/motion";
import type { FeatureDef } from "@/lib/featureRegistry";

interface SlashCommandMenuProps {
  features: (FeatureDef & { active: boolean })[];
  onSelect: (feature: FeatureDef & { active: boolean }) => void;
  selectedIndex: number;
}

export function SlashCommandMenu({
  features,
  onSelect,
  selectedIndex,
}: SlashCommandMenuProps) {
  const timing = useTiming();

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: timing.duration("fast"), ease: timing.ease }}
      sx={{
        position: "absolute",
        bottom: "100%",
        mb: 1,
        bgcolor: "background.paper",
        borderRadius: "16px",
        boxShadow: (theme) =>
          `0 4px 24px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.1)"}`,
        border: "1px solid",
        borderColor: "border.main",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {/*<Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", px: 1, fontWeight: 500 }}
        >
          Features
        </Typography>
      </Box>*/}
      <Box sx={{ p: 0.5 }}>
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const isSelected = index === selectedIndex;
          return (
            <Box
              key={feature.id}
              onClick={() => onSelect(feature)}
              sx={{
                display: "flex",
                alignItems: "center",
                p: 1,
                gap: 1,
                borderRadius: "12px",
                cursor: "pointer",
                bgcolor: isSelected ? "action.hover" : "transparent",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Icon size={16} />
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: feature.active ? "primary.main" : "text.primary",
                  }}
                >
                  {feature.name}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
