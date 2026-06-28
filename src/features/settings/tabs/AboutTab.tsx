import { useEffect, useState } from "react";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { SettingCard, SectionHeader } from "../SettingComponents";
import { getBundledAppVersion, getInstalledAppVersion } from "@/lib/utils/appVersion";

const APP_REPO = "https://github.com/theoslater/polyui";

export function AboutTab() {
  const [version, setVersion] = useState(() => getBundledAppVersion());

  useEffect(() => {
    let cancelled = false;
    void getInstalledAppVersion().then((installedVersion) => {
      if (!cancelled && installedVersion) setVersion(installedVersion);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack spacing={0}>
      <SectionHeader title="About" />

      <SettingCard title="PolyUI">
        <Stack spacing={1}>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            Version {version ?? "unknown"}
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
