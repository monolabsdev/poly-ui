import { Box, Typography } from "@mui/material";
import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { useUpdateStore } from "@/store/updateStore";

export function UpdateChip() {
  const status = useUpdateStore((s) => s.status);
  const progress = useUpdateStore((s) => s.progress);
  const install = useUpdateStore((s) => s.actions.install);

  if (status === "idle" || status === "checking" || status === "available") return null;

  const isBusy = status === "downloading" || status === "installing";

  return (
    <Box
      onClick={isBusy ? undefined : install}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.25,
        borderRadius: "999px",
        bgcolor: status === "error" ? "error.main" : "primary.main",
        color: status === "error" ? "error.contrastText" : "primary.contrastText",
        fontSize: 12,
        fontWeight: 600,
        cursor: isBusy ? "default" : "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        "&:hover": isBusy
          ? {}
          : { opacity: 0.85 },
      }}
    >
      {isBusy ? (
        <>
          <Ring2
            size="12"
            stroke="3"
            strokeLength="0.28"
            bgOpacity="0.2"
            speed="0.8"
            color="currentColor"
          />
          <Typography variant="caption" sx={{ color: "inherit", fontSize: 11, fontWeight: 600 }}>
            {status === "installing" ? "Installing..." : `${progress}%`}
          </Typography>
        </>
      ) : status === "downloaded" ? (
        <Typography variant="caption" sx={{ color: "inherit", fontSize: 11, fontWeight: 600 }}>
          Install Update
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ color: "inherit", fontSize: 11, fontWeight: 600 }}>
          Update failed
        </Typography>
      )}
    </Box>
  );
}
