import { Brain, Trash2, Search } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/useNotify";
import {
  forgetMessageMemory,
  rememberMessageMemory,
} from "@/features/memory/messageMemoryActions";
import { openMemoryPanel } from "@/features/memory/MemoryPanel";

interface MemoryMenuItemsProps {
  messageId?: string;
  conversationId?: string;
  content: string;
}

export function MemoryMenuItems({ messageId, conversationId, content }: MemoryMenuItemsProps) {
  const notify = useNotify();

  const handleRemember = async () => {
    try {
      notify.success(await rememberMessageMemory({ messageId, conversationId, content }));
    } catch (error) {
      notify.error("Memory save failed", String(error));
    }
  };

  const handleForget = async () => {
    try {
      notify.success(await forgetMessageMemory({ messageId, content }));
    } catch (error) {
      notify.error("Memory delete failed", String(error));
    }
  };

  return (
    <>
      <DropdownMenuItem onClick={handleRemember}>
        <Brain size={14} />
        Remember this
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleForget}>
        <Trash2 size={14} />
        Forget this
      </DropdownMenuItem>
      <DropdownMenuItem onClick={openMemoryPanel}>
        <Search size={14} />
        View related memories
      </DropdownMenuItem>
    </>
  );
}
