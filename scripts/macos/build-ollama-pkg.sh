#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/Openbench AI.app"
PKG_ROOT="$ROOT_DIR/src-tauri/target/release/ollama-pkg-root"
PKG_SCRIPTS="$ROOT_DIR/src-tauri/target/release/ollama-pkg-scripts"
PKG_OUTPUT_DIR="$ROOT_DIR/src-tauri/target/release/bundle/pkg"
PKG_OUTPUT="$PKG_OUTPUT_DIR/Openbench-AI-Ollama.pkg"

if [[ ! -d "$APP_PATH" ]]; then
  bun run tauri build -- --bundles app
fi

rm -rf "$PKG_ROOT" "$PKG_SCRIPTS"
mkdir -p "$PKG_ROOT/Applications" "$PKG_SCRIPTS" "$PKG_OUTPUT_DIR"

ditto "$APP_PATH" "$PKG_ROOT/Applications/Openbench AI.app"
cp "$ROOT_DIR/scripts/macos/postinstall" "$PKG_SCRIPTS/postinstall"
chmod 755 "$PKG_SCRIPTS/postinstall"

pkgbuild \
  --root "$PKG_ROOT" \
  --scripts "$PKG_SCRIPTS" \
  --identifier "com.tslater.openbench.ollama" \
  --version "$(cd "$ROOT_DIR" && node -p "require('./package.json').version")" \
  --install-location "/" \
  "$PKG_OUTPUT"

echo "Built $PKG_OUTPUT"
