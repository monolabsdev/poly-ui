import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ui/reasoning";
import { TextShimmer } from "@/components/ui/text-shimmer";

// TODO: npx shadcn add "https://prompt-kit.com/c/thinking-bar.json"

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
      }, 1000);
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
      <Reasoning
        open={expanded}
        onOpenChange={setExpanded}
        isStreaming={isThinking}
        className="my-2"
      >
        <ReasoningTrigger>
          {isThinking ? (
            <TextShimmer duration={2} spread={15}>
              {displayIndicator}
            </TextShimmer>
          ) : (
            displayIndicator
          )}
        </ReasoningTrigger>
        {hasThinking && (
          <ReasoningContent
            markdown
           
          >
            {processedThinking}
          </ReasoningContent>
        )}
      </Reasoning>
    );
  },
);

ThinkingDisclosure.displayName = "ThinkingDisclosure";
