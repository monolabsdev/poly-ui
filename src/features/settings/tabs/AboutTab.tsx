import { useEffect, useState } from "react";
import { Link } from "@/components/ui/link";
import { Stack } from "@/components/ui/Stack";
import { Typography } from "@/components/ui/Typography";
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
          <Typography>
            Version {version ?? "unknown"}
          </Typography>
          <Typography>
            Desktop chat app for local LLM experiments via Ollama.
          </Typography>
          <Link
            href={APP_REPO}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </Link>
        </Stack>
      </SettingCard>
    </Stack>
  );
}
