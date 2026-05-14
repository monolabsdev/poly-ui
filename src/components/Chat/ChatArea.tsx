import { memo, useEffect, useRef, useMemo, useState, type RefObject } from "react";
import type { ChatMessage } from "@/types/chat";
import { Message } from "./Message";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useChatStore } from "@/store/chatStore";
import { motion } from "motion/react";
import { useTiming, ANIMATION_VARIANTS } from "@/lib/motion";

interface ChatAreaProps {
  messages: ChatMessage[];
  bottomRef: RefObject<HTMLDivElement | null>;
  onRegenerate?: (messageIndex: number) => void;
  isTemporary?: boolean;
}

interface MessageTurn {
  userMessage: ChatMessage | null;
  assistantMessages: ChatMessage[];
  startIndex: number;
}

const VIRTUALIZE_AFTER_TURNS = 80;
const ESTIMATED_TURN_HEIGHT = 220;
const OVERSCAN_TURNS = 8;

export const ChatArea = memo(function ChatArea({
  messages,
  bottomRef,
  onRegenerate,
  isTemporary,
}: ChatAreaProps) {
  const hasMoreMessages = useChatStore((state) => state.hasMoreMessages);
  const loadMoreMessages = useChatStore((state) => state.actions.loadMoreMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const viewportRef = useRef({ top: 0, height: 0 });
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const timing = useTiming();

  useEffect(() => {
    if (!hasMoreMessages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadMoreMessages();
        }
      },
      { root: scrollRef.current, threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreMessages, loadMoreMessages]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateViewport = () => {
      scrollFrameRef.current = null;
      const next = {
        top: element.scrollTop,
        height: element.clientHeight,
      };
      const current = viewportRef.current;
      if (Math.abs(next.top - current.top) < 1 && Math.abs(next.height - current.height) < 1) {
        return;
      }
      viewportRef.current = next;
      setViewport({
        top: next.top,
        height: next.height,
      });
    };

    const scheduleViewportUpdate = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = requestAnimationFrame(updateViewport);
    };

    updateViewport();
    const resizeObserver = new ResizeObserver(scheduleViewportUpdate);
    resizeObserver.observe(element);
    element.addEventListener("scroll", scheduleViewportUpdate, { passive: true });

    return () => {
      resizeObserver.disconnect();
      element.removeEventListener("scroll", scheduleViewportUpdate);
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

  const virtualWindow = useMemo(() => {
    if (turns.length <= VIRTUALIZE_AFTER_TURNS || viewport.height === 0) {
      return {
        start: 0,
        end: turns.length,
        topSpacer: 0,
        bottomSpacer: 0,
      };
    }

    const start = Math.max(
      0,
      Math.floor(viewport.top / ESTIMATED_TURN_HEIGHT) - OVERSCAN_TURNS,
    );
    const visibleCount =
      Math.ceil(viewport.height / ESTIMATED_TURN_HEIGHT) + OVERSCAN_TURNS * 2;
    const end = Math.min(turns.length, start + visibleCount);

    return {
      start,
      end,
      topSpacer: start * ESTIMATED_TURN_HEIGHT,
      bottomSpacer: Math.max(0, (turns.length - end) * ESTIMATED_TURN_HEIGHT),
    };
  }, [turns.length, viewport.height, viewport.top]);

  const visibleTurns = useMemo(
    () => turns.slice(virtualWindow.start, virtualWindow.end),
    [turns, virtualWindow.start, virtualWindow.end],
  );

  return (
    <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto" }}>
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

        {virtualWindow.topSpacer > 0 && (
          <Box aria-hidden sx={{ height: virtualWindow.topSpacer, flexShrink: 0 }} />
        )}

        {visibleTurns.map((turn, visibleTurnIndex) => {
          const turnIndex = virtualWindow.start + visibleTurnIndex;
          const isNewest = visibleTurnIndex === visibleTurns.length - 1;
          
          return (
            <Box
              component={motion.div}
              variants={ANIMATION_VARIANTS.messageTurn}
              initial="initial"
              animate="animate"
              transition={{ 
                duration: timing.duration("base"), 
                ease: timing.ease,
                delay: isNewest ? 0.05 : 0 
              }}
              key={turn.userMessage?.id || turn.assistantMessages[0]?.id || `turn-${turnIndex}`}
              sx={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
            {turn.userMessage && (
              <Box sx={{ maxWidth: 768, mx: "auto", width: "100%" }}>
                <Message
                  role={turn.userMessage.role}
                  content={turn.userMessage.content}
                  attachments={turn.userMessage.attachments}
                  model={turn.userMessage.model}
                  messageIndex={turn.startIndex}
                  onRegenerate={onRegenerate}
                />
              </Box>
            )}

            {turn.assistantMessages.length > 0 && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md:
                      turn.assistantMessages.length > 1
                        ? `repeat(${Math.min(turn.assistantMessages.length, 3)}, 1fr)`
                        : "1fr",
                  },
                  gap: 1.5,
                  width: "100%",
                  alignItems: "stretch",
                  maxWidth: 768,
                  mx: "auto",
                }}
              >
                {turn.assistantMessages.map((msg, msgIndex) => {
                  return (
                    <Box
                      key={msg.id || `msg-${turnIndex}-${msgIndex}`}
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "transparent",
                      }}
                    >
                      <Message
                        role={msg.role}
                        content={msg.content}
                        attachments={msg.attachments}
                        model={msg.model}
                        thinking={msg.thinking}
                        thinkingDuration={msg.thinkingDuration}
                        isThinking={msg.isThinking}
                        isStreaming={msg.isStreaming}
                        status={msg.status}
                        errorMessage={msg.errorMessage}
                        messageIndex={turn.startIndex + 1 + msgIndex}
                        onRegenerate={onRegenerate}
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
        })}

        {virtualWindow.bottomSpacer > 0 && (
          <Box aria-hidden sx={{ height: virtualWindow.bottomSpacer, flexShrink: 0 }} />
        )}
        <Box ref={bottomRef} sx={{ height: 80 }} />
      </Box>
    </Box>
  );
});
