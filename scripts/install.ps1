$ErrorActionPreference = "Stop"

$repo = if ($env:POLYUI_REPO) { $env:POLYUI_REPO } else { "monolabsdev/poly-ui" }
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"

$archPattern = switch ($env:PROCESSOR_ARCHITECTURE) {
  "ARM64" { "arm64|aarch64" }
  default { "x64|amd64|x86_64" }
}

$asset = $release.assets |
  Where-Object { $_.name -notmatch "ollama" -and $_.name -match $archPattern -and ($_.name -match "setup\.exe$" -or $_.name -match "\.msi$") } |
  Select-Object -First 1

if (-not $asset) {
  $asset = $release.assets |
    Where-Object { $_.name -notmatch "ollama" -and ($_.name -match "setup\.exe$" -or $_.name -match "\.msi$") } |
    Select-Object -First 1
}

if (-not $asset) {
  throw "No matching PolyUI Windows release asset found."
}

$file = Join-Path $env:TEMP $asset.name
Invoke-WebRequest $asset.browser_download_url -OutFile $file

if ($file -match "\.msi$") {
  Start-Process "msiexec.exe" -ArgumentList "/i", "`"$file`"" -Wait
} else {
  Start-Process $file -Wait
}

Write-Host "PolyUI installed."
