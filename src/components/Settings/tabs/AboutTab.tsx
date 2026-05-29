import { Box, Link, Stack, Typography } from "@mui/material";

declare const __APP_VERSION__: string;

const APP_REPO = "https://github.com/theoslater/polyui";

export function AboutTab() {
  return (
    <Stack spacing={0}>
      <Box sx={{ px: 2.5, py: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography
              sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}
            >
              PolyUI
            </Typography>
            <Typography
              sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}
            >
              Version {__APP_VERSION__}
            </Typography>
          </Box>

          <Typography
            sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}
          >
            Desktop chat app for local LLM experiments via Ollama.
          </Typography>

          <Link
            href={APP_REPO}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontSize: 12,
              color: "primary.main",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            View on GitHub
          </Link>
        </Stack>
      </Box>
    </Stack>
  );
}
