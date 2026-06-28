import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Check, MessageSquare, Search, Settings, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommandPaletteCategory, CommandPaletteItem } from "./types";
import { getIntentSummary, parseCommandIntent, type ParsedIntent } from "./intentParser";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
};

type PaletteRow =
  | { type: "header"; id: string; label: string }
  | { type: "item"; id: string; item: CommandPaletteItem };

const HEADER_HEIGHT = 36;
const ITEM_HEIGHT = 40;
const MEDIUM_CONFIDENCE = 0.62;

const CATEGORY_LABELS: Record<CommandPaletteCategory, string> = {
  action: "Actions",
  conversation: "Conversations",
  feature: "Features",
  setting: "Settings",
};

const EMPTY_ORDER: CommandPaletteCategory[] = ["action", "conversation", "feature", "setting"];
const SEARCH_ORDER: CommandPaletteCategory[] = ["action", "conversation", "feature", "setting"];

function scoreItem(item: CommandPaletteItem, query: string) {
  const haystack = [item.title, item.description, item.category, ...(item.keywords ?? [])]
    .filter(Boolean).join(" ").toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  if (haystack.includes(needle)) return 1000 - haystack.indexOf(needle);
  let score = 0, hi = 0;
  for (const ch of needle) {
    const fi = haystack.indexOf(ch, hi);
    if (fi === -1) return 0;
    score += fi === hi ? 12 : 4;
    hi = fi + 1;
  }
  return score - haystack.length * 0.01;
}

function buildRows(items: CommandPaletteItem[], query: string): PaletteRow[] {
  const trimmed = query.trim();
  const minScore = Math.max(16, trimmed.length * 8);
  const source = trimmed
    ? items.map((item) => ({ item, score: scoreItem(item, trimmed) }))
        .filter((e) => e.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .map((e) => e.item)
    : items;

  const rows: PaletteRow[] = [];
  for (const cat of trimmed ? SEARCH_ORDER : EMPTY_ORDER) {
    const group = source.filter((i) => i.category === cat);
    if (!group.length) continue;
    rows.push({ type: "header", id: `hdr-${cat}`, label: CATEGORY_LABELS[cat] });
    rows.push(...group.map((item) => ({ type: "item" as const, id: item.id, item })));
  }
  return rows;
}

function catIcon(category: CommandPaletteCategory) {
  if (category === "conversation") return <MessageSquare size={15} />;
  if (category === "feature") return <Zap size={15} />;
  if (category === "setting") return <Settings size={15} />;
  return <Sparkles size={15} />;
}

export function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const rows = React.useMemo(() => buildRows(items, query), [items, query]);
  const parsedIntent = React.useMemo(() => parseCommandIntent(query), [query]);
  const showIntent = Boolean(
    parsedIntent && (parsedIntent.confidence >= MEDIUM_CONFIDENCE || parsedIntent.destructive),
  );

  const selectable = React.useMemo(
    () => rows.filter((r): r is Extract<PaletteRow, { type: "item" }> => r.type === "item"),
    [rows],
  );
  const selIdx = selectable.findIndex((r) => r.item.id === selectedId);
  const selectedItem = selIdx >= 0 ? selectable[selIdx]?.item : selectable[0]?.item;

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i]?.type === "header" ? HEADER_HEIGHT : ITEM_HEIGHT),
    overscan: 10,
  });

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  }, [open]);

  React.useEffect(() => {
    if (!open || !selectable.length) { setSelectedId(null); return; }
    if (selectedId && selectable.some((r) => r.item.id === selectedId)) return;
    setSelectedId(selectable[0].item.id);
  }, [open, selectable, selectedId]);

  React.useEffect(() => {
    const idx = rows.findIndex((r) => r.type === "item" && r.item.id === selectedItem?.id);
    if (idx >= 0) virt.scrollToIndex(idx, { align: "auto" });
  }, [rows, selectedItem?.id, virt]);

  const execute = React.useCallback((item?: CommandPaletteItem) => {
    if (!item) return;
    item.execute();
    onOpenChange(false);
  }, [onOpenChange]);

  const executeIntent = React.useCallback((intent: ParsedIntent | null) => {
    if (!intent) return;
    if (intent.command === "search-chats") {
      setQuery(intent.args.query);
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
      return;
    }
    const action = items.find((i) => i.smartCommand?.command === intent.command);
    if (!action) return;
    const exec = action.smartCommand?.execute;
    if (exec) void exec(intent.args as never); else action.execute();
    onOpenChange(false);
  }, [items, onOpenChange]);

  const moveSelection = React.useCallback((dir: 1 | -1) => {
    if (!selectable.length) return;
    const cur = Math.max(0, selIdx);
    setSelectedId(selectable[(cur + dir + selectable.length) % selectable.length].item.id);
  }, [selectable, selIdx]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(false); return; }
    if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (parsedIntent && showIntent) { executeIntent(parsedIntent); return; }
      execute(selectedItem);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="relative z-10 mx-4 flex w-full max-w-[600px] flex-col overflow-hidden rounded-[24px] bg-popover shadow-2xl"
        style={{ maxHeight: "min(560px, 72vh)" }}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Search size={15} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            aria-label="Search commands"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
        </div>

        {/* Intent */}
        {showIntent && parsedIntent ? (
          <div className={cn(
            "flex items-center gap-2 px-5 py-2 text-[12px]",
            parsedIntent.destructive ? "text-destructive" : "text-muted-foreground",
          )}>
            {parsedIntent.destructive ? <AlertTriangle size={12} /> : <Sparkles size={12} />}
            <span className="truncate">
              {(() => { const s = getIntentSummary(parsedIntent); return `${s.action}${s.argument ? ` "${s.argument}"` : ""}`; })()}
            </span>
          </div>
        ) : null}

        {/* List */}
        <div
          ref={parentRef}
          role="listbox"
          aria-label="Command results"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3"
        >
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No results</div>
          ) : (
            <div className="relative" style={{ height: virt.getTotalSize() }}>
              {virt.getVirtualItems().map((vr) => {
                const row = rows[vr.index];
                if (!row) return null;
                return (
                  <div
                    key={row.id}
                    data-index={vr.index}
                    ref={virt.measureElement}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${vr.start}px)` }}
                  >
                    {row.type === "header" ? (
                      <div className="flex h-9 items-end px-3 pb-1">
                        <span className="text-[12px] text-muted-foreground/60">{row.label}</span>
                      </div>
                    ) : (
                      <CmdRow
                        item={row.item}
                        active={row.item.id === selectedItem?.id}
                        onMouseEnter={() => setSelectedId(row.item.id)}
                        onClick={() => execute(row.item)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CmdRow({ item, active, onMouseEnter, onClick }: {
  item: CommandPaletteItem;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const isFeature = item.category === "feature";
  const isOn = item.title.startsWith("✓");
  const title = isFeature ? item.title.replace(/^[✓✕]\s*/, "") : item.title;

  return (
    <button
      id={`cmd-${item.id}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left",
        active ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <span className="shrink-0 text-muted-foreground [&>svg]:size-[15px]">
        {item.icon ?? catIcon(item.category)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">{title}</span>
      {item.shortcut ? (
        <span className="shrink-0 text-[12px] text-muted-foreground/70">{item.shortcut}</span>
      ) : null}
      {isFeature ? (
        <span className={isOn ? "text-green-400" : "text-muted-foreground/40"}>
          {isOn ? <Check size={13} /> : <X size={13} />}
        </span>
      ) : null}
    </button>
  );
}
