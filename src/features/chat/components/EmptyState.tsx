import { useSettingsStore } from "@/store/settingsStore";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";

interface EmptyStateProps {
  children?: React.ReactNode;
  selectedModels: string[];
  userName?: string;
  isTemporary?: boolean;
  providerOnline: boolean;
  onOpenConnections: () => void;
}

export function EmptyState({
  children,
  selectedModels,
  userName,
  isTemporary: _isTemporary,
  providerOnline: _providerOnline,
  onOpenConnections: _onOpenConnections,
}: EmptyStateProps) {
  const showModelInEmptyState = useSettingsStore((s) => s.general.showModelInEmptyState);

  const heading = showModelInEmptyState && selectedModels.length > 0
    ? selectedModels.join(", ")
    : `Hello, ${userName || "Theo Slater"}`;

  return (
    <Box className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
      <Box className="flex w-full max-w-3xl flex-col items-center gap-6">
        <Typography
          as="h1"
          variant="h3"
          align="center"
          className="text-2xl font-medium tracking-normal text-foreground"
        >
          {heading}
        </Typography>

        <Box className="w-full">
        {children}
        </Box>
      </Box>
    </Box>
  );
}
