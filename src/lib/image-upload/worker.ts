import { imageUploadConfig } from "./config";

type OptimizeOptions = {
  maxDimension?: number;
  quality?: number;
  optimizeAboveBytes?: number;
};

export async function optimizeImage(file: File, options: OptimizeOptions = {}) {
  const threshold = options.optimizeAboveBytes ?? imageUploadConfig.optimizeAboveBytes;
  if (file.size < threshold || !("Worker" in globalThis) || !("OffscreenCanvas" in globalThis)) return file;
  const worker = new Worker(new URL("./image-processing.worker.ts", import.meta.url), { type: "module" });
  const id = crypto.randomUUID();
  return new Promise<File>((resolve) => {
    worker.onmessage = ({ data }: MessageEvent<{ id: string; file?: File; error?: string }>) => {
      if (data.id !== id) return;
      worker.terminate();
      resolve(data.file ?? file);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(file);
    };
    worker.postMessage({
      id,
      file,
      maxDimension: options.maxDimension ?? imageUploadConfig.outputMaxDimension,
      quality: options.quality ?? imageUploadConfig.outputQuality,
    });
  });
}
