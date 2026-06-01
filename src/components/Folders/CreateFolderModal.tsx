import * as React from "react";
import { Box, Typography, TextField, Input } from "@mui/material";
import { Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { IconButton } from "@mui/material";
import { Attachment } from "@/types/chat";

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

export function CreateFolderModal({
  open,
  onOpenChange,
  onSave,
  initialData,
}: CreateFolderModalProps) {
  const [name, setName] = React.useState("");
  const [backgroundImage, setBackgroundImage] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [contextFiles, setContextFiles] = React.useState<Attachment[]>([]);

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setBackgroundImage(initialData.backgroundImage || "");
        setSystemPrompt(initialData.systemPrompt || "");
        setContextFiles(initialData.contextFiles || []);
      } else {
        setName("");
        setBackgroundImage("");
        setSystemPrompt("");
        setContextFiles([]);
      }
    }
  }, [open, initialData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: Attachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          content: reader.result as string,
        };
        setContextFiles((prev) => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setContextFiles((prev) => prev.filter((f) => f.id !== id));
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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Edit folder" : "Create folder"}
      maxWidth={560}
      footer={
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            sx={{
              bgcolor: "transparent",
              borderColor: "divider",
              color: "text.secondary",
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "border.main",
                color: "text.primary",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 3 }}>
        <TextField
          autoFocus
          label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) handleSave();
          }}
          fullWidth
          size="small"
          variant="outlined"
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "14px",
            },
          }}
        />

        <Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 1,
              color: "text.secondary",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Background image (optional)
          </Typography>
          {backgroundImage ? (
            <Box
              sx={{
                position: "relative",
                borderRadius: "8px",
                overflow: "hidden",
                height: 120,
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <IconButton
                size="small"
                onClick={() => setBackgroundImage("")}
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  bgcolor: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                }}
              >
                <X size={14} />
              </IconButton>
            </Box>
          ) : (
            <Box
              component="label"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                px: 2,
                py: 1.5,
                borderRadius: "8px",
                border: "1px dashed",
                borderColor: "divider",
                cursor: "pointer",
                color: "text.secondary",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "primary.main",
                  color: "primary.main",
                },
              }}
            >
              <Upload size={16} />
              <Typography variant="caption" sx={{ fontSize: "12px" }}>
                Upload image
              </Typography>
              <Input
                type="file"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setBackgroundImage(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
                sx={{ display: "none" }}
                inputProps={{ accept: "image/*" }}
              />
            </Box>
          )}
        </Box>

        <Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 1,
              color: "text.secondary",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            System prompt for folder (optional)
          </Typography>
          <TextField
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            fullWidth
            multiline
            rows={3}
            size="small"
            variant="outlined"
            placeholder="You are helpful assistant specialized in..."
            sx={{
              "& .MuiOutlinedInput-root": {
                fontSize: "13px",
              },
            }}
          />
        </Box>

        <Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mb: 1,
              color: "text.secondary",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Context files for AI (optional)
          </Typography>

          {contextFiles.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
              {contextFiles.map((file) => (
                <Box
                  key={file.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: "8px",
                    bgcolor: "action.hover",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ flex: 1, fontSize: "12px", color: "text.primary", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {file.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: "11px", color: "text.secondary", flexShrink: 0 }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => removeFile(file.id)}
                    sx={{ p: 0.25, color: "text.secondary", "&:hover": { color: "error.main" } }}
                  >
                    <X size={14} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Box
            component="label"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              px: 2,
              py: 1.5,
              borderRadius: "8px",
              border: "1px dashed",
              borderColor: "divider",
              cursor: "pointer",
              color: "text.secondary",
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "primary.main",
                color: "primary.main",
              },
            }}
          >
            <Upload size={16} />
            <Typography variant="caption" sx={{ fontSize: "12px" }}>
              Upload file
            </Typography>
            <Input
              type="file"
              onChange={handleFileUpload}
              sx={{ display: "none" }}
              inputProps={{ multiple: true }}
            />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
