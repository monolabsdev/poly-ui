pub mod anthropic;
pub mod base;
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
