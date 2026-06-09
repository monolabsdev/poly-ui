import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { Brain } from "lucide-react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ui/reasoning";

interface ThinkingDisclosureProps {
  thinking?: string;
  isThinking: boolean;
  thinkingDuration?: number;
  processedThinking: string;
  status?: string;
}

export const ThinkingDisclosure = React.memo(
  ({
    thinking,
    isThinking,
    thinkingDuration,
    processedThinking,
    status,
  }: ThinkingDisclosureProps) => {
    const hasThinking = Boolean(processedThinking.trim() || thinking?.trim());
    const [expanded, setExpanded] = useState(isThinking || hasThinking);
    const [seconds, setSeconds] = useState(thinkingDuration ?? 0);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
      if (thinkingDuration !== undefined && !isThinking) {
        setSeconds(thinkingDuration);
      }
    }, [thinkingDuration, isThinking]);

    useEffect(() => {
      if (isThinking) {
        if (hasThinking) setExpanded(true);
      } else if (["complete", "aborted", "error"].includes(status ?? "")) {
        setExpanded(false);
      }
    }, [hasThinking, isThinking, status]);

    useEffect(() => {
      if (!isThinking) return;
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now() - seconds * 1000;
      }
      const interval = setInterval(() => {
        if (startTimeRef.current !== null) {
          setSeconds((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);
      return () => clearInterval(interval);
    }, [isThinking]);

    const displayIndicator = useMemo(() => {
      if (isThinking) return "Thinking…";
      if (seconds < 1) return "Thought for less than a second";
      const floored = Math.floor(seconds);
      if (seconds < 60)
        return `Thought for ${floored} second${floored === 1 ? "" : "s"}`;
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `Thought for ${mins} minute${mins === 1 ? "" : "s"} ${secs} second${secs === 1 ? "" : "s"}`;
    }, [isThinking, seconds]);

    if (!hasThinking && !isThinking) return null;

    return (
      <Box sx={{ mb: 1.5 }}>
        <Reasoning
          open={expanded}
          onOpenChange={setExpanded}
          isStreaming={isThinking}
        >
          <ReasoningTrigger>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box
                component="span"
                sx={{
                  display: "flex",
                  color: "text.secondary",
                  flexShrink: 0,
                }}
              >
                <Brain size={13} />
              </Box>
              {isThinking ? (
                <TextShimmer as="span" duration={2} spread={15}>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "13px",
                      fontWeight: 500,
                      lineHeight: 1,
                    }}
                  >
                    {displayIndicator}
                  </Typography>
                </TextShimmer>
              ) : (
                <Typography
                  component="span"
                  sx={{
                    fontSize: "13px",
                    fontWeight: 500,
                    lineHeight: 1,
                    color: "text.secondary",
                  }}
                >
                  {displayIndicator}
                </Typography>
              )}
            </Box>
          </ReasoningTrigger>
          {hasThinking && (
            <ReasoningContent
              contentSx={{
                mt: 0.5,
                ml: "2px",
                pl: 1.5,
                borderLeft: "1.5px solid",
                borderColor: "divider",
                maxHeight: 320,
                overflowY: "auto",
                scrollbarWidth: "thin",
                "&::-webkit-scrollbar": { width: 4 },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "divider",
                  borderRadius: 2,
                },
                maskImage:
                  "linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 12px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0px, black 12px, black calc(100% - 12px), transparent 100%)",
              }}
            >
              <Typography
                component="div"
                sx={{
                  color: "text.secondary",
                  fontSize: "13.5px",
                  lineHeight: 1.65,
                  py: 0.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {processedThinking}
              </Typography>
            </ReasoningContent>
          )}
        </Reasoning>
      </Box>
    );
  },
);

ThinkingDisclosure.displayName = "ThinkingDisclosure";
