import * as React from "react";
import { Box, ButtonBase, CircularProgress, Typography } from "@mui/material";
import { MessageSquare, Search, SquarePen } from "lucide-react";
import { isAfter, isToday, isYesterday, subDays } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getRepository } from "@/lib/repositories";
import type { Conversation, Message } from "@/types/chat";
import { filterSearchConversations } from "./conversation-search";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onNewChat: () => void;
  onOpenConversation: (id: string) => void;
};

export function ConversationSearchModal({
  open,
  onOpenChange,
  conversations,
  onNewChat,
  onOpenConversation,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<Message[]>([]);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const filtered = React.useMemo(() => filterSearchConversations(conversations, query), [conversations, query]);
  const groups = React.useMemo(() => groupConversations(filtered), [filtered]);
  const selected = React.useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(null);
    setPreview([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setPreviewLoading(true);
      void getRepository().getMessages(selectedId, 20, 0).then((messages) => {
        if (!cancelled) setPreview(messages);
      }).catch(() => {
        if (!cancelled) setPreview([]);
      }).finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [selectedId]);

  const openConversation = React.useCallback((id: string) => {
    onOpenConversation(id);
    onOpenChange(false);
  }, [onOpenChange, onOpenConversation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        sx={{
          width: "min(1120px, calc(100vw - 40px))",
          height: "min(710px, calc(100dvh - var(--titlebar-height) - 48px))",
          borderRadius: "30px",
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2.5, height: 54, borderBottom: "1px solid", borderColor: "divider" }}>
          <Search size={17} />
          <Box
            ref={inputRef}
            component="input"
            aria-label="Search conversations"
            placeholder="Search"
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter" && selectedId) openConversation(selectedId);
            }}
            sx={{ flex: 1, border: 0, outline: 0, bgcolor: "transparent", color: "text.primary", fontSize: 14 }}
          />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(280px, 36%) 1fr", flex: 1, minHeight: 0 }}>
          <Box sx={{ overflowY: "auto", borderRight: "1px solid", borderColor: "divider", px: 1.5, py: 1.25 }}>
            <Typography sx={{ px: 1.25, py: 0.75, color: "text.secondary", fontSize: 12 }}>Actions</Typography>
            <ResultRow icon={<SquarePen size={16} />} label="Start a new conversation" onClick={() => { onNewChat(); onOpenChange(false); }} />
            {groups.map((group) => (
              <Box key={group.label} sx={{ mt: 1.25, pt: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
                <Typography sx={{ px: 1.25, pb: 0.75, color: "text.secondary", fontSize: 12 }}>{group.label}</Typography>
                {group.items.map((conversation) => (
                  <ResultRow
                    key={conversation.id}
                    icon={<MessageSquare size={15} />}
                    label={conversation.title}
                    active={selectedId === conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    onDoubleClick={() => openConversation(conversation.id)}
                  />
                ))}
              </Box>
            ))}
          </Box>

          <Box sx={{ overflowY: "auto", px: 4, py: 3 }}>
            {!selected ? (
              <CenterText>Select a conversation to preview</CenterText>
            ) : previewLoading ? (
              <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}><CircularProgress size={20} /></Box>
            ) : (
              <>
                <Typography sx={{ color: "text.secondary", fontSize: 12, mb: 2 }}>{selected.title}</Typography>
                {preview.length ? preview.map((message) => (
                  <Box key={message.id} sx={{ mb: 2.5, maxWidth: 720 }}>
                    <Typography sx={{ color: "text.secondary", fontSize: 11, mb: 0.5, textTransform: "capitalize" }}>{message.role}</Typography>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{message.content}</Typography>
                  </Box>
                )) : <CenterText>No messages</CenterText>}
              </>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({ icon, label, active, onClick, onDoubleClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; onDoubleClick?: () => void }) {
  return (
    <ButtonBase onClick={onClick} onDoubleClick={onDoubleClick} sx={{ width: "100%", justifyContent: "flex-start", gap: 1.25, px: 1.25, py: 1, borderRadius: "9999px", bgcolor: active ? "action.selected" : "transparent", color: "text.primary", "&:hover": { bgcolor: "action.hover" } }}>
      {icon}<Typography noWrap sx={{ fontSize: 14 }}>{label}</Typography>
    </ButtonBase>
  );
}

function CenterText({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "grid", placeItems: "center", height: "100%", color: "text.secondary" }}><Typography sx={{ fontSize: 14 }}>{children}</Typography></Box>;
}

function groupConversations(conversations: Conversation[]) {
  const sevenDaysAgo = subDays(new Date(), 7);
  const groups = [
    { label: "Today", items: [] as Conversation[] },
    { label: "Yesterday", items: [] as Conversation[] },
    { label: "Previous 7 Days", items: [] as Conversation[] },
    { label: "Older", items: [] as Conversation[] },
  ];
  conversations.forEach((conversation) => {
    const date = new Date(conversation.updatedAt || conversation.createdAt);
    const index = isToday(date) ? 0 : isYesterday(date) ? 1 : isAfter(date, sevenDaysAgo) ? 2 : 3;
    groups[index].items.push(conversation);
  });
  return groups.filter((group) => group.items.length);
}
