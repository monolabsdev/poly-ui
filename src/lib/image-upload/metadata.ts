export async function readImageDimensions(file: File, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if ("createImageBitmap" in globalThis) {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    signal?.addEventListener("abort", () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
    image.onload = () => { cleanup(); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { cleanup(); reject(new Error("Image decode failed")); };
    image.src = url;
  });
}

