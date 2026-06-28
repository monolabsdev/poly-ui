import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { Check, AlertTriangle, MessageSquare, Search, Settings, Sparkles, X, Zap } from "lucide-react";
import type { CommandPaletteCategory, CommandPaletteItem } from "./types";
import {
  getIntentSummary,
  parseCommandIntent,
  type ParsedIntent,
} from "./intentParser";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
};

type PaletteRow =
  | { type: "header"; id: string; label: string }
  | { type: "item"; id: string; item: CommandPaletteItem };

const HEADER_ROW_HEIGHT = 24;
const ITEM_ROW_HEIGHT = 38;
const ITEM_ROW_WITH_DESCRIPTION_HEIGHT = 38;
const ROW_VERTICAL_GAP = 2;
const MEDIUM_CONFIDENCE = 0.62;

const CATEGORY_LABELS: Record<CommandPaletteCategory, string> = {
  conversation: "Conversations",
  action: "Actions",
  feature: "Features",
  setting: "Settings",
};

const EMPTY_ORDER: CommandPaletteCategory[] = [
  "conversation",
  "action",
  "feature",
  "setting",
];

const SEARCH_ORDER: CommandPaletteCategory[] = [
  "action",
  "conversation",
  "feature",
  "setting",
];

function scoreItem(item: CommandPaletteItem, query: string) {
  const haystack = [
    item.title,
    item.description,
    item.category,
    ...(item.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  if (haystack.includes(needle)) return 1000 - haystack.indexOf(needle);

  let score = 0;
  let haystackIndex = 0;
  for (const char of needle) {
    const foundIndex = haystack.indexOf(char, haystackIndex);
    if (foundIndex === -1) return 0;
    score += foundIndex === haystackIndex ? 12 : 4;
    haystackIndex = foundIndex + 1;
  }
  return score - haystack.length * 0.01;
}

function buildRows(items: CommandPaletteItem[], query: string): PaletteRow[] {
  const trimmed = query.trim();
  const minimumScore = Math.max(16, trimmed.length * 8);
  const source = trimmed
    ? items
        .map((item) => ({ item, score: scoreItem(item, trimmed) }))
        .filter((entry) => entry.score >= minimumScore)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item)
    : items;

  const order = trimmed ? SEARCH_ORDER : EMPTY_ORDER;
  const rows: PaletteRow[] = [];
  for (const category of order) {
    const group = source.filter((item) => item.category === category);
    if (group.length === 0) continue;
    rows.push({
      type: "header",
      id: `header-${category}`,
      label: CATEGORY_LABELS[category],
    });
    rows.push(
      ...group.map((item) => ({ type: "item" as const, id: item.id, item })),
    );
  }
  return rows;
}

function categoryIcon(category: CommandPaletteCategory) {
  if (category === "conversation") return <MessageSquare size={16} />;
  if (category === "feature") return <Zap size={16} />;
  if (category === "setting") return <Settings size={16} />;
  return <Sparkles size={16} />;
}

function getPaletteRowHeight(row: PaletteRow | undefined) {
  if (!row) return ITEM_ROW_HEIGHT;
  if (row.type === "header") return HEADER_ROW_HEIGHT;
  return row.item.description
    ? ITEM_ROW_WITH_DESCRIPTION_HEIGHT
    : ITEM_ROW_HEIGHT;
}


export function CommandPalette({
  open,
  onOpenChange,
  items,
}: CommandPaletteProps) {
  const theme = useTheme();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const rows = React.useMemo(() => buildRows(items, query), [items, query]);
  const parsedIntent = React.useMemo(() => parseCommandIntent(query), [query]);
  const showIntent = Boolean(
    parsedIntent &&
      (parsedIntent.confidence >= MEDIUM_CONFIDENCE || parsedIntent.destructive),
  );
  const selectableItems = React.useMemo(
    () =>
      rows.filter(
        (row): row is Extract<PaletteRow, { type: "item" }> =>
          row.type === "item",
      ),
    [rows],
  );
  const selectedIndex = selectableItems.findIndex(
    (row) => row.item.id === selectedId,
  );
  const selectedItem =
    selectedIndex >= 0
      ? selectableItems[selectedIndex]?.item
      : selectableItems[0]?.item;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => getPaletteRowHeight(rows[index]),
    overscan: 10,
  });

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    if (!open || selectableItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId && selectableItems.some((row) => row.item.id === selectedId))
      return;
    setSelectedId(selectableItems[0].item.id);
  }, [open, selectableItems, selectedId]);

  React.useEffect(() => {
    const rowIndex = rows.findIndex(
      (row) => row.type === "item" && row.item.id === selectedItem?.id,
    );
    if (rowIndex >= 0) virtualizer.scrollToIndex(rowIndex, { align: "auto" });
  }, [rows, selectedItem?.id, virtualizer]);

  const execute = React.useCallback(
    (item: CommandPaletteItem | undefined) => {
      if (!item) return;
      item.execute();
      onOpenChange(false);
    },
    [onOpenChange],
  );

  const executeIntent = React.useCallback(
    (intent: ParsedIntent | null) => {
      if (!intent) return;
      if (intent.command === "search-chats") {
        setQuery(intent.args.query);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      const action = items.find(
        (item) => item.smartCommand?.command === intent.command,
      );
      if (!action) return;
      const executor = action.smartCommand?.execute;
      if (executor) void executor(intent.args as never);
      else action.execute();
      onOpenChange(false);
    },
    [items, onOpenChange],
  );

  const moveSelection = React.useCallback(
    (direction: 1 | -1) => {
      if (selectableItems.length === 0) return;
      const current = Math.max(0, selectedIndex);
      const next =
        (current + direction + selectableItems.length) % selectableItems.length;
      setSelectedId(selectableItems[next].item.id);
    },
    [selectableItems, selectedIndex],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (parsedIntent && showIntent) {
        executeIntent(parsedIntent);
        return;
      }
      execute(selectedItem);
    }
  };

  return (
    <React.Fragment>
      {open ? (
        <Box
          className="animate-fade-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
          sx={{
            position: "fixed",
            inset: "var(--titlebar-height) 0 0 0",
            zIndex: theme.zIndex.modal + 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            py: "clamp(16px, 6vh, 56px)",
            px: { xs: 1.5, sm: 2 },
            bgcolor: alpha(theme.palette.background.default, 0.5),
            backdropFilter: "blur(18px)",
            "@media (max-height: 560px)": {
              py: "12px",
            },
          }}
        >
          <Box
            className="animate-popover"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={handleKeyDown}
            sx={{
              width: "520px",
              maxWidth: { xs: "calc(100vw - 24px)", sm: "90vw" },
              maxHeight: "min(55dvh, calc(100dvh - var(--titlebar-height) - clamp(32px, 12vh, 112px)))",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: theme.app.radius.commandPalette,
              border: "1px solid",
              borderColor: alpha(
                theme.palette.common.white,
                theme.palette.mode === "dark" ? 0.1 : 0.2,
              ),
              bgcolor:
                theme.palette.mode === "dark"
                  ? theme.palette.background.default
                  : theme.palette.background.paper,
              "@media (max-height: 560px)": {
                maxHeight: "calc(100dvh - var(--titlebar-height) - 24px)",
              },
              "@media (max-width: 520px)": {
                width: "calc(100vw - 24px)",
              },
            }}
          >
            <Box
              sx={{
                px: 1.25,
                pt: 1.25,
                pb: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
                flexShrink: 0,
              }}
            >
              <Box
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  height: 40,
                  px: 1.5,
                  borderRadius: theme.app.radius.pill,
                  bgcolor: "action.hover",
                  border: "1px solid",
                  borderColor: "divider",
                  color: "text.secondary",
                })}
              >
                <Search size={16} />
                <Box
                  ref={inputRef}
                  component="input"
                  value={query}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search commands and conversations"
                  aria-label="Search commands"
                  aria-activedescendant={
                    selectedItem ? `command-${selectedItem.id}` : undefined
                  }
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    outline: 0,
                    bgcolor: "transparent",
                    color: "text.primary",
                    fontSize: 13.5,
                    fontWeight: 450,
                    "&::placeholder": {
                      color: "text.secondary",
                      opacity: 0.7,
                    },
                  }}
                />
              </Box>
            </Box>

            {showIntent && parsedIntent ? (
              <IntentPreview intent={parsedIntent} />
            ) : null}

            <Box
              ref={parentRef}
              role="listbox"
              aria-label="Command results"
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                px: 0.75,
                pt: 0.5,
                pb: 1,
                scrollbarWidth: "thin",
                scrollbarColor: `${alpha(theme.palette.text.secondary, 0.32)} transparent`,
                "&::-webkit-scrollbar": {
                  width: 8,
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: alpha(theme.palette.text.secondary, 0.24),
                  borderRadius: 8,
                  border: "2px solid transparent",
                  backgroundClip: "content-box",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  backgroundColor: alpha(theme.palette.text.secondary, 0.38),
                },
              }}
            >
              {rows.length === 0 ? (
                <Box
                  sx={{ py: 7, textAlign: "center", color: "text.secondary" }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                    No results
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 12 }}>
                    Try a different search.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    if (!row) return null;
                    return (
                      <Box
                        key={row.id}
                        data-index={virtualRow.index}
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: virtualRow.size,
                          boxSizing: "border-box",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {row.type === "header" ? (
                          <Box
                            sx={{
                              height: HEADER_ROW_HEIGHT,
                              display: "flex",
                              alignItems: "flex-end",
                              px: 1.5,
                              pb: 0.25,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: "text.secondary",
                                opacity: 0.7,
                              }}
                            >
                              {row.label}
                            </Typography>
                          </Box>
                        ) : (
                          <CommandRow
                            item={row.item}
                            active={row.item.id === selectedItem?.id}
                            onMouseEnter={() => setSelectedId(row.item.id)}
                            onClick={() => execute(row.item)}
                          />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

          </Box>
        </Box>
      ) : null}
    </React.Fragment>
  );
}

