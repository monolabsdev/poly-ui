#!/bin/sh
set -eu

REPO="${POLYUI_REPO:-monolabsdev/poly-ui}"
API="https://api.github.com/repos/$REPO/releases/latest"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  elif command -v pkexec >/dev/null 2>&1; then
    pkexec "$@"
  else
    echo "Install needs sudo, pkexec, or root." >&2
    exit 1
  fi
}

asset_urls() {
  curl -fsSL "$API" | sed -n 's/.*"browser_download_url": "\([^"]*\)".*/\1/p'
}

pick_asset() {
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) arch_pattern='x64|amd64|x86_64' ;;
    arm64|aarch64) arch_pattern='arm64|aarch64' ;;
    *) arch_pattern="$arch" ;;
  esac

  urls="$(asset_urls | grep -Eiv 'ollama' | grep -Ei "$arch_pattern" || true)"
  [ -n "$urls" ] || urls="$(asset_urls | grep -Eiv 'ollama')"

  case "$os" in
    darwin) printf '%s\n' "$urls" | grep -Ei '\.dmg$|macos|darwin' | head -n 1 ;;
    linux)
      if command -v apt >/dev/null 2>&1 || command -v dpkg >/dev/null 2>&1; then
        asset="$(printf '%s\n' "$urls" | grep -Ei '\.deb$' | head -n 1 || true)"
      elif command -v dnf >/dev/null 2>&1 || command -v zypper >/dev/null 2>&1 || command -v rpm >/dev/null 2>&1; then
        asset="$(printf '%s\n' "$urls" | grep -Ei '\.rpm$' | head -n 1 || true)"
      else
        asset=""
      fi
      [ -n "$asset" ] || asset="$(printf '%s\n' "$urls" | grep -Ei '\.appimage$' | head -n 1 || true)"
      [ -n "$asset" ] || asset="$(printf '%s\n' "$urls" | grep -Ei '\.deb$|\.rpm$' | head -n 1 || true)"
      printf '%s\n' "$asset"
      ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
}

install_file() {
  file="$1"
  case "$file" in
    *.dmg)
      need hdiutil
      volume="$(hdiutil attach -quiet -nobrowse "$file" | tail -1 | awk '{print $NF}')"
      mkdir -p "$HOME/Applications"
      cp -R "$volume/PolyUI.app" "$HOME/Applications/"
      hdiutil detach -quiet "$volume"
      ;;
    *.deb)
      if command -v apt >/dev/null 2>&1; then
        run_as_root env DEBIAN_FRONTEND=noninteractive apt install -y "$file"
      else
        run_as_root dpkg -i "$file"
      fi
      ;;
    *.rpm)
      if command -v dnf >/dev/null 2>&1; then
        run_as_root dnf install -y "$file"
      elif command -v zypper >/dev/null 2>&1; then
        run_as_root zypper install -y "$file"
      else
        run_as_root rpm -Uvh "$file"
      fi
      ;;
    *.AppImage|*.appimage)
      chmod +x "$file"
      mkdir -p "$HOME/.local/bin"
      cp "$file" "$HOME/.local/bin/polyui.AppImage"
      ;;
    *) echo "Unsupported asset: $file" >&2; exit 1 ;;
  esac
}

need curl
url="$(pick_asset)"
[ -n "$url" ] || {
  echo "No matching PolyUI release asset found." >&2
  exit 1
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
file="$tmp_dir/${url##*/}"

curl -fL "$url" -o "$file"
install_file "$file"
echo "PolyUI installed."
