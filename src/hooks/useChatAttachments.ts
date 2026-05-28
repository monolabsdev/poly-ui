import { useRef, useState, useCallback } from "react";
import { useChatStore } from "@/store/chatStore";
import { Attachment } from "@/types/chat";
import { isImageAttachment } from "@/lib/utils";

export function useChatAttachments() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileAccept, setFileAccept] = useState<string>("*");
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const currentAttachments = useChatStore((state) => state.currentAttachments);
  const addCurrentAttachment = useChatStore((state) => state.actions.addCurrentAttachment);
  const removeCurrentAttachment = useChatStore((state) => state.actions.removeCurrentAttachment);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const attachment: Attachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
        };

        const isImage = isImageAttachment(file.type);
        reader.onload = (e) => {
          const result = e.target?.result as string;
          attachment.content = isImage ? result.split(",")[1] : result;
          addCurrentAttachment(attachment);
        };

        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      }
    },
    [addCurrentAttachment],
  );

  const openFilePicker = (accept: string) => {
    setFileAccept(accept);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  return {
    fileInputRef,
    fileAccept,
    isDragging,
    currentAttachments,
    removeCurrentAttachment,
    openFilePicker,
    handleFileChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
