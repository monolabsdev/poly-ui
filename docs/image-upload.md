# Image Upload Pipeline

Draft image previews use `blob:` object URLs. This avoids base64 expansion and keeps large image bytes out of React state while composing a message. URLs are revoked when a draft is removed or sent.

Validation runs before decode. Supported draft image formats are JPEG, PNG, WebP, GIF, and AVIF. Limits live in `src/lib/image-upload/config.ts`.

Metadata decode prefers `createImageBitmap`, with an `HTMLImageElement` fallback. `worker.ts` exposes progressive image optimization using `OffscreenCanvas` when available. It never upscales and keeps the original when compression saves less than 10%. Unsupported WebViews keep the original.

Model providers currently require base64 image payloads. Encoding therefore happens only at send time. There is no remote file endpoint, so the Tauri upload plugin is not useful for this flow.

`UploadQueue` provides isolated controlled concurrency, pending cancellation, and retry support for future remote upload paths. One failure does not stop other queued items.

## Manual Checks

- Add a large image and confirm preview appears immediately.
- Add more than eight images and confirm clear rejection.
- Drop corrupt and unsupported files and confirm errors.
- Remove a draft image and confirm preview disappears.
- Send JPEG, PNG, WebP, GIF, and AVIF images to compatible models.
- Test desktop drag/drop in Tauri on each supported OS.
