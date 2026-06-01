type OptimizeRequest = { id: string; file: File; maxDimension: number; quality: number };

self.onmessage = async ({ data }: MessageEvent<OptimizeRequest>) => {
  try {
    const bitmap = await createImageBitmap(data.file);
    const scale = Math.min(1, data.maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      self.postMessage({ id: data.id, file: data.file });
      return;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: data.quality });
    const file = blob.size < data.file.size * 0.9
      ? new File([blob], data.file.name.replace(/\.[^.]+$/, ".webp"), { type: blob.type, lastModified: data.file.lastModified })
      : data.file;
    self.postMessage({ id: data.id, file });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : "Image optimization failed" });
  }
};
