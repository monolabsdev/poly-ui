import * as React from "react";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import {
  Check,
  Circle,
  X,
  MoreHorizontal,
  Edit2,
  Archive,
  Trash2,
  Download,
} from "lucide-react";
import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextShimmer } from "@/components/ui/text-shimmer";
import type { Conversation } from "@/store/chatStore";

interface ConversationItemProps {
  conv: Conversation;
  activeConversationId: string | null;
  isGenerating: boolean;
  onClick?: () => void;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent, id: string) => void;
  editingId?: string | null;
  editValue?: string;
  setEditValue?: (v: string) => void;
  handleConfirmRename?: (e: React.MouseEvent, id: string) => void;
  handleCancelRename?: (e: React.MouseEvent) => void;
  handleStartRename?: (e: React.MouseEvent, conv: Conversation) => void;
  handleArchive?: (id: string) => void;
  handleStartDelete?: (conv: Conversation) => void;
  onExport?: (conv: Conversation) => void;
  isCollapsed?: boolean;
  variant?: "sidebar" | "folder" | "folderTree";
}

export const ConversationItem = React.memo(function ConversationItem({
  conv,
  activeConversationId,
  isGenerating,
  onClick,
  selected = false,
  onToggleSelect,
  editingId,
  editValue = "",
  setEditValue,
  handleConfirmRename,
  handleCancelRename,
  handleStartRename,
  handleArchive,
  handleStartDelete,
  onExport,
  isCollapsed = false,
  variant = "sidebar",
}: ConversationItemProps) {
  const isFolder = variant === "folder";
  const isFolderTree = variant === "folderTree";
  const isActive = activeConversationId === conv.id;

  const rootSx = React.useMemo(() => isFolder ? {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    p: 1.25,
    gap: 1,
    borderRadius: "10px",
    bgcolor: isActive ? "action.selected" : "transparent" as const,
    color: "inherit",
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    fontSize: "inherit",
    "&:hover": { bgcolor: "action.hover" },
    "&:hover .checkbox-icon": { opacity: "1 !important" },
  } : {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    height: "100%",
  }, [isFolder, isActive]);

  const content = editingId === conv.id ? (
    <Box sx={{ display: "flex", alignItems: "center", width: "100%", gap: 0.5 }}>
      <input
        autoFocus
        value={editValue}
        onChange={(e) => setEditValue?.(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirmRename?.(e as any, conv.id);
          if (e.key === "Escape") handleCancelRename?.(e as any);
        }}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          color: "inherit",
          outline: "none",
          fontSize: isFolder ? "13px" : "inherit",
          padding: 0,
          width: "100%",
        }}
      />
      <IconButton
        size="small"
        aria-label="Confirm rename"
        onClick={(e) => handleConfirmRename?.(e, conv.id)}
        sx={{ p: 0.5, color: "text.secondary" }}
      >
        <Check size={14} />
      </IconButton>
      <IconButton
        size="small"
        aria-label="Cancel rename"
        onClick={handleCancelRename}
        sx={{ p: 0.5, color: "text.secondary" }}
      >
        <X size={14} />
      </IconButton>
    </Box>
  ) : (
    <Box sx={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0, gap: isFolder ? 1 : 0 }}>
      {onToggleSelect ? (
        <Box
          className="checkbox-icon"
          role="checkbox"
          tabIndex={0}
          aria-label={`Select ${conv.title || "Untitled"}`}
          aria-checked={selected}
          onClick={(e) => onToggleSelect(e, conv.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleSelect(e as unknown as React.MouseEvent, conv.id);
            }
          }}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            flexShrink: 0,
            opacity: selected ? 1 : 0,
            transition: "opacity 0.1s",
            "&:hover": { opacity: "1 !important" },
            cursor: "pointer",
            color: selected ? "primary.main" : "text.disabled",
          }}
        >
          {selected ? <Check size={14} strokeWidth={3} /> : <Circle size={14} />}
        </Box>
      ) : null}
      <Typography
        variant="body2"
        noWrap
        component="div"
        sx={{
          flex: 1,
          minWidth: 0,
          color: activeConversationId === conv.id ? "text.primary" : "text.secondary",
          fontSize: "13px",
          fontWeight: activeConversationId === conv.id ? 500 : 400,
          pr: 1,
        }}
      >
        {isGenerating ? (
          <TextShimmer duration={1.8} spread={18}>
            {conv.title || "Untitled"}
          </TextShimmer>
        ) : (
          conv.title || "Untitled"
        )}
      </Typography>

      {isGenerating ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: isFolderTree ? 18 : isFolder ? 20 : 28,
            height: isFolderTree ? 18 : isFolder ? 20 : 28,
            color: "primary.main",
          }}
        >
          <Ring2
            size={isFolderTree ? "11" : isFolder ? "12" : "14"}
            stroke="3"
            strokeLength="0.28"
            bgOpacity="0.14"
            speed="0.8"
            color="currentColor"
          />
        </Box>
      ) : (
        <Box
          className="conversation-actions"
          sx={{
            display: "flex",
            gap: 0,
            mr: -0.5,
            visibility: isCollapsed ? "hidden" : "visible",
            width: isFolderTree ? 22 : 28,
            height: isFolderTree ? 22 : 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="small"
                aria-label={`Actions for ${conv.title || "Untitled"}`}
                onClick={(e) => e.stopPropagation()}
                sx={{
                  p: 0.5,
                  color: "text.secondary",
                  "&:hover": { color: "text.primary", bgcolor: "action.selected" },
                }}
              >
                <MoreHorizontal size={14} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => handleStartRename?.(e, conv)}>
                <Edit2 size={14} /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleArchive?.(conv.id)}>
                <Archive size={14} /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.(conv)}>
                <Download size={14} /> Export
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => handleStartDelete?.(conv)}>
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      )}
    </Box>
  );

  if (isFolder) {
    return (
      <ButtonBase onClick={onClick} sx={rootSx}>
        {content}
      </ButtonBase>
    );
  }

  return <Box sx={rootSx}>{content}</Box>;
});
