import { SquarePen } from "lucide-react";
import { SidebarActionButton } from "@/features/sidebar/components/SidebarPrimitives";

export function NewChatButton({ onClick }: { onClick: () => void }) {
  return (
    <SidebarActionButton
      icon={<SquarePen />}
      onClick={onClick}
    >
      New Chat
    </SidebarActionButton>
  );
}
