import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Box, ButtonBase, Typography, alpha, useTheme } from "@mui/material";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CornerDownLeft,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import type { CommandPaletteCategory, CommandPaletteItem } from "./types";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
};

type PaletteRow =
  | { type: "header"; id: string; label: string }
  | { type: "item"; id: string; item: CommandPaletteItem };

const HEADER_ROW_HEIGHT = 30;
const ITEM_ROW_HEIGHT = 56;
const ITEM_ROW_WITH_DESCRIPTION_HEIGHT = 68;
const ROW_VERTICAL_GAP = 4;

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
      execute(selectedItem);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
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
            component={motion.div}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            onKeyDown={handleKeyDown}
            sx={{
              width: "750px",
              maxWidth: { xs: "calc(100vw - 24px)", sm: "90vw" },
              height:
                "min(65dvh, calc(100dvh - var(--titlebar-height) - clamp(32px, 12vh, 112px)))",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: { xs: "14px", sm: "18px" },
              border: "1px solid",
              borderColor: alpha(
                theme.palette.common.white,
                theme.palette.mode === "dark" ? 0.12 : 0.24,
              ),
              bgcolor:
                theme.palette.mode === "dark"
                  ? alpha("#101010", 0.88)
                  : alpha("#f8f8f8", 0.9),
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 24px 80px rgba(0,0,0,0.55)"
                  : "0 24px 80px rgba(0,0,0,0.18)",
              backdropFilter: "blur(28px) saturate(1.25)",
              "@media (min-height: 720px)": {
                minHeight: 420,
              },
              "@media (max-height: 560px)": {
                height: "calc(100dvh - var(--titlebar-height) - 24px)",
                minHeight: 0,
              },
              "@media (max-width: 520px)": {
                width: "calc(100vw - 24px)",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                height: { xs: 54, sm: 62 },
                px: { xs: 1.5, sm: 2 },
                borderBottom: "1px solid",
                borderColor: "divider",
                color: "text.secondary",
                flexShrink: 0,
              }}
            >
              <Search size={18} />
              <Box
                ref={inputRef}
                component="input"
                value={query}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setQuery(event.target.value)
                }
                placeholder="Search conversations, actions, settings..."
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
                  fontSize: { xs: 14, sm: 15 },
                  fontWeight: 500,
                  "&::placeholder": {
                    color: "text.secondary",
                    opacity: 0.8,
                  },
                }}
              />
              <KeyHint>
                {navigator.platform.toLowerCase().includes("mac")
                  ? "Cmd K"
                  : "Ctrl K"}
              </KeyHint>
            </Box>

            <Box
              ref={parentRef}
              role="listbox"
              aria-label="Command results"
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                px: 1,
                py: 1,
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
                              alignItems: "center",
                              px: 1.25,
                              pt: 0.5,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: 0,
                                color: "text.secondary",
                                textTransform: "uppercase",
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

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 1,
                borderTop: "1px solid",
                borderColor: "divider",
                color: "text.secondary",
                flexShrink: 0,
                flexWrap: "wrap",
                "@media (max-height: 440px)": {
                  display: "none",
                },
              }}
            >
              <FooterHint icon={<CornerDownLeft size={13} />} label="Open" />
              <FooterHint label="↑↓ Navigate" />
              <FooterHint label="Esc Close" />
            </Box>
          </Box>
        </Box>
      ) : null}
    </AnimatePresence>
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
  const hasDescription = Boolean(item.description);

  return (
    <ButtonBase
      id={`command-${item.id}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        width: "100%",
        height: hasDescription
          ? ITEM_ROW_WITH_DESCRIPTION_HEIGHT - ROW_VERTICAL_GAP
          : ITEM_ROW_HEIGHT - ROW_VERTICAL_GAP,
        minHeight: ITEM_ROW_HEIGHT - ROW_VERTICAL_GAP,
        my: `${ROW_VERTICAL_GAP / 2}px`,
        justifyContent: "flex-start",
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: "10px",
        color: "text.primary",
        bgcolor: active
          ? alpha(theme.palette.primary.main, 0.12)
          : "transparent",
        outline: active
          ? `1px solid ${alpha(theme.palette.primary.main, 0.14)}`
          : "1px solid transparent",
        "&:hover": {
          bgcolor: active
            ? alpha(theme.palette.primary.main, 0.14)
            : "action.hover",
        },
      })}
    >
      {!isFeature ? (
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: "text.secondary",
            bgcolor: "action.hover",
            flexShrink: 0,
          }}
        >
          {item.icon ?? categoryIcon(item.category)}
        </Box>
      ) : null}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.25,
          minWidth: 0,
          flex: "1 1 auto",
          textAlign: "left",
          overflow: "hidden",
        }}
      >
        <Typography
          noWrap
          sx={{
            display: "block",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 14,
            fontWeight: 750,
            color: "text.primary",
            lineHeight: 1.25,
          }}
        >
          {displayTitle}
        </Typography>
        {item.description ? (
          <Typography
            noWrap
            sx={{
              display: "block",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 12,
              color: "text.secondary",
              lineHeight: 1.3,
            }}
          >
            {item.description}
          </Typography>
        ) : null}
      </Box>
      {item.shortcut ? <KeyHint>{item.shortcut}</KeyHint> : null}
      {isFeature ? (
        <Box
          sx={(theme) => ({
            width: 24,
            height: 24,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: isFeatureEnabled
              ? theme.palette.success.main
              : theme.palette.text.secondary,
          })}
          aria-hidden="true"
        >
          {isFeatureEnabled ? <Check size={15} /> : <X size={15} />}
        </Box>
      ) : null}
    </ButtonBase>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        px: 0.8,
        py: 0.35,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "action.hover",
        color: "text.secondary",
        fontSize: 11,
        fontFamily: "inherit",
        lineHeight: 1,
        ml: "auto",
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

function FooterHint({
  icon,
  label,
}: {
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 11 }}>
      {icon}
      <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
        {label}
      </Typography>
    </Box>
  );
}
