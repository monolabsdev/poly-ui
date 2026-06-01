import { imageUploadConfig } from "./config";
import type { ImageValidationError } from "./types";

type ValidationOptions = {
  allowedMimeTypes?: readonly string[];
  maxFileSize?: number;
  maxFiles?: number;
};

const extensions: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
};

export function validateImageFiles(files: File[], options: ValidationOptions = {}) {
  const allowed = options.allowedMimeTypes ?? imageUploadConfig.allowedMimeTypes;
  const maxFileSize = options.maxFileSize ?? imageUploadConfig.maxFileSize;
  const maxFiles = options.maxFiles ?? imageUploadConfig.maxFiles;
  const accepted: File[] = [];
  const errors: ImageValidationError[] = [];

  for (const [index, file] of files.entries()) {
    if (index >= maxFiles) {
      errors.push({ code: "too-many-files", fileName: file.name, message: `Maximum ${maxFiles} images per message.` });
      continue;
    }
    if (!allowed.includes(file.type)) {
      errors.push({ code: "unsupported-type", fileName: file.name, message: `${file.name}: unsupported image type.` });
      continue;
    }
    if (!extensions[file.type]?.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      errors.push({ code: "invalid-extension", fileName: file.name, message: `${file.name}: extension does not match image type.` });
      continue;
    }
    if (file.size > maxFileSize) {
      errors.push({ code: "file-too-large", fileName: file.name, message: `${file.name}: image exceeds ${Math.round(maxFileSize / 1024 / 1024)} MB limit.` });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, errors };
}

