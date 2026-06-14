import { useCallback, useEffect, useRef, useState } from "react";

type UseFileDragDetectionOptions = {
  onFilesDropped?: (files: File[]) => void;
  enabled?: boolean;
  debug?: boolean;
};

function hasFileDrag(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types ?? []).includes("Files");
}

function filesFromTransfer(dataTransfer: DataTransfer | null) {
  if (!dataTransfer?.files?.length) return [];
  return Array.from(dataTransfer.files);
}

export function useFileDragDetection({
  onFilesDropped,
  enabled = true,
  debug = false,
}: UseFileDragDetectionOptions = {}) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const onFilesDroppedRef = useRef(onFilesDropped);

  useEffect(() => {
    onFilesDroppedRef.current = onFilesDropped;
  }, [onFilesDropped]);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") return;

    const logDragEvent = (name: string, event?: DragEvent) => {
      if (!debug) return;
      console.log(`[file-drag] ${name}`, {
        depth: dragDepthRef.current,
        files: event?.dataTransfer?.files?.length ?? 0,
        types: Array.from(event?.dataTransfer?.types ?? []),
      });
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
      logDragEvent("dragenter", event);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setIsDraggingFiles(true);
      logDragEvent("dragover", event);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

      const leftWindow =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight;

      if (dragDepthRef.current === 0 || leftWindow) {
        resetDragState();
      }
      logDragEvent("dragleave", event);
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      const files = filesFromTransfer(event.dataTransfer);
      resetDragState();
      logDragEvent("drop", event);
      if (files.length > 0) onFilesDroppedRef.current?.(files);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") resetDragState();
    };

    document.addEventListener("dragenter", handleDragEnter, true);
    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("dragleave", handleDragLeave, true);
    document.addEventListener("drop", handleDrop, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("dragend", resetDragState, true);
    window.addEventListener("blur", resetDragState, true);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter, true);
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("dragleave", handleDragLeave, true);
      document.removeEventListener("drop", handleDrop, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("dragend", resetDragState, true);
      window.removeEventListener("blur", resetDragState, true);
    };
  }, [debug, enabled, resetDragState]);

  return {
    isDraggingFiles,
    resetDragState,
  };
}
