import { Children, isValidElement, memo, useMemo, useId, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./CodeBlock";
import { parseProgressive } from "@/lib/chat/streamMarkdown";
import { isInlineMarkdownCode } from "@/lib/utils/markdownCode";
import { getMarkdownRenderBlocks } from "@/lib/chat/markdownRenderBlocks";
import { PRETEXT_FONTS, PRETEXT_LINE_HEIGHTS, measureTextHeight } from "@/lib/utils/pretext";

const ALERT_CONFIG = {
  note: { border: "info.main", bg: "info.soft" },
  tip: { border: "success.main", bg: "success.soft" },
  important: { border: "warning.main", bg: "warning.soft" },
  warning: { border: "warning.main", bg: "warning.soft" },
  caution: { border: "error.main", bg: "error.soft" },
} as const;

type AlertType = keyof typeof ALERT_CONFIG;

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function detectAlert(children: ReactNode): AlertType | null {
  const arr = Children.toArray(children);
  for (const child of arr) {
    if (isValidElement(child)) {
      const text = extractText((child.props as Record<string, unknown>)?.children).trim();
      const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
      if (match) return match[1].toLowerCase() as AlertType;
    }
  }
  return null;
}

const headingSx = {
  color: "text.primary",
  fontWeight: 600,
  lineHeight: 1.3,
} as const;

const HEADING_MARGINS: Record<string, { mt: number; mb: number }> = {
  h1: { mt: 3, mb: 1.5 },
  h2: { mt: 2.5, mb: 1.25 },
  h3: { mt: 2, mb: 1 },
  h4: { mt: 2, mb: 0.75 },
  h5: { mt: 1.5, mb: 0.5 },
  h6: { mt: 1.5, mb: 0.5 },
};

function createHeadingComponent(variant: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function Heading({ children }: { children?: ReactNode }) {
    const margins = HEADING_MARGINS[variant];
    return (
      <Typography variant={variant} sx={{ ...headingSx, ...margins }}>
        {children}
      </Typography>
    );
  };
}

const PROSE_SX = {
  userSelect: "text",
  WebkitUserSelect: "text",
  color: "text.primary",
  fontSize: "15px",
  lineHeight: 1.6,
  overflowX: "hidden",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  minWidth: 0,
  maxWidth: "100%",
  width: "100%",
  boxSizing: "border-box",

  "& pre": {
    overflowX: "auto",
    overflowY: "hidden",
    maxWidth: "100%",
    minWidth: 0,
    display: "block",
  },

  "& code": {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  "& .katex-display": {
    overflowX: "auto",
    overflowY: "hidden",
    py: 1,
  },

  "& p": { m: 0, overflowWrap: "anywhere", wordBreak: "break-word" },
  "& ul, & ol": { pl: 3, m: 0, my: 1.5 },
  "& li": {
    mb: 0.25,
    lineHeight: 1.6,
    fontSize: "15px",
    color: "text.primary",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  "& li > p": { m: 0 },
} as const;

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components,
  }: {
    content: string;
    components: Partial<Components>;
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content;
  },
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function normalizeContent(content: string): string {
  return content.replace(/<br\s*\/?>/gi, "\n");
}

export function MarkdownProse({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const id = useId();
  const normalized = useMemo(() => normalizeContent(content), [content]);
  const progressive = useMemo(
    () => streaming ? parseProgressive(normalized) : { safe: normalized, pending: false },
    [normalized, streaming],
  );
  const blocks = useMemo(
    () => getMarkdownRenderBlocks(progressive.safe, streaming),
    [progressive.safe, streaming],
  );
  const intrinsicHeight = useMemo(() => {
    const measured = measureTextHeight(
      progressive.safe,
      PRETEXT_FONTS.message,
      680,
      PRETEXT_LINE_HEIGHTS.message,
      { fallbackLineHeightPx: 24 },
    );
    return Math.ceil(Math.min(5000, Math.max(120, measured + 48)));
  }, [progressive.safe]);
  const components = useMemo<Partial<Components>>(
    () => ({
      pre: ({ children }) => <>{children}</>,

      code({ className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "");
        const codeValue = String(children).replace(/\n$/, "");
        const inline = isInlineMarkdownCode(className, children);
        if (!inline && match) {
          return <CodeBlock language={match[1]} code={codeValue} pending={streaming} />;
        }
        if (!inline) {
          return <CodeBlock language={null} code={codeValue} pending={streaming} />;
        }

        return (
          <Box
            component="code"
            sx={{
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "grey.800" : "grey.100",
              color: "text.primary",
              px: 0.6,
              py: 0.15,
              borderRadius: "4px",
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: "0.85em",
              wordBreak: "break-word",
            }}
            {...props}
          >
            {children}
          </Box>
        );
      },

      h1: createHeadingComponent("h1"),
      h2: createHeadingComponent("h2"),
      h3: createHeadingComponent("h3"),
      h4: createHeadingComponent("h4"),
      h5: createHeadingComponent("h5"),
      h6: createHeadingComponent("h6"),

      p: ({ children }) => (
        <Typography
          component="p"
          sx={{
            m: 0,
            lineHeight: 1.6,
            fontSize: "15px",
            color: "text.primary",
          }}
        >
          {children}
        </Typography>
      ),

      ul: ({ children }) => (
        <Box component="ul" sx={{ pl: 3, m: 0, my: 1.5 }}>
          {children}
        </Box>
      ),

      ol: ({ children }) => (
        <Box component="ol" sx={{ pl: 3, m: 0, my: 1.5 }}>
          {children}
        </Box>
      ),

      li: ({ children }) => (
        <Typography
          component="li"
          sx={{
            mb: 0.25,
            lineHeight: 1.6,
            fontSize: "15px",
            color: "text.primary",
          }}
        >
          {children}
        </Typography>
      ),

      blockquote({ children }) {
        const alertType = detectAlert(children);
        if (alertType) {
          const cfg = ALERT_CONFIG[alertType];
          return (
            <Box
              sx={{
                borderLeft: "2px solid",
                borderColor: cfg.border,
                bgcolor: cfg.bg,
                borderRadius: "8px",
                pl: 2,
                pr: 1.5,
                py: 1.5,
                my: 2,
                "& p": { m: 0, color: "text.primary", fontSize: "14px" },
                "& p:first-of-type": {
                  fontWeight: 600,
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: cfg.border,
                  mb: 0.5,
                },
              }}
            >
              {children}
            </Box>
          );
        }

        return (
          <Box
            component="blockquote"
            sx={{
              borderLeft: "2px solid",
              borderColor: (t) =>
                t.palette.mode === "dark" ? "grey.800" : "grey.300",
              pl: 2,
              pr: 1.5,
              py: 0.5,
              my: 2,
              color: "text.secondary",
              "& p": { m: 0, fontSize: "14px" },
            }}
          >
            {children}
          </Box>
        );
      },

      a: ({ children, href }) => (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "primary.main",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {children}
        </Link>
      ),

      table: ({ children }) => (
        <Box
          className="markdown-table-container"
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflowX: "auto",
            overflowY: "hidden",
            boxSizing: "border-box",
            my: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px",
            display: "block",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Box
            component="table"
            sx={{
              width: "100%",
              minWidth: "min(620px, 100%)",
              borderCollapse: "collapse",
              display: "table",
              tableLayout: "auto",
              fontSize: "clamp(0.72rem, 1.25vw, 0.875rem)",
              lineHeight: 1.45,
              boxSizing: "border-box",
              "& th, & td": {
                border: "1px solid",
                borderColor: "divider",
                padding:
                  "clamp(6px, 0.9vw, 10px) clamp(8px, 1.1vw, 12px)",
                textAlign: "left",
                fontSize: "inherit",
                lineHeight: 1.45,
                overflowWrap: "anywhere",
                wordBreak: "normal",
                whiteSpace: "normal",
                verticalAlign: "top",
                maxWidth: "min(42ch, 45vw)",
                boxSizing: "border-box",
              },
              "& th": {
                bgcolor: "action.hover",
                fontWeight: 700,
                color: "text.primary",
              },
              "& td": { color: "text.primary" },
              "& tr:nth-of-type(even) td": { bgcolor: "action.hover" },
              "& th code, & td code": {
                fontSize: "0.85em",
                whiteSpace: "break-spaces",
                overflowWrap: "anywhere",
                wordBreak: "normal",
              },
            }}
          >
            {children}
          </Box>
        </Box>
      ),

      img: ({ src, alt }) => (
        <Box
          component="img"
          src={src}
          alt={alt}
          sx={{
            maxWidth: "100%",
            height: "auto",
            my: 2,
            borderRadius: "8px",
            display: "block",
          }}
        />
      ),

      hr: () => (
        <Box
          component="hr"
          sx={{
            border: "none",
            height: "1px",
            bgcolor: "divider",
            my: 2,
          }}
        />
      ),
    }),
    [streaming],
  );

  return (
    <Box
      sx={{
        ...PROSE_SX,
        contentVisibility: "auto",
        containIntrinsicSize: `1px ${intrinsicHeight}px`,
      }}
    >
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${id}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
      {progressive.pendingCode && (
        <CodeBlock
          language={progressive.pendingCode.language}
          code={progressive.pendingCode.code}
          pending
        />
      )}
    </Box>
  );
}
