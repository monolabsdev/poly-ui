# Supertonic Release Runtime Design

## Problem

`st-tts` downloads the platform ONNX Runtime library into Cargo's profile directory. Development works because the library sits beside the debug executable. Tauri does not automatically include that library in release bundles, so `ort` panics on first model load and the IPC request never settles.

## Design

- Bundle the generated release ONNX Runtime library as a Tauri resource on every desktop platform.
- Add `ort` as a direct dependency and initialize it from Tauri's resource directory during app setup, before Supertonic can create a session.
- Preserve development behavior by resolving the library beside the executable when appropriate.
- Keep the existing frontend timeout as defensive recovery for network or runtime failures.

No model files are bundled. Supertonic continues downloading `Supertone/supertonic-3` into its existing writable data directory.

## Error Handling

Failure to locate or load the bundled runtime fails app setup with the concrete path and loader error instead of leaving `load_model` unresolved.

## Verification

- Unit-test runtime path selection.
- Build frontend and run Rust tests.
- Build a release bundle and verify it contains the platform ONNX Runtime library.
- Add CI bundle checks so future releases cannot silently omit the library.
