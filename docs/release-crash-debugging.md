# Release Crash Debugging

PolyUI writes startup diagnostics before the webview is shown.

## Log locations

- Windows: `%APPDATA%/Poly UI/logs/startup.log`
- macOS: `~/Library/Logs/Poly UI/startup.log`

## Run downloaded build with diagnostics

Windows PowerShell:

```powershell
$env:RUST_BACKTRACE="1"
$env:RUST_LOG="debug"
& "$env:LOCALAPPDATA\Programs\Poly UI\PolyUI.exe"
Get-Content "$env:APPDATA\Poly UI\logs\startup.log" -Tail 200
```

macOS Terminal:

```bash
RUST_BACKTRACE=1 RUST_LOG=debug /Applications/PolyUI.app/Contents/MacOS/PolyUI
tail -n 200 "$HOME/Library/Logs/Poly UI/startup.log"
```

## Expected startup phases

The log should include:

- `app entry reached`
- `config loaded`
- `plugins registered`
- `setup hook entered`
- `main window created`
- `frontend loaded`

If the app exits before `frontend loaded`, inspect the last `error:` or `panic:` line in the same file.
