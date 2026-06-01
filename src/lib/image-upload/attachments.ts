import type { Attachment } from "@/types/chat";
import { ObjectUrlRegistry } from "./object-url";

const urls = new ObjectUrlRegistry();
const files = new Map<string, File>();

export function registerImageAttachment(attachment: Attachment, file: File) {
  files.set(attachment.id, file);
  return urls.create(file);
}

export function releaseImageAttachment(attachment: Attachment) {
  files.delete(attachment.id);
  urls.release(attachment.previewUrl);
}

export async function materializeAttachments(attachments: Attachment[]) {
  return Promise.all(attachments.map(async (attachment) => {
    const file = files.get(attachment.id);
    if (!file || !attachment.type.startsWith("image/")) return attachment;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return { ...attachment, content: btoa(binary), previewUrl: undefined };
  }));
}

