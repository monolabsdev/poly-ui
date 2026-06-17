import { Box } from "@mui/material";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";

export function ConversationSkeleton() {
  const { isCollapsed } = useSidebar();
  if (isCollapsed) return null;
  return (
    <Box sx={{ px: 1.5 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Box
          key={i}
          sx={{
            height: 36,
            borderRadius: "8px",
            mb: 0.5,
            bgcolor: "action.hover",
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 0.6 },
              "50%": { opacity: 0.3 },
            },
          }}
        />
      ))}
    </Box>
  );
}
