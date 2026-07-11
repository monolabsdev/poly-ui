# Auto-Update: Relaunch App After Install

## Problem

After the auto-update installs a new version, the app exits but does not reopen on Windows and Linux. macOS already handles this via the install script's `open` command. Users must manually relaunch the app.

## Goal

Automatically reopen the app after the update completes on all platforms.

## Current Behavior

- **macOS**: Install script mounts DMG, copies `.app` to `~/Applications/`, runs `open ~/Applications/PolyUI.app`, then removes itself. Works.
- **Windows**: NSIS `.exe` installer is spawned with `.spawn()` (fire-and-forget). App exits after 500ms. No relaunch.
- **Linux**: Install script (AppImage/deb/rpm) is spawned with `.spawn()`. App exits after 500ms. No relaunch.

## Design

All changes in `src-tauri/src/updater.rs`.

### Windows

1. Store the `Child` handle from the NSIS installer `.spawn()`.
2. In the exit thread, call `child.wait()` to block until the installer finishes.
3. Resolve the app exe path via `std::env::current_exe()`.
4. Spawn a detached `cmd /c start "" "<exe_path>"` process with `CREATE_NO_WINDOW` flag (`0x08000000`). This survives if the installer closes the original app.
5. Call `app.exit(0)`.

### macOS

No change. The install script already opens the new app.

### Linux

#### AppImage

No change. The install script uses `exec {package} --no-sandbox`, which replaces the shell process with the new binary.

#### Deb / Rpm

Append a relaunch command to the generated install script, after the package manager block:

```bash
# Relaunch after install
nohup /usr/bin/poly-ui > /dev/null 2>&1 &
```

`nohup` ensures the process survives the script's exit. The binary path comes from the Tauri product name (`poly-ui`).

### Exit Thread

```rust
thread::spawn(move || {
    // Windows: wait for installer, then relaunch (handled above)
    // macOS: script handles relaunch
    // Linux: script handles relaunch for deb/rpm, exec for AppImage
    thread::sleep(Duration::from_millis(500));
    app.exit(0);
});
```

On Windows, the `child.wait()` replaces the fixed sleep. On other platforms, the 500ms delay remains.

## Files Modified

- `src-tauri/src/updater.rs` — `install_update` function and `linux_install_script` function

## Testing

- Manual: run `bun run tauri dev`, trigger update flow, verify app relaunches on current platform
- Unit: existing updater tests should still pass (`bun run test`)
