// TODO: Implement Anthropic native provider.
//
// This file should implement ChatProvider + ModelCatalog for Anthropic's Messages API.
// Reference openai_compatible.rs for the overall SSE streaming pattern.
//
// ## API details
// - Endpoint: POST {base_url}/messages
// - Auth: x-api-key header (NOT Authorization: Bearer)
// - Required header: anthropic-version: 2023-06-01
// - Content-Type: application/json
//
// ## Request body
// {
//   "model": "claude-sonnet-4-20250514",
//   "max_tokens": 4096,
//   "system": "...",           // top-level, not a message
//   "messages": [...],
//   "tools": [                 // top-level, no "function" wrapper
//     { "name": "...", "description": "...", "input_schema": {...} }
//   ],
//   "stream": true,
//   "thinking": { "type": "enabled", "budget_tokens": 10000 }  // optional
// }
//
// ## SSE event format
// event: message_start
// data: {"type":"message_start","message":{"id":"msg_...","role":"assistant","content":[],...}}
//
// event: content_block_start
// data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
//
// event: content_block_delta
// data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
//
// event: content_block_stop
// data: {"type":"content_block_stop","index":0}
//
// event: message_delta  (final: stop_reason, usage)
// data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}
//
// event: message_stop
// data: {"type":"message_stop"}
//
// ## Tool calls arrive as content blocks
// content_block_start with type="tool_use" and {id, name}
// content_block_delta with type="input_json_delta" and partial JSON
// On message_stop, accumulate all tool_use blocks into ToolCallInfo[]
//
// ## Message conversion
// - User messages: { "role": "user", "content": [...] }
//   - Text: { "type": "text", "text": "..." }
//   - Images: { "type": "image", "source": { "type": "base64", "media_type": "...", "data": "..." } }
// - Assistant messages: { "role": "assistant", "content": [...] }
//   - Text blocks, tool_use blocks
// - Tool results: { "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "...", "content": "..." }] }
//
// ## Model catalog
// GET {base_url}/models requires anthropic-version header.
// Returns { data: [{ id, display_name, created_at, ... }] }

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

pub struct AnthropicNativeProvider {
    client: Client,
    base_url: String,
    api_key: String,
}

impl AnthropicNativeProvider {
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        Self {
            client: Client::new(),
            base_url,
            api_key: api_key.unwrap_or_default(),
        }
    }

    // TODO: Implement build_request_body(messages, system_prompt, tools, options)
    // - Convert ChatMessage Vec to Anthropic messages format
    // - Move system_prompt to top-level "system" field
    // - Convert ToolDefinition Vec to Anthropic tools format (input_schema, not function wrapper)
    // - Handle image attachments via base64 source blocks
    // - Handle tool_call_id references for tool result messages

    // TODO: Implement parse_sse_event(line: &str) -> Option<Value>
    // Anthropic SSE uses "event: <type>" + "data: <json>" lines.
    // Extract the data payload and return parsed JSON.

    // TODO: Implement convert_content_blocks(blocks: &[Value]) -> (String, Option<String>, Vec<ToolCallInfo>)
    // Iterate content blocks, extract text into content string,
    // extract thinking blocks into thinking string,
    // accumulate tool_use blocks into ToolCallInfo vec.
}

#[async_trait]
impl ChatProvider for AnthropicNativeProvider {
    async fn health_check(&self) -> ProviderStatus {
        // TODO: GET {base_url}/models with x-api-key header.
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
        // POST {base_url}/messages with headers:
        //   x-api-key: {api_key}
        //   anthropic-version: 2023-06-01
        //   content-type: application/json
        //   { "model": ..., "max_tokens": ..., "system": ..., "messages": ..., "tools": ..., "stream": true }

        // TODO: Implement streaming SSE loop (reference openai_compatible.rs lines ~100-250)
        // 1. Send POST request, get response bytes_stream
        // 2. Buffer lines, split on \n
        // 3. Parse "event:" and "data:" lines
        // 4. For content_block_delta (text_delta): yield StreamPayload { content: delta.text, done: false }
        // 5. For content_block_start (thinking): switch to thinking accumulator
        // 6. For content_block_delta (input_json_delta): accumulate tool call JSON
        // 7. For message_delta: extract stop_reason, token usage into StreamMetadata
        // 8. For message_stop: yield final StreamPayload { done: true, tool_calls, metadata }

        todo!("AnthropicNative chat_completion not yet implemented")
    }

    fn get_provider_name(&self) -> String {
        "Anthropic".to_string()
    }

    fn get_provider_type(&self) -> ProviderType {
        ProviderType::AnthropicNative
    }
}

#[async_trait]
impl ModelCatalog for AnthropicNativeProvider {
    async fn get_available_models(&self) -> Result<Vec<ModelDetails>, String> {
        // TODO: GET {base_url}/models with x-api-key + anthropic-version headers.
        // Parse response: { data: [{ id: "claude-sonnet-4-20250514", ... }] }
        // Map to ModelDetails { name: id, families: vec!["claude".into()], size: 0, provider_type, provider_config_id: None }
        todo!("AnthropicNative model catalog not yet implemented")
    }

    fn get_provider_type(&self) -> ProviderType {
        ProviderType::AnthropicNative
    }
}
