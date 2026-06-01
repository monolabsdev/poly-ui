export type ImageUploadStatus = "previewing" | "ready" | "processing" | "error";

export type ImageValidationErrorCode =
  | "unsupported-type"
  | "invalid-extension"
  | "file-too-large"
  | "too-many-files"
  | "dimensions-too-large"
  | "corrupt-image";

export interface ImageValidationError {
  code: ImageValidationErrorCode;
  fileName: string;
  message: string;
}

