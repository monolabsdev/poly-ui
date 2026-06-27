import { Search } from "lucide-react";
import { SidebarActionButton } from "@/features/sidebar/components/SidebarPrimitives";
import { IS_MAC } from "@/lib/utils/platform";

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <SidebarActionButton
      icon={<Search />}
      onClick={onClick}
      shortcut={IS_MAC ? "Cmd+K" : "Ctrl+K"}
    >
      Search
    </SidebarActionButton>
  );
}
