import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ArrowLeft, Download, Search, Trash2, XCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOllama } from "@/features/ollama/useOllama";
import { useProviderStore } from "@/features/providers";
import { useViewStore } from "@/lib/view-registry";
import { formatFileSize, loggedInvoke } from "@/lib/utils/utils";
import { getCurrentProviderAccountId } from "@/features/providers";
import type { PullProgress } from "@/features/ollama/types";

type FilterMode = "all" | "local" | "external";
type BrowserModel = ReturnType<typeof useOllama>["models"][number];
type ModelRow =
  | { id: string; type: "header"; label: string }
  | { id: string; type: "local"; model: BrowserModel }
  | { id: string; type: "external"; model: BrowserModel }
  | { id: string; type: "empty"; message: string };

export default function ModelBrowser() {
  const ollama = useOllama();
  const providers = useProviderStore((s) => s.providers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [newModelName, setNewModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<PullProgress>("pull-progress", (event) => {
      ollama.actions.setPullProgress(event.payload);
    });
    return () => void unlisten.then((stop) => stop());
  }, [ollama.actions]);

  useEffect(() => {
    ollama.actions.loadExternalModels();
  }, [ollama.actions]);

  const showLocal = filterMode === "all" || filterMode === "local";
  const showExternal = filterMode === "all" || filterMode === "external";

  const localModels = useMemo(() => {
    let list = ollama.models.filter((m) => m.provider_type === "OllamaLocal");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [ollama.models, searchQuery]);

  const externalModels = useMemo(() => {
    let list = ollama.models.filter((m) => m.provider_type === "OpenAICompatible");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [ollama.models, searchQuery]);

  const rows = useMemo<ModelRow[]>(() => {
    const next: ModelRow[] = [];
    if (showLocal && localModels.length > 0) {
      next.push({ id: "header-local", type: "header", label: "Installed" });
      next.push(
        ...localModels.map((model) => ({
          id: `local-${model.name}`,
          type: "local" as const,
          model,
        })),
      );
    }
    if (showExternal && externalModels.length > 0) {
      next.push({ id: "header-external", type: "header", label: "Provider" });
      next.push(
        ...externalModels.map((model) => ({
          id: `external-${model.name}`,
          type: "external" as const,
          model,
        })),
      );
    }
    if (ollama.state === "loading" && localModels.length === 0) {
      next.push({ id: "empty-loading", type: "empty", message: "Loading models..." });
    } else if (next.length === 0) {
      next.push({
        id: "empty-models",
        type: "empty",
        message: searchQuery
          ? "No models match your search."
          : showExternal && !showLocal
            ? "No models available from providers."
            : "No models found. Pull a model below.",
      });
    }
    return next;
  }, [
    externalModels,
    localModels,
    ollama.state,
    searchQuery,
    showExternal,
    showLocal,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      if (row?.type === "header") return 32;
      if (row?.type === "empty") return 112;
      return row?.type === "local" ? 50 : 42;
    },
    overscan: 10,
  });

  const refreshModels = async () => {
    await ollama.refresh();
  };

  const pullModelByName = async (name: string) => {
    setIsPulling(true);
    ollama.actions.setPullingModel(name);
    ollama.actions.setPullProgress({ status: "Starting..." });
    try {
      await loggedInvoke("pull_model", {
        model: name,
        accountId: getCurrentProviderAccountId(),
      });
      await refreshModels();
    } catch {
    } finally {
      setIsPulling(false);
      ollama.actions.setPullingModel(null);
      ollama.actions.setPullProgress(null);
    }
  };

  const pullModel = async () => {
    const model = newModelName.trim();
    if (!model) return;
    await pullModelByName(model);
    setNewModelName("");
  };

  const deleteModel = useCallback(
    async (model: string) => {
      if (
        !confirm(
          `Delete installed model "${model}"? You will need to download it again to use it.`,
        )
      )
        return;
      try {
        await ollama.deleteModel(model);
        await refreshModels();
      } catch {
      }
    },
    [ollama],
  );

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2.5,
          pt: 1.5,
          pb: 1,
        }}
      >
        <IconButton
          size="small"
          onClick={() => useViewStore.getState().setActiveView(null)}
          aria-label="Back to chat"
        >
          <ArrowLeft size={18} />
        </IconButton>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
          Model Browser
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 1.25,
          px: 2.5,
          pb: 1.5,
          flexWrap: "wrap",
        }}
      >
        {providers.length === 0 && (
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            No providers configured
          </Typography>
        )}
        {providers.map((p) => (
          <Chip
            key={p.config.id}
            label={`${p.config.provider_type === "OllamaLocal" ? "Ollama" : p.config.api_base_url || "Provider"}`}
            size="small"
            variant="outlined"
            sx={{
              fontSize: 12,
              fontWeight: 600,
              borderColor: p.status === "Online" ? "success.main" : "text.disabled",
            }}
            icon={
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor:
                    p.status === "Online"
                      ? "success.main"
                      : p.status === "Reconnecting"
                        ? "warning.main"
                        : "text.disabled",
                  flexShrink: 0,
                }}
              />
            }
          />
        ))}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2.5,
          pb: 1.5,
        }}
      >
        <TextField
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search models..."
          size="small"
          sx={{ minWidth: 220, maxWidth: 320 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={15} />
                </InputAdornment>
              ),
              sx: { fontSize: 13 },
            },
          }}
        />
        {(["all", "local", "external"] as const).map((mode) => (
          <Chip
            key={mode}
            label={mode}
            size="small"
            variant={filterMode === mode ? "filled" : "outlined"}
            onClick={() => setFilterMode(mode)}
            sx={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: "capitalize",
              color: filterMode === mode ? undefined : "text.secondary",
            }}
          />
        ))}
      </Box>

      <Box ref={listRef} sx={{ flex: 1, overflow: "auto", px: 2.5, pb: 1 }}>
        <Box sx={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return (
              <Box
                key={row.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === "header" ? (
                  <Typography
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      mb: 0.75,
                    }}
                  >
                    {row.label}
                  </Typography>
                ) : row.type === "empty" ? (
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: "text.secondary",
                      py: 4,
                      textAlign: "center",
                    }}
                  >
                    {row.message}
                  </Typography>
                ) : row.type === "local" ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              py: 0.625,
              px: 1,
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                {row.model.name}
              </Typography>
              <Typography
                sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.3 }}
              >
                {row.model.size > 0 ? formatFileSize(row.model.size) : ""}
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label={`Delete ${row.model.name}`}
              onClick={() => void deleteModel(row.model.name)}
              sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
            >
              <Trash2 size={14} />
            </IconButton>
          </Box>
                ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 0.625,
                  px: 1,
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                    {row.model.name}
                  </Typography>
                </Box>
              </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ borderTop: 1, borderColor: "divider", px: 2.5, py: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            placeholder="Model name (e.g. llama3.2:3b)"
            size="small"
            disabled={isPulling}
            sx={{ flex: 1, maxWidth: 360 }}
            slotProps={{ input: { sx: { fontSize: 13 } } }}
          />
          <Button
            variant="contained"
            disableElevation
            onClick={pullModel}
            disabled={isPulling || !newModelName.trim()}
            startIcon={<Download size={15} />}
            sx={{ textTransform: "none", fontWeight: 700, fontSize: 13 }}
          >
            Pull
          </Button>
        </Box>
        {isPulling && ollama.pullProgress && (
          <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                  {ollama.pullProgress.status}
                </Typography>
                {ollama.pullProgress.total && ollama.pullProgress.total > 0 ? (
                  <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                    {Math.round(
                      ((ollama.pullProgress.completed ?? 0) /
                        ollama.pullProgress.total) *
                        100,
                    )}
                    %
                  </Typography>
                ) : null}
              </Box>
              <LinearProgress
                variant={
                  ollama.pullProgress.total && ollama.pullProgress.total > 0
                    ? "determinate"
                    : "indeterminate"
                }
                value={
                  ollama.pullProgress.total && ollama.pullProgress.total > 0
                    ? ((ollama.pullProgress.completed ?? 0) /
                        ollama.pullProgress.total) *
                      100
                    : undefined
                }
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
            <IconButton
              size="small"
              aria-label="Cancel pull"
              onClick={() => void ollama.cancelPull()}
            >
              <XCircle size={15} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
}
