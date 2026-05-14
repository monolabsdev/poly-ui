import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { invoke } from "@tauri-apps/api/core";

type InvokeArgs = Record<string, unknown>;

function estimateJsonBytes(_args: InvokeArgs): number {
  return 0;
}

function perfLog(..._args: unknown[]): void {}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function loggedInvoke<T>(cmd: string, args: InvokeArgs = {}): Promise<T> {
  const startTime = Date.now();
  const payloadBytes = estimateJsonBytes(args);

  try {
    const result = await invoke<T>(cmd, args);
    const responseBytes = estimateJsonBytes(result as InvokeArgs ?? {});
    const totalTime = Date.now() - startTime;
    perfLog("tauri-invoke", cmd, { status: 200, payloadBytes, responseBytes }, totalTime);
    return result;
  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
    perfLog("tauri-invoke", cmd, { status: 500, payloadBytes, error: errorMessage }, totalTime);
    throw error;
  }
}

export function isImageAttachment(type: string): boolean {
  return type.startsWith("image/");
}

export function createDataUrl(type: string, content: string): string {
  return `data:${type};base64,${content}`;
}

export function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (bytes < 1024) return `${bytes} B`;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${gb.toFixed(1)} GB`;
}

export function cleanTitle(title: string, maxLength = 40): string {
  return title.trim().replace(/^["']|["']$/g, "").slice(0, maxLength);
}