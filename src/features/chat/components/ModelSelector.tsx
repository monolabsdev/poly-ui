import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, Search } from "lucide-react";
import { useOllama, type OllamaModel } from "@/features/ollama";
import { useProviderStore } from "@/features/providers";
import type { ModelProvider } from "@/store/modelStore";
import { modelChoiceId } from "@/lib/models/model-choice";
import {
  filterModelOptions,
  shouldLoadExternalModels,
  type ModelFilter,
} from "@/lib/models/model-selector";
import {
  ModelSelectorOption,
  ModelSelectorSkeleton,
  ModelSelectorStatus,
} from "@/features/chat/components/ModelSelectorOption";

const ROW_HEIGHT = 40;
const FILTERS: { id: ModelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "local", label: "Local" },
  { id: "external", label: "External" },
];

interface ModelSelectorProps {
  model: string;
  provider: ModelProvider;
  providerConfigId?: number;
  onChange: (option: OllamaModel) => void;
}

export function ModelSelector({
  model,
  provider,
  providerConfigId,
  onChange,
}: ModelSelectorProps) {
  const ollama = useOllama();
  const providers = useProviderStore((state) => state.providers);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [filter, setFilter] = useState<ModelFilter>("all");
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(anchorEl);

  const externalApiUrl =
    providers.find((item) => item.provider_type === "OpenAICompatible")?.config
      .api_base_url ?? "OpenAI-compatible API";
  const visibleModels = useMemo(
    () => filterModelOptions(ollama.models, filter, query),
    [filter, ollama.models, query],
  );
  const selectedId = modelChoiceId(provider, model, providerConfigId);
  const rowVirtualizer = useVirtualizer({
    count: visibleModels.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    initialRect: { width: 480, height: 280 },
    overscan: 6,
    useFlushSync: false,
  });

  useEffect(() => {
    if (
      shouldLoadExternalModels(
        isOpen,
        ollama.externalModelsLoaded,
        ollama.externalModelsLoading,
      )
    ) {
      void ollama.actions.loadExternalModels();
    }
  }, [
    isOpen,
    ollama.actions,
    ollama.externalModelsLoaded,
    ollama.externalModelsLoading,
  ]);

  useEffect(() => {
    setHighlightedIndex(0);
    rowVirtualizer.scrollToIndex(0);
  }, [filter, query, rowVirtualizer]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    }
  }, [isOpen, rowVirtualizer]);

  const close = () => {
    setAnchorEl(null);
  };

  const resetClosedState = () => {
    setFilter("all");
    setQuery("");
    setHighlightedIndex(0);
  };

  const select = (option: OllamaModel) => {
    onChange(option);
    close();
  };

  const moveHighlight = (offset: number) => {
    if (!visibleModels.length) return;
    const next =
      (highlightedIndex + offset + visibleModels.length) %
      visibleModels.length;
    setHighlightedIndex(next);
    rowVirtualizer.scrollToIndex(next, { align: "auto" });
  };

  return (
    <>
      <ButtonBase
        disableRipple
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Select model. Current model: ${model || "none"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        sx={{
          minHeight: 32,
          borderRadius: "9999px",
          gap: 0.5,
          color: "primary.main",
          fontSize: { xs: 14, sm: 15 },
          fontWeight: 600,
          px: 0.25,
          "&:hover": { bgcolor: "transparent" },
        }}
      >
        <Typography component="span" sx={{ fontSize: "inherit", fontWeight: "inherit" }} noWrap>
          {model || "Select model"}
        </Typography>
        <ChevronDown size={14} />
      </ButtonBase>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={close}
        transitionDuration={{ enter: 100, exit: 80 }}
        slotProps={{
          transition: {
            onExited: resetClosedState,
          },
          paper: {
            sx: {
              width: { xs: "calc(100vw - 24px)", sm: 480 },
              maxWidth: "calc(100vw - 24px)",
              mt: 0.75,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "background.paper",
              backgroundImage: "none",
              boxShadow: 8,
              overflow: "hidden",
            },
          },
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, pt: 1.25 }}>
          <Search size={16} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Search a model"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveHighlight(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveHighlight(-1);
              } else if (event.key === "Enter" && visibleModels[highlightedIndex]) {
                select(visibleModels[highlightedIndex]);
              } else if (event.key === "Escape") {
                close();
              }
            }}
            inputProps={{ "aria-label": "Search models" }}
            sx={{ fontSize: 14 }}
          />
        </Box>

        <Box role="tablist" aria-label="Model source" sx={{ display: "flex", gap: 2, px: 1.5, py: 1 }}>
          {FILTERS.map((item) => (
            <ButtonBase
              key={item.id}
              role="tab"
              disableRipple
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: "9999px",
                justifyContent: "flex-start",
                color: filter === item.id ? "text.primary" : "text.secondary",
                fontSize: 13,
                fontWeight: filter === item.id ? 700 : 500,
                "&:hover": { color: "text.primary" },
              }}
            >
              {item.label}
            </ButtonBase>
          ))}
        </Box>

        {ollama.state === "loading" || (ollama.externalModelsLoading && visibleModels.length === 0) ? (
          <ModelSelectorSkeleton count={4} />
        ) : visibleModels.length === 0 ? (
          <ModelSelectorStatus
            text={
              filter === "external" && ollama.externalModelsError
                ? "External models unavailable"
                : "No matching models"
            }
          />
        ) : (
          <Box ref={listRef} role="listbox" sx={{ height: 280, overflowY: "auto", pb: 0.75 }}>
            <Box sx={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const option = visibleModels[virtualRow.index];
                return (
                  <ModelSelectorOption
                    key={modelChoiceId(option.provider_type, option.name, option.provider_config_id)}
                    option={option}
                    selected={modelChoiceId(option.provider_type, option.name, option.provider_config_id) === selectedId}
                    highlighted={virtualRow.index === highlightedIndex}
                    externalApiUrl={externalApiUrl}
                    onHover={() => setHighlightedIndex(virtualRow.index)}
                    onSelect={() => select(option)}
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </Popover>
    </>
  );
}
