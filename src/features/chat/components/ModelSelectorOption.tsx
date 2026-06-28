import type { CSSProperties, ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Check, Cpu, Eye, Link2 } from "lucide-react";
import type { OllamaModel } from "@/features/ollama";

export function ModelSelectorStatus({
  icon,
  text,
}: {
  icon?: ReactNode;
  text: string;
}) {
  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 2,
        color: "text.secondary",
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 13 }}>{text}</Typography>
    </Box>
  );
}

export function ModelSelectorOption({
  option,
  selected,
  highlighted,
  externalApiUrl,
  onHover,
  onSelect,
  style,
}: {
  option: OllamaModel;
  selected: boolean;
  highlighted: boolean;
  externalApiUrl: string;
  onHover: () => void;
  onSelect: () => void;
  style: CSSProperties;
}) {
  const external = option.provider_type === "OpenAICompatible";

  return (
    <ButtonBase
      component="div"
      role="option"
      disableRipple
      aria-selected={selected}
      onClick={onSelect}
      onMouseEnter={onHover}
      style={style}
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        px: 1.5,
        textAlign: "left",
        bgcolor: highlighted ? "action.hover" : "transparent",
        borderRadius: 0,

      }}
    >
      <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
        <Cpu size={15} />
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
          {option.name}
        </Typography>
        {external ? (
          <Tooltip title={`External API: ${externalApiUrl}`} arrow>
            <Box component="span" sx={{ display: "flex", color: "text.secondary" }}>
              <Link2 size={13} />
            </Box>
          </Tooltip>
        ) : option.supports_vision ? (
          <Tooltip title="Supports vision" arrow>
            <Box component="span" sx={{ display: "flex", color: "text.secondary" }}>
              <Eye size={13} />
            </Box>
          </Tooltip>
        ) : null}
      </Box>
      {selected ? <Check size={15} /> : null}
    </ButtonBase>
  );
}

const SKELETON_ROW_HEIGHT = 40;

export function ModelSelectorSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Stack role="status" aria-label="Loading models" spacing={0} sx={{ pb: 0.75 }}>
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={index}
          sx={{ height: SKELETON_ROW_HEIGHT, display: "flex", alignItems: "center", gap: 1, px: 1.5 }}
        >
          <Skeleton variant="circular" width={15} height={15} />
          <Skeleton variant="rounded" width={`${48 + (index % 3) * 12}%`} height={14} />
        </Box>
      ))}
    </Stack>
  );
}

