import { Box } from "@/components/ui/Box";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DeleteConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  count?: number;
}

export function DeleteConversationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  count,
}: DeleteConversationDialogProps) {
  const description = count ? (
    <>This will delete <Box as="span">{count} chats</Box>. This action cannot be undone.</>
  ) : (
    <>This will delete <Box as="span">{title}</Box>. This action cannot be undone.</>
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={count ? "Delete chats?" : "Delete chat?"}
      description={description}
      confirmLabel="Delete"
      onConfirm={onConfirm}
      destructive
    />
  );
}
