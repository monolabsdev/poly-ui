import Box from "@mui/material/Box";

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        px: 0.45,
        py: 0.1,
        borderRadius: "5px",
        border: "1px solid",
        borderColor: "border.light",
        bgcolor: "action.hover",
        color: "text.primary",
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        fontSize: "0.92em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Box>
  );
}

export function DiffStat({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.55,
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Box component="span" sx={{ color: "success.main" }}>
        +{additions}
      </Box>
      <Box component="span" sx={{ color: "error.main" }}>
        -{deletions}
      </Box>
    </Box>
  );
}
