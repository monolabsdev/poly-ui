import { create } from "zustand";
import { getRepository } from "@/lib/repositories";
import { Folder, Attachment } from "@/types/chat";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";

async function getRepo() {
  return getRepository();
}

type FolderStore = {
  folders: Folder[];
  foldersLoading: boolean;
  activeFolderId: string | null;
  actions: {
    loadFolders: () => Promise<void>;
    createFolder: (name: string, opts?: { parentId?: string; backgroundImage?: string; systemPrompt?: string; contextFiles?: Attachment[] }) => Promise<Folder>;
    updateFolder: (id: string, updates: { name?: string; parentId?: string; backgroundImage?: string; systemPrompt?: string; contextFiles?: Attachment[] }) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    setActiveFolderId: (id: string | null) => void;
  };
};

export const useFolderStore = create<FolderStore>((set) => ({
  folders: [],
  foldersLoading: false,
  activeFolderId: null,
  actions: {
    loadFolders: async () => {
      set({ foldersLoading: true });
      try {
        const r = await getRepo();
        const auth = useAuthStore.getState();
        const userId = auth.user?.id || auth.guestId || undefined;
        const folders = await r.getFolders(userId);
        set({ folders, foldersLoading: false });
      } catch {
        set({ foldersLoading: false });
      }
    },
    createFolder: async (name, opts = {}) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const folder: Folder = {
        id,
        name,
        parentId: opts.parentId,
        backgroundImage: opts.backgroundImage,
        systemPrompt: opts.systemPrompt,
        contextFiles: opts.contextFiles,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        folders: [...state.folders, folder],
      }));
      try {
        const r = await getRepo();
        const auth = useAuthStore.getState();
        const userId = auth.user?.id || auth.guestId || undefined;
        await r.createFolder(id, name, userId, opts.parentId);
        if (opts.backgroundImage || opts.systemPrompt || opts.contextFiles) {
          await r.updateFolder(id, {
            backgroundImage: opts.backgroundImage ?? null,
            systemPrompt: opts.systemPrompt ?? null,
            contextFiles: opts.contextFiles ? JSON.stringify(opts.contextFiles) : null,
            updatedAt: now,
          });
        }
      } catch (error) {
        console.error("Failed to persist folder:", error);
        set((state) => ({
          folders: state.folders.filter((candidate) => candidate.id !== id),
        }));
        throw error;
      }
      return folder;
    },
    updateFolder: async (id, updates) => {
      const now = new Date().toISOString();
      set((state) => ({
        folders: state.folders.map((f) =>
          f.id === id
            ? { ...f, ...updates, updatedAt: now }
            : f,
        ),
      }));
      try {
        const r = await getRepo();
        await r.updateFolder(id, {
          name: updates.name,
          parentId: updates.parentId,
          backgroundImage: updates.backgroundImage !== undefined ? (updates.backgroundImage ?? null) : undefined,
          systemPrompt: updates.systemPrompt !== undefined ? (updates.systemPrompt ?? null) : undefined,
          contextFiles: updates.contextFiles !== undefined ? JSON.stringify(updates.contextFiles) : undefined,
          updatedAt: now,
        });
      } catch (error) {
        console.error("Failed to update folder:", error);
      }
    },
    deleteFolder: async (id) => {
      const state = useFolderStore.getState();
      const descendantIds = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        state.folders.forEach((folder) => {
          if (folder.parentId && descendantIds.has(folder.parentId) && !descendantIds.has(folder.id)) {
            descendantIds.add(folder.id);
            changed = true;
          }
        });
      }
      const chats = useChatStore.getState().conversations.filter((chat) => chat.folderId && descendantIds.has(chat.folderId));
      set((state) => ({
        folders: state.folders.filter((f) => !descendantIds.has(f.id)),
        activeFolderId: state.activeFolderId && descendantIds.has(state.activeFolderId) ? null : state.activeFolderId,
      }));
      try {
        const r = await getRepo();
        await Promise.all(chats.map((chat) => r.updateConversation(chat.id, { folderId: null })));
        await Promise.all([...descendantIds].map((folderId) => r.deleteFolder(folderId)));
        useChatStore.setState((state) => ({
          conversations: state.conversations.map((chat) => chat.folderId && descendantIds.has(chat.folderId) ? { ...chat, folderId: undefined } : chat),
        }));
      } catch (error) {
        console.error("Failed to delete folder:", error);
      }
    },
    setActiveFolderId: (id) => set({ activeFolderId: id }),
  },
}));
