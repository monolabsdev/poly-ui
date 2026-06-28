import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SxProps } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { appPanelSx } from "@/components/ui/appDialog";

const settingTextSx = {
  title: { fontSize: 13, fontWeight: 500, color: "text.primary" },
  description: { mt: 0.25, fontSize: 12, color: "text.secondary", lineHeight: 1.5 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "text.primary" },
} as const;

export const settingSurfaceSx: SxProps<Theme> = (theme) => ({
  p: 1.5,
  borderRadius: theme.app.radius.control,
  border: "1px solid",
  borderColor: "divider",
});

function sxArray(sx?: SxProps<Theme>) {
  return Array.isArray(sx) ? sx : sx ? [sx] : [];
}

export function SettingSurface({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  return <Box sx={[settingSurfaceSx, ...sxArray(sx)]}>{children}</Box>;
}

export function SettingCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Stack spacing={children ? 1.5 : 0}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ minWidth: 0 }}>
          <Box sx={{ minWidth: 0, overflow: "hidden" }}>
            <Typography sx={settingTextSx.title}>
              {title}
            </Typography>
            {description && (
              <Typography sx={settingTextSx.description}>
                {description}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 0.5, mt: 2.5, minWidth: 0 }}>
      <Box sx={{ minWidth: 0, overflow: "hidden" }}>
        <Typography sx={settingTextSx.sectionTitle}>
          {title}
        </Typography>
        {description && (
          <Typography sx={settingTextSx.description}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        px: 0.85,
        py: 0.2,
        borderRadius: "999px",
        bgcolor: `${color}1f`,
        border: "1px solid",
        borderColor: `${color}52`,
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 900, color, textTransform: "uppercase" }}>
        {label}
      </Typography>
    </Box>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={[appPanelSx, { py: 5, textAlign: "center" }]}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{children}</Typography>
    </Box>
  );
}

export const selectSx = {
  fontSize: 13,
  fontWeight: 500,
  bgcolor: "transparent",
  color: "text.secondary",
  "& .MuiSelect-select": {
    pr: "32px !important",
    pb: 0.5,
    pt: 0.5,
  },
  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
  "&:hover .MuiOutlinedInput-notchedOutline": { border: "none" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "none" },
  "&:hover": { color: "text.primary" },
} as const;
