import React, { useMemo } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { Link } from "@/components/ui/link";
import { Globe, ExternalLink } from "lucide-react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ui/reasoning";
import type { SearchResultItem } from "@/types/chat";

const MAX_HIGHLIGHT_LENGTH = 160;

interface WebSearchDisclosureProps {
  isSearching: boolean;
  query: string;
  results?: SearchResultItem[] | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export const WebSearchDisclosure = React.memo(
  ({
    isSearching,
    query,
    results,
    isExpanded,
    onToggle,
  }: WebSearchDisclosureProps) => {
    const count = results?.length ?? 0;
    const hasResults = !isSearching && count > 0;

    const label = useMemo(
      () =>
        isSearching ? `Searching for "${query}"…` : `Searched for "${query}"`,
      [isSearching, query],
    );

    const meta = useMemo(
      () => (hasResults ? `- ${count} source${count === 1 ? "" : "s"}` : ""),
      [hasResults, count],
    );

    if (!query.trim() && !isSearching && count === 0) return null;

    const truncate = (text: string) =>
      text.length > MAX_HIGHLIGHT_LENGTH
        ? text.slice(0, MAX_HIGHLIGHT_LENGTH) + "…"
        : text;

    const triggerContent = (
      <Box>
        <Box
          as="span"
        >
          <Globe size={13} />
        </Box>
        {isSearching ? (
          <TextShimmer as="span" duration={2} spread={15} className="text-sm leading-normal text-foreground">
            {label}
          </TextShimmer>
        ) : (
          <Typography
            as="span"
          >
            {label}
          </Typography>
        )}
        {meta && (
          <Typography
            as="span"
          >
            {meta}
          </Typography>
        )}
      </Box>
    );

    return (
      <Box>
        <Reasoning open={isExpanded} onOpenChange={onToggle}>
          <ReasoningTrigger>{triggerContent}</ReasoningTrigger>
          {hasResults && (
            <ReasoningContent
            >
              <Box
              >
                {results?.map((result, i) => (
                  <Box
                    key={`${result.url}-${i}`}
                  >
                    <Link
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                    >
                      {result.title}
                      <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    </Link>

                    {result.highlights?.map((highlight, j) => (
                      <Typography
                        key={j}
                        variant="body2"
                      >
                        {truncate(highlight)}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Box>
            </ReasoningContent>
          )}
        </Reasoning>
      </Box>
    );
  },
);

WebSearchDisclosure.displayName = "WebSearchDisclosure";
