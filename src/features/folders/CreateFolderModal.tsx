import * as React from "react";
import { Upload, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Attachment } from "@/types/chat";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <Label>
      {children}
      {optional && <span className="font-normal text-muted-foreground/60">(optional)</span>}
    </Label>
  );
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
      <DialogContent className="w-[min(520px,calc(100vw-2rem))] max-w-none gap-5">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit folder" : "Create folder"}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto">
          {fileError && <Alert severity="warning">{fileError}</Alert>}

          {/* Folder name */}
          <div className="flex flex-col gap-2">
            <FieldLabel>Folder name</FieldLabel>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleSave(); }}
              placeholder="My folder"
            />
          </div>

          {/* Background image */}
          <div className="flex flex-col gap-2">
            <FieldLabel optional>Background image</FieldLabel>
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
            {backgroundImage ? (
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-24 shrink-0 rounded-xl border bg-cover bg-center"
                  style={{ backgroundImage: `url(${backgroundImage})` }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBackgroundImage("")}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X /> Remove
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => bgInputRef.current?.click()}
                className="justify-start border-dashed font-normal text-muted-foreground"
              >
                <Image />
                Choose image…
              </Button>
            )}
          </div>

          {/* System prompt */}
          <div className="flex flex-col gap-2">
            <FieldLabel optional>System prompt</FieldLabel>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant specialized in…"
              rows={3}
            />
          </div>

          {/* Context files */}
          <div className="flex flex-col gap-2">
            <FieldLabel optional>Context files</FieldLabel>

            {contextFiles.length > 0 && (
              <div className="flex flex-col gap-1 rounded-xl border bg-input/20 p-2">
                {contextFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground/60">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => setContextFiles((prev) => prev.filter((f) => f.id !== file.id))}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="size-3.5" />
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
            <Button
              variant="outline"
              onClick={() => filesInputRef.current?.click()}
              disabled={contextFiles.length >= MAX_CONTEXT_FILES}
              className="justify-start border-dashed font-normal text-muted-foreground"
            >
              <Upload />
              {contextFiles.length === 0 ? "Choose files…" : "Add more files…"}
            </Button>
            <p className="text-xs text-muted-foreground/60">
              Up to {MAX_CONTEXT_FILES} files, {MAX_CONTEXT_FILE_SIZE / 1024 / 1024} MB each, {MAX_CONTEXT_TOTAL_SIZE / 1024 / 1024} MB total. Text, Markdown, CSV, JSON.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
