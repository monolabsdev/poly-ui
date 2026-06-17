import * as React from "react";
import { isToday, isYesterday, subDays, isAfter } from "date-fns";
import { Conversation } from "@/types/chat";

export interface ConversationGroup {
  id: string;
  label: string;
  items: Conversation[];
}

export function useConversationGroups(
  conversations: Conversation[],
): ConversationGroup[] {
  return React.useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    const filtered = conversations.filter(
      (c) => !c.isArchived && !c.isTemporary && !c.folderId,
    );

    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const last7Days: Conversation[] = [];
    const older: Conversation[] = [];

    filtered.forEach((conv) => {
      const date = new Date(conv.updatedAt || conv.createdAt);
      if (isToday(date)) {
        today.push(conv);
      } else if (isYesterday(date)) {
        yesterday.push(conv);
      } else if (isAfter(date, sevenDaysAgo)) {
        last7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    return [
      { id: "today", label: "Today", items: today },
      { id: "yesterday", label: "Yesterday", items: yesterday },
      { id: "last7days", label: "Previous 7 Days", items: last7Days },
      { id: "older", label: "Older", items: older },
    ].filter((group) => group.items.length > 0);
  }, [conversations]);
}
