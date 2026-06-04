import type { Folder } from "@/types/chat";

export function collectDescendantFolderIds(
  folders: Folder[],
  rootId: string,
): Set<string> {
  const descendantIds = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const parentId = stack.pop();
    if (!parentId) break;
    for (const folder of folders) {
      if (folder.parentId === parentId && !descendantIds.has(folder.id)) {
        descendantIds.add(folder.id);
        stack.push(folder.id);
      }
    }
  }
  return descendantIds;
}
