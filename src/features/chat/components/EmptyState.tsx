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
  selectedModels: _selectedModels,
  userName,
  isTemporary: _isTemporary,
  providerOnline: _providerOnline,
  onOpenConnections: _onOpenConnections,
}: EmptyStateProps) {
  return (
    <Box className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
      <Box className="flex w-full max-w-3xl flex-col items-center gap-6">
        <Typography
          as="h1"
          variant="h3"
          align="center"
          className="text-2xl font-medium tracking-normal text-foreground"
        >
          Hello, {userName || "Theo Slater"}
        </Typography>

        <Box className="w-full">
        {children}
        </Box>
      </Box>
    </Box>
  );
}
