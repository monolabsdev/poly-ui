import { useSidebar } from "@/components/ui/sidebar";

export function ConversationSkeleton() {
  const { state } = useSidebar();
  if (state === "collapsed") return null;
  return (
    <div className="px-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="mb-1 h-9 animate-pulse rounded-[var(--radius)] bg-accent"
        />
      ))}
    </div>
  );
}
