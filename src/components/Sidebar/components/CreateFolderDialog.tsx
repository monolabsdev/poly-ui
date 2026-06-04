import { CreateFolderModal } from "@/components/Folders/CreateFolderModal";
import { useFolderStore } from "@/store/folderStore";
import { useNotify } from "@/hooks/useNotify";
import { UseFolderActions } from "@/components/Sidebar/hooks/useFolderActions";

export function CreateFolderDialog({ folder }: { folder: UseFolderActions }) {
  const notify = useNotify();
  const createFolder = useFolderStore((s) => s.actions.createFolder);
  const updateFolder = useFolderStore((s) => s.actions.updateFolder);

  return (
    <CreateFolderModal
      open={folder.isFolderModalOpen}
      onOpenChange={folder.closeModal}
      onSave={async (data) => {
        const sharedOptions = {
          parentId: folder.folderParentId,
          backgroundImage: data.backgroundImage,
          systemPrompt: data.systemPrompt,
          contextFiles: data.contextFiles,
        };
        try {
          if (folder.editingFolder) {
            await updateFolder(folder.editingFolder.id, {
              name: data.name,
              ...sharedOptions,
            });
          } else {
            await createFolder(data.name, sharedOptions);
          }
        } catch (error) {
          notify.error(
            "Failed to save folder",
            error instanceof Error ? error.message : String(error),
          );
        }
      }}
      initialData={
        folder.editingFolder
          ? {
              name: folder.editingFolder.name,
              backgroundImage: folder.editingFolder.backgroundImage,
              systemPrompt: folder.editingFolder.systemPrompt,
              contextFiles: folder.editingFolder.contextFiles,
            }
          : undefined
      }
    />
  );
}
