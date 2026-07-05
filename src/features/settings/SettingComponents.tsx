import type React from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  SettingRow,
  SettingsSection,
} from "./SettingsShell";

export const settingSurfaceClassName = "rounded-xl border border-border/60 bg-background/50 p-4";

export function SettingSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${settingSurfaceClassName} ${className ?? ""}`}>{children}</div>;
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
    <SettingRow title={title} description={description} action={action}>
      {children}
    </SettingRow>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <SettingsSection title={title} description={description} action={action} />
    </div>
  );
}

export function Badge({ label }: { label: string; color?: string }) {
  return <ShadcnBadge variant="secondary">{label}</ShadcnBadge>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Empty className="rounded-xl border border-dashed border-border/60 p-6">
      <EmptyDescription>{children}</EmptyDescription>
    </Empty>
  );
}

export const selectClassName = "min-w-36";
