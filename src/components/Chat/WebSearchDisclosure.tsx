import { Box, Typography, Collapse, Link } from "@mui/material";
import { ChevronDown, ChevronUp, Globe, ExternalLink } from "lucide-react";
import type { SearchResultItem } from "@/types/chat";

const MAX_HIGHLIGHT_LENGTH = 120;

interface WebSearchDisclosureProps {
  isSearching: boolean;
  query: string;
  results?: SearchResultItem[] | null;
  isExpanded: boolean;
  onToggle: () => void;
}

function WebSearchDisclosure({
  isSearching,
  query,
  results,
  isExpanded,
  onToggle,
}: WebSearchDisclosureProps) {
  const count = results?.length ?? 0;
  const hasResults = count > 0;

  // Don't render anything during searching — avoids flicker
  if (isSearching) return null;

  const truncate = (text: string) =>
    text.length > MAX_HIGHLIGHT_LENGTH
      ? text.slice(0, MAX_HIGHLIGHT_LENGTH) + "…"
      : text;

  return (
    <Box>
      <Box
        onClick={onToggle}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
          userSelect: "none",
          color: "text.secondary",
          "&:hover": { opacity: 0.75 },
        }}
      >
        <Globe size={13} />
        <Typography variant="body2" sx={{ fontSize: "13px", fontWeight: 500 }}>
          {hasResults
            ? `Searched ${count} source${count === 1 ? "" : "s"} for "${query}"`
            : `Searched for "${query}"`}
        </Typography>
        {hasResults && (isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </Box>
      {hasResults && (
        <Collapse in={isExpanded}>
          <Box
            sx={{
              mt: 1,
              pl: 1.5,
              borderLeft: "2px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {results?.map((result, i) => (
              <Box key={`${result.url}-${i}`}>
                <Link
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{
                    display: "inline",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "primary.main",
                    lineHeight: 1.4,
                    "& svg": { verticalAlign: "middle", ml: 0.3, mb: 0.2 },
                  }}
                >
                  {result.title}
                  <ExternalLink size={10} />
                </Link>
                {result.highlights.map((h, j) => (
                  <Typography
                    key={j}
                    variant="body2"
                    sx={{
                      fontSize: "12.5px",
                      color: "text.secondary",
                      lineHeight: 1.4,
                      mt: 0.3,
                      pl: 1.5,
                    }}
                  >
                    {truncate(h)}
                  </Typography>
                ))}
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

export default WebSearchDisclosure;
