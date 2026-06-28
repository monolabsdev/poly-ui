import Box from "@mui/material/Box";
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
    <>This will delete <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{count} chats</Box>. This action cannot be undone.</>
  ) : (
    <>This will delete <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{title}</Box>. This action cannot be undone.</>
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
