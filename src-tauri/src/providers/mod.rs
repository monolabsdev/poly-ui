pub mod base;
// TODO: Create anthropic.rs — implements ChatProvider + ModelCatalog for Anthropic's native API.
// Reference openai_compatible.rs for the SSE streaming pattern.
// Key differences from OpenAI format:
//   - Endpoint: {base_url}/messages (not /chat/completions)
//   - Auth header: x-api-key (not Authorization: Bearer)
//   - Anthropic-version header required (e.g. "2023-06-01")
//   - System prompt is a top-level "system" field, not a message
//   - Tools are [{name, description, input_schema}] (no function wrapper)
//   - Streaming events: message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop
//   - Tool use arrives as content_block_type="tool_use" with partial JSON input deltas
//   - Extended thinking: model returns "thinking" content blocks before response
pub mod anthropic;
pub mod factory;
// TODO: Create gemini.rs — implements ChatProvider + ModelCatalog for Google's native Gemini API.
// Reference openai_compatible.rs for the SSE streaming pattern.
// Key differences from OpenAI format:
//   - Endpoint: {base_url}/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}
//   - Auth is ?key= query param (not a header)
//   - Messages use "contents" array with "parts" (role + parts[], not role + content string)
//   - System instruction goes in "systemInstruction" top-level field
//   - Tools: tools[0].function_declarations[] with {name, description, parameters}
//   - Streaming: servercontent events with candidates[0].content.parts[]
//   - Tool calls arrive as functionCall parts {functionCall: {name, args}}
//   - Tool results go in "functionResponse" parts
//   - Model list endpoint: {base_url}/v1beta/models?key={api_key}
pub mod gemini;
pub mod ollama;
pub mod openai_compatible;
pub mod profile;
pub mod selector;

pub use selector::ProviderSelector;
