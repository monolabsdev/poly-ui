# Reliable Chat Title Generation

## Goal

Generate a useful title after the first assistant response with the exact model
selected for that response. Title generation must remain reliable across Ollama
models today and leave a portable path for future OpenAI and Anthropic provider
adapters.

## Current Problems

- `TASK_MODEL` and `TASK_MODEL_EXTERNAL` can silently replace the selected model.
- The first completion attempt does not request structured output.
- Retries increase temperature, making a small formatting task less deterministic.
- The prompt asks for no emoji, but generated titles are not validated for emoji.
- The local fallback can preserve emoji from the user's message.

## Design

The selected response model is authoritative. Title generation receives that
model from the completed stream and uses it unchanged. Task-model environment
overrides are removed from this path.

Title generation uses a provider-neutral options payload. Each attempt first
requests a JSON Schema response shaped as `{ "title": "..." }`, then falls back
to portable JSON mode if the provider or model rejects schema output. Both use
temperature `0`. The provider adapter translates the generic `format` option
into its native request representation. Ollama supports both schema and JSON
formats. Future OpenAI and Anthropic adapters can translate the same intent to
their own structured-output APIs or reject unsupported modes so the fallback
runs.

The parser remains tolerant for backwards compatibility with older Ollama
versions and less capable models. It accepts valid JSON, JSON wrapped in prose
or Markdown fences, and a narrow freeform fallback.

## Validation And Fallback

Generated titles are normalized and validated in code. Titles must be non-empty,
short, free of emoji, and distinct from the user's original prompt or its
leading fragment. Invalid model output triggers the next structured-output
attempt.

If every model attempt fails, a deterministic local fallback derives a title
from the first user message. It removes emoji and control characters, compacts
whitespace, and truncates the result. This ensures a persisted conversation does
not remain titled `New Chat` when a usable user message exists.

## Compatibility

- Existing custom prompt templates continue to work.
- Existing `ENABLE_TITLE_GENERATION` and `TITLE_GENERATION_RETRY` switches remain.
- Relaxed response parsing remains available for older models.
- The title request options remain JSON values so new provider adapters can
  translate them without changing the title generator.
- Existing unrelated working-tree edits are not modified.

## Testing

Rust unit tests cover:

- the selected model remains authoritative;
- schema output is requested before JSON fallback;
- retries remain deterministic;
- emoji titles are rejected;
- local fallback titles remove emoji;
- existing relaxed parsing behavior remains intact.

Verification runs the focused Rust tests followed by the frontend build.
