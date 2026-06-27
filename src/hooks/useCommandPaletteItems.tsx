import { useMemo } from "react";
import {
  Archive,
  Download,
  FileInput,
  MessageSquare,
  Settings,
  SquarePen,
  Trash2,
} from "lucide-react";
import { IS_MAC } from "@/lib/utils/platform";
import type { FeatureDef } from "@/lib/featureRegistry";
import type { CommandPaletteItem } from "@/features/command-palette/types";
import type { Conversation } from "@/types/chat";
import {
  exportConversation,
  importConversations,
  type NotifyApi,
} from "@/features/command-palette/chatDataActions";

type EnrichedFeature = FeatureDef & { active: boolean; warning?: string };

export function useCommandPaletteItems({
  conversations,
  activeConversationId,
  features,
  onNewChat,
  onDeleteAllConversations,
  onOpenSettings,
  onRenameCurrentChat,
  onSetTheme,
  onSelectConversation,
  onOpenArchived,
  notify,
  registeredActions,
  settingsCommands,
}: {
  conversations: readonly {
    id: string;
    title?: string;
    isArchived?: boolean;
    updatedAt?: string;
    createdAt: string;
    isTemporary?: boolean;
  }[];
  activeConversationId: string | null;
  features: EnrichedFeature[];
  onNewChat: () => void;
  onDeleteAllConversations: (opts?: { confirmed?: boolean }) => void | Promise<void>;
  onOpenSettings: (tab?: string) => void;
  onRenameCurrentChat: (args: { title: string }) => void | Promise<void>;
  onSetTheme: (args: { theme: string }) => void;
  onSelectConversation: (id: string) => void;
  onOpenArchived: () => void;
  notify: NotifyApi;
  registeredActions: CommandPaletteItem[];
  settingsCommands: CommandPaletteItem[];
}): CommandPaletteItem[] {
  return useMemo(() => {
    const activeConversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    const sortedConversations = [...conversations].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );

    const conversationItems: CommandPaletteItem[] = sortedConversations.map(
      (conversation, index) => ({
        id: `conversation:${conversation.id}`,
        title: conversation.title || "Untitled",
        description: conversation.isArchived
          ? "Archived conversation"
          : index < 10
            ? "Recent conversation"
            : "Conversation",
        category: "conversation" as const,
        keywords: [
          "chat",
          "conversation",
          conversation.isArchived ? "archived" : "recent",
        ],
        icon: <MessageSquare size={16} />,
        execute: () => onSelectConversation(conversation.id),
      }),
    );

    const coreActions: CommandPaletteItem[] = [
      {
        id: "action:new-conversation",
        title: "New Conversation",
        description: "Start a blank chat",
        category: "action",
        keywords: ["new", "chat", "compose"],
        icon: <SquarePen size={16} />,
        shortcut: IS_MAC ? "Cmd N" : "Ctrl N",
        execute: onNewChat,
        smartCommand: { command: "new-chat" },
      },
      {
        id: "action:open-settings",
        title: "Open Settings",
        description: "Open Poly UI settings",
        category: "action",
        keywords: ["settings", "preferences", "sett"],
        icon: <Settings size={16} />,
        shortcut: IS_MAC ? "Cmd ," : "Ctrl ,",
        execute: () => onOpenSettings("general"),
        smartCommand: { command: "open-settings" },
      },
      {
        id: "action:delete-all-chats",
        title: "Delete All Chats",
        description: "Permanently remove every chat",
        category: "action",
        keywords: [
          "delete",
          "remove",
          "clear",
          "all",
          "chats",
          "conversations",
        ],
        icon: <Trash2 size={16} />,
        execute: () => void onDeleteAllConversations(),
        smartCommand: {
          command: "delete-all-chats",
          execute: () => onDeleteAllConversations({ confirmed: true }),
        },
      },
      {
        id: "action:archived-conversations",
        title: "Archived Conversations",
        description: "View archived chats",
        category: "action",
        keywords: ["archive", "archived", "old chats"],
        icon: <Archive size={16} />,
        execute: onOpenArchived,
      },
      {
        id: "action:import-chat",
        title: "Import Chat",
        description: "Import a Poly UI chat JSON file",
        category: "action",
        keywords: ["import", "restore", "json"],
        icon: <FileInput size={16} />,
        execute: () => void importConversations(notify),
      },
      {
        id: "action:export-current-chat",
        title: "Export Current Chat",
        description: activeConversation
          ? `Export ${activeConversation.title || "Untitled"}`
          : "No active chat selected",
        category: "action",
        keywords: ["export", "download", "backup", "json"],
        icon: <Download size={16} />,
        execute: () => {
          if (activeConversation)
            void exportConversation(activeConversation as Conversation, notify);
        },
      },
      {
        id: "action:rename-current-chat",
        title: "Rename Current Chat",
        description: activeConversation
          ? `Rename ${activeConversation.title || "Untitled"}`
          : "No active chat selected",
        category: "action",
        keywords: ["rename", "name", "title", "chat", "conversation"],
        icon: <MessageSquare size={16} />,
        execute: () => undefined,
        smartCommand: {
          command: "rename-chat",
          execute: (args) => onRenameCurrentChat(args as { title: string }),
        },
      },
      {
        id: "action:set-theme",
        title: "Set Theme",
        description: "Set appearance to light, dark, or system",
        category: "action",
        keywords: ["theme", "appearance", "light", "dark", "system"],
        icon: <Settings size={16} />,
        execute: () => undefined,
        smartCommand: {
          command: "set-theme",
          execute: (args) => onSetTheme(args as { theme: string }),
        },
      },
    ];

    const featureItems: CommandPaletteItem[] = features.map((feature) => {
      const Icon = feature.icon;
      const active = feature.active;
      const title =
        feature.id === "poly-agent"
          ? "Experimental Agent Mode"
          : feature.name;
      return {
        id: `feature:${feature.id}`,
        title: `${active ? "\u2713" : "\u2715"} ${title}`,
        description: feature.warning
          ? `${feature.description ?? "Feature toggle"} - ${feature.warning}`
          : feature.description,
        category: "feature",
        keywords: [
          feature.id,
          feature.name,
          title,
          feature.experimental ? "experimental" : "",
          "toggle",
          active ? "enabled" : "disabled",
        ],
        icon: <Icon size={16} />,
        execute: feature.toggle,
      };
    });

    return [
      ...conversationItems,
      ...coreActions,
      ...registeredActions,
      ...featureItems,
      ...settingsCommands,
    ];
  }, [
    activeConversationId,
    conversations,
    features,
    onNewChat,
    onDeleteAllConversations,
    onOpenSettings,
    onRenameCurrentChat,
    onSetTheme,
    onSelectConversation,
    onOpenArchived,
    notify,
    registeredActions,
    settingsCommands,
  ]);
}
