import * as React from "react";
import { Upload, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Attachment } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_CONTEXT_FILES = 5;
const MAX_CONTEXT_FILE_SIZE = 1024 * 1024;
const MAX_CONTEXT_TOTAL_SIZE = 3 * 1024 * 1024;
const MAX_BACKGROUND_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_CONTEXT_TYPES = new Set([
  "text/plain", "text/markdown", "text/csv", "application/json",
]);

function isAllowedContextFile(file: File) {
  if (ALLOWED_CONTEXT_TYPES.has(file.type)) return true;
  return /\.(txt|md|markdown|csv|json)$/i.test(file.name);
}

interface CreateFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    backgroundImage?: string;
    systemPrompt?: string;
    contextFiles?: Attachment[];
  }) => void;
  initialData?: {
    name: string;
    backgroundImage?: string;
    systemPrompt?: string;
    contextFiles?: Attachment[];
  };
}

export function CreateFolderModal({ open, onOpenChange, onSave, initialData }: CreateFolderModalProps) {
  const [name, setName] = React.useState("");
  const [backgroundImage, setBackgroundImage] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [contextFiles, setContextFiles] = React.useState<Attachment[]>([]);
  const [fileError, setFileError] = React.useState("");
  const bgInputRef = React.useRef<HTMLInputElement>(null);
  const filesInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setName(initialData?.name ?? "");
      setBackgroundImage(initialData?.backgroundImage ?? "");
      setSystemPrompt(initialData?.systemPrompt ?? "");
      setContextFiles(initialData?.contextFiles ?? []);
      setFileError("");
    }
  }, [open, initialData]);

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (!file.type.startsWith("image/")) { setFileError("Background must be an image file."); e.target.value = ""; return; }
    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) { setFileError(`Background image must be ${MAX_BACKGROUND_IMAGE_SIZE / 1024 / 1024} MB or smaller.`); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => setBackgroundImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setFileError("");
    const selected = Array.from(files);
    const existingSize = contextFiles.reduce((t, f) => t + f.size, 0);
    const accepted: File[] = [];
    let nextSize = existingSize;

    for (const file of selected) {
      if (contextFiles.length + accepted.length >= MAX_CONTEXT_FILES) { setFileError(`Maximum ${MAX_CONTEXT_FILES} context files.`); break; }
      if (!isAllowedContextFile(file)) { setFileError("Context files must be text, Markdown, CSV, or JSON."); continue; }
      if (file.size > MAX_CONTEXT_FILE_SIZE) { setFileError(`Each file must be ${MAX_CONTEXT_FILE_SIZE / 1024 / 1024} MB or smaller.`); continue; }
      if (nextSize + file.size > MAX_CONTEXT_TOTAL_SIZE) { setFileError(`Total must be ${MAX_CONTEXT_TOTAL_SIZE / 1024 / 1024} MB or less.`); continue; }
      accepted.push(file);
      nextSize += file.size;
    }

    for (const file of accepted) {
      const reader = new FileReader();
      reader.onload = () => {
        setContextFiles((prev) => [...prev, {
          id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size,
          content: reader.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      backgroundImage: backgroundImage.trim() || undefined,
      systemPrompt: systemPrompt.trim() || undefined,
      contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex w-[min(520px,calc(100vw-32px))] max-w-none flex-col gap-0 rounded-[28px] border border-border/60 bg-card p-0 text-card-foreground shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <DialogTitle className="text-[17px] font-semibold">
            {initialData ? "Edit folder" : "Create folder"}
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-6">
          {fileError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-400">
              {fileError}
            </div>
          )}

          {/* Folder name */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80">Folder name</Label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleSave(); }}
              placeholder="My folder"
              className="h-10 w-full rounded-xl border border-border/60 bg-input/40 px-3 text-[13.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Background image */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80">Background image <span className="text-muted-foreground/50 font-normal">(optional)</span></Label>
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
            {backgroundImage ? (
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-24 shrink-0 rounded-xl border border-border/60 bg-cover bg-center"
                  style={{ backgroundImage: `url(${backgroundImage})` }}
                />
                <button
                  onClick={() => setBackgroundImage("")}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X size={13} /> Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => bgInputRef.current?.click()}
                className="flex h-10 items-center gap-2.5 rounded-xl border border-dashed border-border/60 px-3 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                <Image size={15} />
                Choose image…
              </button>
            )}
          </div>

          {/* System prompt */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80">System prompt <span className="text-muted-foreground/50 font-normal">(optional)</span></Label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant specialized in…"
              rows={3}
              className="w-full resize-none rounded-xl border border-border/60 bg-input/40 px-3 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Context files */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80">
              Context files <span className="text-muted-foreground/50 font-normal">(optional)</span>
            </Label>

            {contextFiles.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-input/20 p-2">
                {contextFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                    <FileText size={13} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80">{file.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground/60">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => setContextFiles((prev) => prev.filter((f) => f.id !== file.id))}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={filesInputRef}
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => filesInputRef.current?.click()}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-xl border border-dashed border-border/60 px-3 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-foreground",
                contextFiles.length >= MAX_CONTEXT_FILES && "pointer-events-none opacity-40",
              )}
            >
              <Upload size={15} />
              {contextFiles.length === 0 ? "Choose files…" : "Add more files…"}
            </button>
            <p className="text-[11.5px] text-muted-foreground/50">
              Up to {MAX_CONTEXT_FILES} files, {MAX_CONTEXT_FILE_SIZE / 1024 / 1024} MB each, {MAX_CONTEXT_TOTAL_SIZE / 1024 / 1024} MB total. Text, Markdown, CSV, JSON.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 rounded-full px-4 text-[13px]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()} className="h-9 rounded-full px-5 text-[13px]">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
