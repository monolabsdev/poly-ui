import * as React from "react";
import { Box, ButtonBase, IconButton, Typography, type SxProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
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
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import { sidebarIconButtonSx } from "@/features/sidebar/components/SidebarPrimitives";
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
  const reducedMotion = useReducedMotion();

  const rootSx: SxProps<Theme> = isFolder
    ? (theme) => ({
        ...theme.typography.body2,
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        p: 1,
        gap: 1,
        borderRadius: theme.shape.borderRadius,
        bgcolor: isActive ? "action.selected" : "transparent",
        color: "inherit",
        cursor: "pointer",
        textAlign: "left" as const,
        fontFamily: "inherit",
        "&:hover": { bgcolor: "action.hover" },
        "&:hover .checkbox-icon": { opacity: "1 !important" },
      })
    : {
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        height: "100%",
      };

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
          fontSize: "inherit",
          padding: 0,
          width: "100%",
        }}
      />
      <IconButton
        size="small"
        aria-label="Confirm rename"
        onClick={(e) => handleConfirmRename?.(e, conv.id)}
        sx={(theme) => sidebarIconButtonSx(theme, reducedMotion)}
      >
        <Check />
      </IconButton>
      <IconButton
        size="small"
        aria-label="Cancel rename"
        onClick={handleCancelRename}
        sx={(theme) => sidebarIconButtonSx(theme, reducedMotion)}
      >
        <X />
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
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            flexShrink: 0,
            opacity: selected ? 1 : 0,
            transition: theme.transitions.create("opacity", {
              duration: theme.transitions.duration.shortest,
            }),
            "&:hover": { opacity: "1 !important" },
            cursor: "pointer",
            color: selected ? "primary.main" : "text.disabled",
          })}
        >
          {selected ? <Check size={14} strokeWidth={3} /> : <Circle size={14} />}
        </Box>
      ) : null}
      <Typography
        variant="body2"
        noWrap
        component="div"
        sx={(theme) => ({
          ...theme.typography.body2,
          flex: 1,
          minWidth: 0,
          color: isActive ? "text.primary" : "text.secondary",
          fontWeight: isActive
            ? theme.typography.fontWeightMedium
            : theme.typography.fontWeightRegular,
          pr: 1,
          lineHeight: 1.25,
        })}
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
                sx={(theme) => sidebarIconButtonSx(theme, reducedMotion)}
              >
                <MoreHorizontal />
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
