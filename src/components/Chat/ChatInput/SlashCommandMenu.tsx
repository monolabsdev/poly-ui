import { AlertTriangle, Search } from "lucide-react";
import { Box, Typography, Tooltip } from "@mui/material";
import type { FeatureDef } from "@/lib/featureRegistry";

interface SlashCommandMenuProps {
  features: (FeatureDef & { active: boolean; warning?: string })[];
  onSelect: (feature: FeatureDef & { active: boolean; warning?: string }) => void;
  selectedIndex: number;
  slashQuery: string;
}

export function SlashCommandMenu({
  features,
  onSelect,
  selectedIndex,
  slashQuery,
}: SlashCommandMenuProps) {
  const query = slashQuery.toLowerCase().trim();
  const filtered = query
    ? features.filter((f) =>
        [f.name, f.description, f.id].some((field) =>
          field?.toLowerCase().includes(query),
        ),
      )
    : features;

  return (
    <Box
      className="animate-popover"
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
        minWidth: 200,
      }}
    >
      {filtered.length === 0 ? (
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, opacity: 0.5 }}>
          <Search size={14} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No features match "{slashQuery}"
          </Typography>
        </Box>
      ) : (
        <Box sx={{ p: 0.5 }}>
          {filtered.map((feature, index) => {
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
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: feature.active ? "primary.main" : "text.primary",
                    }}
                  >
                    {feature.name}
                  </Typography>
                  {feature.warning && (
                    <Tooltip title={feature.warning} arrow>
                      <Box sx={{ display: "flex", alignItems: "center", lineHeight: 0 }}>
                        <AlertTriangle size={12} style={{ color: "orange" }} />
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
