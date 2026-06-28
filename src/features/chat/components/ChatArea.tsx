import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type RefObject,
} from "react";
import type { ChatMessage } from "@/types/chat";
import { Message } from "./Message";
import { Box, CircularProgress, Typography, IconButton, Fade } from "@mui/material";
import { useChatStore } from "@/store/chatStore";
import { ChevronDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PRETEXT_FONTS, PRETEXT_LINE_HEIGHTS, measureTextHeight } from "@/lib/utils/pretext";
import { getMotionPolicy } from "@/lib/performance/policy";

interface ChatAreaProps {
  messages: ChatMessage[];
  streamingMessagesList: ChatMessage[];
  bottomRef: RefObject<HTMLDivElement | null>;
  onRegenerate?: (messageIndex: number) => void;
  isTemporary?: boolean;
}

interface MessageTurn {
  userMessage: ChatMessage | null;
  assistantMessages: ChatMessage[];
  startIndex: number;
}

const ESTIMATED_TURN_HEIGHT = 220;

function estimateMessageHeight(message: ChatMessage, width: number) {
  const content = `${message.content || ""}\n${message.thinking || ""}`;
  if (!content.trim()) return 72;
  const measured = measureTextHeight(
    content,
    message.role === "user" ? PRETEXT_FONTS.userMessage : PRETEXT_FONTS.message,
    width,
    message.role === "user"
      ? PRETEXT_LINE_HEIGHTS.userMessage
      : PRETEXT_LINE_HEIGHTS.message,
    { fallbackLineHeightPx: 24 },
  );
  const chrome = message.role === "user" ? 48 : 72;
  return Math.min(5000, Math.max(96, Math.ceil(measured + chrome)));
}

function estimateTurnHeight(turn: MessageTurn, width: number) {
  const userHeight = turn.userMessage
    ? estimateMessageHeight(turn.userMessage, width)
    : 0;
  const assistantHeight = Math.max(
    0,
    ...turn.assistantMessages.map((message) => estimateMessageHeight(message, width)),
  );
  return Math.max(ESTIMATED_TURN_HEIGHT, userHeight + assistantHeight + 32);
}

