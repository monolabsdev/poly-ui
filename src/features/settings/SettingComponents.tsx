import type React from "react";
import { Box } from "@/components/ui/Box";
import { Stack } from "@/components/ui/Stack";
import { Typography } from "@/components/ui/Typography";
import { cn } from "@/lib/utils";

export const settingSurfaceClassName = "rounded-xl border border-border/60 bg-transparent p-4";

export function SettingSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <Box className={cn(settingSurfaceClassName, className)}>{children}</Box>;
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
    <Box className={settingSurfaceClassName}>
      <Stack spacing={children ? 2 : 0}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={3}>
          <Box className="min-w-0">
            <Typography className="text-[13px] font-medium">
              {title}
            </Typography>
            {description && (
              <Typography color="muted" className="mt-0.5 text-xs leading-normal">
                {description}
              </Typography>
            )}
          </Box>
          {action && <Box className="shrink-0">{action}</Box>}
        </Stack>
        {children && <Box>{children}</Box>}
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
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Box className="min-w-0">
        <Typography className="text-sm font-bold">
          {title}
        </Typography>
        {description && (
          <Typography color="muted" className="mt-0.5 text-xs leading-normal">
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Stack>
  );
}

export function Badge({ label, color: _color }: { label: string; color: string }) {
  return (
    <Box
      className="inline-flex rounded-full bg-muted px-2 py-0.5"
    >
      <Typography className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </Typography>
    </Box>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Box className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
      <Typography color="muted">{children}</Typography>
    </Box>
  );
}

export const selectClassName = "border-0 bg-transparent text-[13px] font-medium text-muted-foreground hover:text-foreground";
