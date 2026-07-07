import { useEffect, useState } from "react";
import { Copy, RefreshCw, Square } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Stack } from "@/components/ui/Stack";
import { Typography } from "@/components/ui/Typography";
import { SettingRow, SettingsSection } from "../SettingsShell";

type MobilePairingInfo = {
  url: string;
  httpBaseUrl: string;
  host: string;
  port: number;
  token: string;
};

export function MobileTab() {
  const [pairing, setPairing] = useState<MobilePairingInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void invoke<MobilePairingInfo | null>("mobile_pairing_status")
      .then((info) => {
        if (!cancelled) setPairing(info);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function startPairing() {
    setBusy(true);
    setMessage(null);
    try {
      setPairing(await invoke<MobilePairingInfo>("mobile_pairing_start"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function stopPairing() {
    setBusy(true);
    setMessage(null);
    try {
      await invoke("mobile_pairing_stop");
      setPairing(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.url);
      setMessage("Pairing URL copied.");
    } catch {
      setMessage("Copy failed. Select the pairing URL and copy it manually.");
    }
  }

  return (
    <SettingsSection
      title="Mobile Pairing"
      description="Connect a future PolyUI mobile app from the same Wi-Fi network."
    >
      <SettingRow
        title={pairing ? "Pairing is active" : "Start Wi-Fi pairing"}
        description={
          pairing
            ? `Listening at ${pairing.httpBaseUrl}. Keep this window open while pairing.`
            : "Creates a temporary QR code. No cloud server or account required."
        }
        action={
          pairing ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={stopPairing} startIcon={<Square />}>
              Stop
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={startPairing} startIcon={<RefreshCw />}>
              Start Pairing
            </Button>
          )
        }
      >
        {pairing ? (
          <Stack spacing={3}>
            <div className="w-fit rounded-xl border border-border/60 bg-white p-3">
              <QRCodeSVG value={pairing.url} size={184} marginSize={1} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {pairing.url}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyUrl} startIcon={<Copy />}>
                Copy
              </Button>
            </div>
          </Stack>
        ) : null}
        {message ? <Typography className="text-sm text-muted-foreground">{message}</Typography> : null}
      </SettingRow>
      <SettingRow
        title="Connection limits"
        description="Phone and computer must be on the same Wi-Fi. Firewall or VPN settings can block pairing."
      />
    </SettingsSection>
  );
}
