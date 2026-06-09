import React, { useMemo } from "react";
import { Box, Typography, Link } from "@mui/material";
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
    if (!query.trim() && !isSearching && count === 0) return null;

    const label = useMemo(
      () =>
        isSearching ? `Searching for "${query}"…` : `Searched for "${query}"`,
      [isSearching, query],
    );

    const meta = useMemo(
      () => (hasResults ? `- ${count} source${count === 1 ? "" : "s"}` : ""),
      [hasResults, count],
    );

    const truncate = (text: string) =>
      text.length > MAX_HIGHLIGHT_LENGTH
        ? text.slice(0, MAX_HIGHLIGHT_LENGTH) + "…"
        : text;

    const triggerContent = (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          component="span"
          sx={{
            display: "flex",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          <Globe size={13} />
        </Box>
        {isSearching ? (
          <TextShimmer as="span" duration={2} spread={15}>
            <Typography
              component="span"
              sx={{ fontSize: "13px", fontWeight: 500, lineHeight: 1 }}
            >
              {label}
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
            {label}
          </Typography>
        )}
        {meta && (
          <Typography
            component="span"
            sx={{
              fontSize: "12px",
              fontWeight: 400,
              color: "text.disabled",
              lineHeight: 1,
            }}
          >
            {meta}
          </Typography>
        )}
      </Box>
    );

    return (
      <Box sx={{ maxWidth: { xs: "90%", sm: "80%" }, my: 0.5 }}>
        <Reasoning open={isExpanded} onOpenChange={onToggle}>
          <ReasoningTrigger>{triggerContent}</ReasoningTrigger>
          {hasResults && (
            <ReasoningContent
              contentSx={{
                mt: 1,
                ml: "2px",
                pl: 1.5,
                borderLeft: "1.5px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  py: 0.5,
                }}
              >
                {results?.map((result, i) => (
                  <Box
                    key={`${result.url}-${i}`}
                    sx={{
                      "&:not(:last-child)": {
                        borderBottom: "1px dashed",
                        borderColor: "action.hover",
                        pb: 1.25,
                      },
                    }}
                  >
                    <Link
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "primary.main",
                        lineHeight: 1.4,
                        mb: 0.5,
                      }}
                    >
                      {result.title}
                      <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    </Link>

                    {result.highlights?.map((highlight, j) => (
                      <Typography
                        key={j}
                        variant="body2"
                        sx={{
                          fontSize: "12.5px",
                          color: "text.secondary",
                          lineHeight: 1.5,
                          pl: 1,
                          borderLeft: "2px solid",
                          borderColor: "action.hover",
                          mt: 0.5,
                        }}
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
