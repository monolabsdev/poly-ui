import { Box } from "@/components/ui/Box";

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="code"
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
    >
      <Box as="span">
        +{additions}
      </Box>
      <Box as="span">
        -{deletions}
      </Box>
    </Box>
  );
}
