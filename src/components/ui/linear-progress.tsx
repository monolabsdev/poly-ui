import { Progress } from "@/components/ui/progress";

export function LinearProgress({
  value,
  className,
}: {
  value?: number;
  variant?: "determinate" | "indeterminate";
  className?: string;
}) {
  return <Progress value={value ?? 0} className={className} />;
}
