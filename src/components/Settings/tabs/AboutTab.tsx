import { Link, Stack, Typography } from "@mui/material";
import { SettingCard, SectionHeader } from "../SettingComponents";

declare const __APP_VERSION__: string;

const APP_REPO = "https://github.com/theoslater/polyui";

export function AboutTab() {
  return (
    <Stack spacing={0}>
      <SectionHeader title="About" />

      <SettingCard title="PolyUI">
        <Stack spacing={1}>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            Version {__APP_VERSION__}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.6 }}>
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
      </SettingCard>
    </Stack>
  );
}
