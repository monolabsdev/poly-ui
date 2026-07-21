// TODO: Implement Google Gemini native provider.
//
// This file should implement ChatProvider + ModelCatalog for Google's Gemini API.
// Reference openai_compatible.rs for the overall SSE streaming pattern.
//
// ## API details
// - Streaming endpoint: POST {base_url}/models/{model}:streamGenerateContent?alt=sse&key={api_key}
// - Non-streaming: POST {base_url}/models/{model}:generateContent?key={api_key}
// - Auth: API key as ?key= query parameter (NOT a header)
// - Content-Type: application/json
//
// ## Request body (streaming)
// {
//   "contents": [
//     { "role": "user", "parts": [{ "text": "Hello" }] },
//     { "role": "model", "parts": [{ "text": "Hi!" }] },
//     ...
//   ],
//   "systemInstruction": { "parts": [{ "text": "You are..." }] },  // top-level
//   "tools": [
//     { "functionDeclarations": [         // note: plural "Declarations"
//       { "name": "...", "description": "...", "parameters": {...} }
//     ]}
//   ],
//   "generationConfig": {
//     "temperature": 0.7,
//     "maxOutputTokens": 4096
//   }
// }
//
// ## SSE event format
// Each SSE line is a JSON object (no event: field, just data: lines).
// data: {"candidates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"},"finishReason":"STOP","index":0}],"usageMetadata":{...}}
//
// Tool calls arrive as:
// data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"web_search","args":{"query":"..."}}}],"role":"model"}}]}
//
// ## Message conversion
// - User messages: { "role": "user", "parts": [{ "text": "..." }] }
//   - Images: { "inlineData": { "mimeType": "...", "data": "base64..." } }
// - Model messages: { "role": "model", "parts": [{ "text": "..." }] }
// - Tool results: { "role": "user", "parts": [{ "functionResponse": { "name": "...", "response": {...} } }] }
//   Note: Gemini requires tool results as "user" role with functionResponse parts.
//
// ## Model catalog
// GET {base_url}/models?key={api_key}
// Returns { models: [{ name: "models/gemini-2.5-pro", displayName: "...", ... }] }
// Strip "models/" prefix from name.

use crate::models::chat::{
    ChatMessage, ModelDetails, StreamMetadata, StreamPayload, ToolCallInfo, ToolDefinition,
};
use crate::providers::base::{ChatProvider, ModelCatalog, ProviderStatus, ProviderType};
use async_stream::stream;
use async_trait::async_trait;
use futures::Stream;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::pin::Pin;
use tokio_stream::StreamExt;

pub struct GeminiNativeProvider {
    client: Client,
    base_url: String,
    api_key: String,
}

impl GeminiNativeProvider {
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        Self {
            client: Client::new(),
            base_url,
            api_key: api_key.unwrap_or_default(),
        }
    }

    // TODO: Implement build_request_body(messages, system_instruction, tools, options)
    // - Convert ChatMessage Vec to Gemini contents format (role + parts[])
    // - Move system_prompt to top-level systemInstruction.parts[{text}]
    // - Convert ToolDefinition Vec to tools[0].functionDeclarations[]
    // - Handle image attachments via inlineData { mimeType, data }
    // - Handle tool_call_id: find original tool_use by id, include functionResponse parts
    // - Note: tool results must use role "user" (not "tool")
    // - Map options to generationConfig (temperature, maxOutputTokens, etc.)

    // TODO: Implement convert_candidate(candidate: &Value) -> (String, Option<String>, Vec<ToolCallInfo>, Option<String>)
    // - Extract text from parts where part.text exists → content string
    // - Extract thoughts from parts where part.thought == true → thinking string
    // - Extract functionCall parts → ToolCallInfo vec
    // - Extract finishReason → stop_reason string
}

#[async_trait]
impl ChatProvider for GeminiNativeProvider {
    async fn health_check(&self) -> ProviderStatus {
        // TODO: GET {base_url}/models?key={api_key}
        // Return Online if 200, Offline otherwise.
        ProviderStatus::Unavailable
    }

    async fn chat_completion(
        &self,
        model: String,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        options: Option<Value>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamPayload, String>> + Send>>, String> {
        let client = self.client.clone();
        let base_url = self.base_url.clone();
        let api_key = self.api_key.clone();
        let request_id = uuid::Uuid::new_v4().to_string();

        // TODO: Build request body using build_request_body()
        // POST {base_url}/models/{model}:streamGenerateContent?alt=sse&key={api_key}
        // Headers: content-type: application/json (no auth header needed)

        // TODO: Implement streaming SSE loop (reference openai_compatible.rs)
        // 1. Send POST request, get response bytes_stream
        // 2. Buffer lines, split on \n
        // 3. Each "data: " line contains a full JSON object
        // 4. Parse candidates[0].content.parts[] from each event
        // 5. For text parts: yield StreamPayload { content: part.text, done: false }
        // 6. For thought parts: yield StreamPayload { thinking: part.text, done: false }
        // 7. For functionCall parts: accumulate into ToolCallInfo vec
        // 8. When finishReason is present: yield StreamPayload { done: true, tool_calls, metadata }
        // 9. Extract usageMetadata for token counts in StreamMetadata

        todo!("GeminiNative chat_completion not yet implemented")
    }

    fn get_provider_name(&self) -> String {
        "Gemini".to_string()
    }

    fn get_provider_type(&self) -> ProviderType {
        ProviderType::GeminiNative
    }
}

#[async_trait]
impl ModelCatalog for GeminiNativeProvider {
    async fn get_available_models(&self) -> Result<Vec<ModelDetails>, String> {
        // TODO: GET {base_url}/models?key={api_key}
        // Parse response: { models: [{ name: "models/gemini-2.5-pro", displayName: "...", ... }] }
        // Strip "models/" prefix from name field.
        // Map to ModelDetails { name, families: vec!["gemini".into()], size: 0, provider_type, provider_config_id: None }
        // Filter to only chat-capable models (exclude embedding, TTS, etc.)
        todo!("GeminiNative model catalog not yet implemented")
    }

    fn get_provider_type(&self) -> ProviderType {
        ProviderType::GeminiNative
    }
}