function IntentPreview({ intent }: { intent: ParsedIntent }) {
  const summary = getIntentSummary(intent);
  const text = `${summary.action}${summary.argument ? ` "${summary.argument}"` : ""}`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.75,
        py: 0.6,
        borderBottom: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
        color: intent.destructive ? "error.main" : "text.secondary",
        opacity: 0.8,
      }}
    >
      {intent.destructive
        ? <AlertTriangle size={11} />
        : <Sparkles size={11} />}
      <Typography
        noWrap
        sx={{
          fontSize: 11,
          lineHeight: 1,
          color: "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </Typography>
      {import.meta.env.DEV ? (
        <Typography sx={{ fontSize: 10, ml: "auto", opacity: 0.5, flexShrink: 0 }}>
          {Math.round(intent.confidence * 100)}%
        </Typography>
      ) : null}
    </Box>
  );
}

function CommandRow({
  item,
  active,
  onMouseEnter,
  onClick,
}: {
  item: CommandPaletteItem;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const isFeature = item.category === "feature";
  const isFeatureEnabled = item.title.startsWith("\u2713");
  const displayTitle = isFeature
    ? item.title.replace(/^[\u2713\u2715]\s*/, "")
    : item.title;

  return (
    <ButtonBase
      id={`command-${item.id}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        width: "100%",
        height: ITEM_ROW_HEIGHT - ROW_VERTICAL_GAP,
        my: `${ROW_VERTICAL_GAP / 2}px`,
        justifyContent: "flex-start",
        gap: 1.25,
        px: 1.25,
        borderRadius: "10px",
        color: active ? "text.primary" : "text.secondary",
        bgcolor: active ? "action.selected" : "transparent",
        "&:hover": { bgcolor: active ? "action.selected" : "action.hover" },
        transition: "background-color 80ms",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, color: "inherit" }}>
        {item.icon ?? categoryIcon(item.category)}
      </Box>
      <Typography
        noWrap
        sx={{
          flex: "1 1 auto",
          minWidth: 0,
          textAlign: "left",
          fontSize: 13.5,
          fontWeight: active ? 600 : 500,
          color: "text.primary",
          lineHeight: 1,
        }}
      >
        {displayTitle}
      </Typography>
      {item.shortcut ? <KeyHint>{item.shortcut}</KeyHint> : null}
      {isFeature ? (
        <Box
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            color: isFeatureEnabled ? theme.palette.success.main : theme.palette.text.disabled,
          })}
          aria-hidden="true"
        >
          {isFeatureEnabled ? <Check size={14} /> : <X size={14} />}
        </Box>
      ) : null}
    </ButtonBase>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        color: "text.secondary",
        opacity: 0.6,
        fontSize: 12,
        fontFamily: "inherit",
        lineHeight: 1,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </Box>
  );
}
