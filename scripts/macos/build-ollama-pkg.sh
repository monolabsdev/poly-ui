#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/PolyUI.app"
PKG_ROOT="$ROOT_DIR/src-tauri/target/release/ollama-pkg-root"
PKG_SCRIPTS="$ROOT_DIR/src-tauri/target/release/ollama-pkg-scripts"
PKG_OUTPUT_DIR="$ROOT_DIR/src-tauri/target/release/bundle/pkg"
PKG_OUTPUT="$PKG_OUTPUT_DIR/PolyUI-Ollama.pkg"
KEYCHAIN_PATH="$RUNNER_TEMP/polyui-installer-signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -hex 16)"
CERTIFICATE_PATH="$RUNNER_TEMP/polyui-installer-certificate.p12"

: "${APPLE_INSTALLER_CERTIFICATE:?APPLE_INSTALLER_CERTIFICATE must contain a base64-encoded Developer ID Installer certificate}"
: "${APPLE_INSTALLER_CERTIFICATE_PASSWORD:?APPLE_INSTALLER_CERTIFICATE_PASSWORD must be set}"
: "${APPLE_INSTALLER_SIGNING_IDENTITY:?APPLE_INSTALLER_SIGNING_IDENTITY must be set to the Developer ID Installer identity}"
: "${APPLE_ID:?APPLE_ID must be set for package notarization}"
: "${APPLE_PASSWORD:?APPLE_PASSWORD must be set to an app-specific password for package notarization}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID must be set for package notarization}"

cleanup() {
  rm -f "$CERTIFICATE_PATH"
  security delete-keychain "$KEYCHAIN_PATH" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ ! -d "$APP_PATH" ]]; then
  bun run tauri build -- --bundles app
fi

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
if ! codesign --display --verbose=4 "$APP_PATH" 2>&1 | grep -q "Authority=Developer ID Application:"; then
  echo "The embedded app must be signed with a Developer ID Application certificate before packaging." >&2
  exit 1
fi

rm -rf "$PKG_ROOT" "$PKG_SCRIPTS"
mkdir -p "$PKG_ROOT/Applications" "$PKG_SCRIPTS" "$PKG_OUTPUT_DIR"

ditto "$APP_PATH" "$PKG_ROOT/Applications/PolyUI.app"
cp "$ROOT_DIR/scripts/macos/postinstall" "$PKG_SCRIPTS/postinstall"
chmod 755 "$PKG_SCRIPTS/postinstall"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
echo "$APPLE_INSTALLER_CERTIFICATE" | base64 -D > "$CERTIFICATE_PATH"
security import "$CERTIFICATE_PATH" \
  -k "$KEYCHAIN_PATH" \
  -P "$APPLE_INSTALLER_CERTIFICATE_PASSWORD" \
  -T /usr/bin/productsign \
  -T /usr/bin/pkgbuild
security set-key-partition-list \
  -S apple-tool:,apple:,codesign: \
  -s \
  -k "$KEYCHAIN_PASSWORD" \
  "$KEYCHAIN_PATH"

pkgbuild \
  --root "$PKG_ROOT" \
  --scripts "$PKG_SCRIPTS" \
  --identifier "com.tslater.polyui.ollama" \
  --version "$(cd "$ROOT_DIR" && node -p "require('./package.json').version")" \
  --install-location "/" \
  --sign "$APPLE_INSTALLER_SIGNING_IDENTITY" \
  --keychain "$KEYCHAIN_PATH" \
  "$PKG_OUTPUT"

pkgutil --check-signature "$PKG_OUTPUT"
xcrun notarytool submit "$PKG_OUTPUT" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "$PKG_OUTPUT"
xcrun stapler validate "$PKG_OUTPUT"

echo "Built $PKG_OUTPUT"