const TurnItem = memo(function TurnItem({
  turn,
  turnIndex,
  isNewest,
  onRegenerate,
  streamingForTurn,
}: {
  turn: MessageTurn;
  turnIndex: number;
  isNewest: boolean;
  onRegenerate?: (index: number) => void;
  streamingForTurn?: ChatMessage[];
}) {
  const allAssistantMessages = useMemo(() => {
    if (!streamingForTurn?.length) return turn.assistantMessages;
    const existingIds = new Set(turn.assistantMessages.map((m) => m.id));
    const deduped = streamingForTurn.filter(
      (sm) => !existingIds.has(sm.id),
    );
    return [...turn.assistantMessages, ...deduped];
  }, [turn.assistantMessages, streamingForTurn]);

  return (
    <Box
      key={
        turn.userMessage?.id ||
        turn.assistantMessages[0]?.id ||
        `turn-${turnIndex}`
      }
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {turn.userMessage && (
        <Box sx={{ maxWidth: 768, mx: "auto", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <Message
            role={turn.userMessage.role}
            id={turn.userMessage.id}
            conversationId={turn.userMessage.conversationId}
            content={turn.userMessage.content}
            attachments={turn.userMessage.attachments}
            model={turn.userMessage.model}
            messageIndex={turn.startIndex}
            onRegenerate={onRegenerate}
          />
        </Box>
      )}

      {allAssistantMessages.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md:
                allAssistantMessages.length > 1
                  ? `repeat(${Math.min(allAssistantMessages.length, 3)}, 1fr)`
                  : "1fr",
            },
            gap: 1.5,
            width: "100%",
            alignItems: "stretch",
            maxWidth: 768,
            mx: "auto",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {allAssistantMessages.map((msg, idx) => (
            <Box
              key={msg.id || `msg-${turnIndex}-${idx}`}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                bgcolor: "transparent",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <Message
                role={msg.role}
                id={msg.id}
                conversationId={msg.conversationId}
                content={msg.content}
                attachments={msg.attachments}
                model={msg.model}
                thinking={msg.thinking}
                thinkingDuration={msg.thinkingDuration}
                isThinking={msg.isThinking}
                isStreaming={msg.isStreaming}
                status={msg.status}
                errorMessage={msg.errorMessage}
                messageIndex={turn.startIndex + 1 + idx}
                onRegenerate={onRegenerate}
                webSearch={msg.webSearch}
                agent={msg.agent}
                isLastMessage={isNewest && idx === allAssistantMessages.length - 1}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

export const ChatArea = memo(function ChatArea({
  messages,
  streamingMessagesList,
  bottomRef,
  onRegenerate,
  isTemporary,
}: ChatAreaProps) {
  const hasMoreMessages = useChatStore((state) => state.hasMoreMessages);
  const loadMoreMessages = useChatStore(
    (state) => state.actions.loadMoreMessages,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(768);
  const scrollAnchorRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
    pending: boolean;
  } | null>(null);
  const stickToBottomRef = useRef(true);
  const showScrollButtonRef = useRef(false);
  const onRegenCb = useCallback(
    (i: number) => onRegenerate?.(i),
    [onRegenerate],
  );

  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 150;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom <= threshold;
    if (distFromBottom <= threshold && distFromBottom >= 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingMessagesList]);

  useEffect(() => {
    const el = scrollRef.current;
    const bottom = bottomRef.current;
    if (!el || !bottom) return;

    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(bottom.parentElement ?? bottom);
    return () => observer.disconnect();
  }, [bottomRef]);

  // Scroll anchoring for load-more: restore position after prepending
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor?.pending) return;
    const el = scrollRef.current;
    if (!el) return;
    const heightDiff = el.scrollHeight - anchor.scrollHeight;
    if (heightDiff > 0) {
      el.scrollTop = anchor.scrollTop + heightDiff;
    }
    scrollAnchorRef.current = null;
  }, [messages]);

  const handleLoadMore = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    scrollAnchorRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      pending: true,
    };
    void loadMoreMessages();
  }, [loadMoreMessages]);

  useEffect(() => {
    if (!hasMoreMessages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { root: scrollRef.current, threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreMessages, handleLoadMore]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      scrollFrameRef.current = null;
      const distFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      const shouldShowScrollButton = distFromBottom > 300;
      if (showScrollButtonRef.current !== shouldShowScrollButton) {
        showScrollButtonRef.current = shouldShowScrollButton;
        setShowScrollButton(shouldShowScrollButton);
      }
      setViewportWidth((current) =>
        Math.abs(current - element.clientWidth) < 1 ? current : element.clientWidth,
      );
    };

    const scheduleScrollStateUpdate = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = requestAnimationFrame(updateScrollState);
    };

    const updateStickToBottom = () => {
      const distFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      stickToBottomRef.current = distFromBottom <= 150;
    };

    updateScrollState();
    const resizeObserver = new ResizeObserver(scheduleScrollStateUpdate);
    resizeObserver.observe(element);
    element.addEventListener("scroll", scheduleScrollStateUpdate, {
      passive: true,
    });
    element.addEventListener("scroll", updateStickToBottom, { passive: true });

    return () => {
      resizeObserver.disconnect();
      element.removeEventListener("scroll", scheduleScrollStateUpdate);
      element.removeEventListener("scroll", updateStickToBottom);
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const turns = useMemo(() => {
    const result: MessageTurn[] = [];
    let currentTurn: MessageTurn | null = null;

    messages.forEach((msg, index) => {
      if (msg.role === "user") {
        if (currentTurn) {
          result.push(currentTurn);
        }
        currentTurn = {
          userMessage: msg,
          assistantMessages: [],
          startIndex: index,
        };
      } else if (msg.role === "assistant") {
        if (currentTurn) {
          currentTurn.assistantMessages.push(msg);
        } else {
          result.push({
            userMessage: null,
            assistantMessages: [msg],
            startIndex: index,
          });
        }
      }
    });

    if (currentTurn) {
      result.push(currentTurn);
    }

    return result;
  }, [messages]);

  const motionPolicy = useMemo(() => getMotionPolicy(), []);
  const estimateWidth = Math.min(768, Math.max(320, viewportWidth - 48));
  const estimatedTurnHeights = useMemo(
    () => turns.map((turn) => estimateTurnHeight(turn, estimateWidth)),
    [estimateWidth, turns],
  );
  const rowVirtualizer = useVirtualizer({
    count: turns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimatedTurnHeights[index] ?? ESTIMATED_TURN_HEIGHT,
    overscan: motionPolicy.virtualOverscan,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
      <Box
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
      <Box
        sx={{
          mx: "auto",
          display: "flex",
          width: "100%",
          maxWidth: 1200,
          flexDirection: "column",
          gap: 3,
          px: { xs: 2, sm: 3 },
          pb: 8,
          pt: 4,
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <Box
          ref={loadMoreRef}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 2,
            visibility: hasMoreMessages || isTemporary ? "visible" : "hidden",
            height: isTemporary ? "auto" : 40,
            gap: 2,
          }}
        >
          {isTemporary && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: "12px",
                bgcolor: "action.hover",
                border: "1px dashed",
                borderColor: "text.secondary",
                color: "text.secondary",
                mb: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Temporary Chat Enabled
              </Typography>
            </Box>
          )}
          {hasMoreMessages && <CircularProgress size={20} color="inherit" />}
        </Box>

        <Box
          sx={{
            height: rowVirtualizer.getTotalSize(),
            minHeight: turns.length === 0 ? 0 : ESTIMATED_TURN_HEIGHT,
            position: "relative",
            width: "100%",
          }}
        >
        {virtualRows.map((virtualRow) => {
          const turnIndex = virtualRow.index;
          const turn = turns[turnIndex];
          if (!turn) return null;
          const isNewest = turnIndex === turns.length - 1;
          return (
            <Box
              key={
                turn.userMessage?.id ||
                turn.assistantMessages[0]?.id ||
                `turn-${turnIndex}`
              }
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                pb: 3,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TurnItem
                turn={turn}
                turnIndex={turnIndex}
                isNewest={isNewest}
                onRegenerate={onRegenCb}
                streamingForTurn={
                  isNewest && streamingMessagesList.length > 0
                    ? streamingMessagesList
                    : undefined
                }
              />
            </Box>
          );
        })}
        </Box>

        <Box ref={bottomRef} sx={{ height: 80 }} />
      </Box>

      <Fade in={showScrollButton} timeout={200}>
        <Box
          sx={{
            position: "sticky",
            bottom: 24,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
            mb: 2,
          }}
        >
          <IconButton
            size="small"
            aria-label="Scroll to latest messages"
            onClick={handleScrollToBottom}
            sx={{
              pointerEvents: "auto",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              color: "text.secondary",
              width: 36,
              height: 36,
              "&:hover": {
                bgcolor: "action.hover",
                color: "text.primary",
              },
            }}
          >
            <ChevronDown size={18} />
          </IconButton>
        </Box>
      </Fade>
    </Box>
  );
});
