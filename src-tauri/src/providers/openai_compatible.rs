use crate::models::chat::{
    ChatMessage, ModelDetails, PullProgressPayload, StreamMetadata, StreamPayload, ToolCallInfo,
    ToolDefinition,
};
use crate::providers::base::{LLMProvider, ProviderStatus, ProviderType};
use async_stream::stream;
use async_trait::async_trait;
use futures::Stream;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::pin::Pin;
use tokio_stream::StreamExt;

pub struct OpenAICompatibleProvider {
    client: Client,
    base_url: String,
    api_key: String,
}

impl OpenAICompatibleProvider {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            client: Client::new(),
            base_url: normalize_api_base_url(&base_url),
            api_key,
        }
    }

    async fn models(&self) -> Result<Vec<OpenAIModel>, String> {
        let request = self
            .client
            .get(format!("{}/models", self.base_url));
        let response = self
            .with_optional_auth(request)
            .send()
            .await
            .map_err(normalize_network_error)?;
        parse_response(response)
            .await
            .map(|body: ModelsResponse| body.data)
    }

    fn with_optional_auth(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if self.api_key.trim().is_empty() {
            request
        } else {
            request.bearer_auth(&self.api_key)
        }
    }
}

fn configured_health_status() -> ProviderStatus {
    ProviderStatus::Online
}

#[async_trait]
impl LLMProvider for OpenAICompatibleProvider {
    async fn health_check(&self) -> ProviderStatus {
        configured_health_status()
    }

    async fn chat_completion(
        &self,
        model: String,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        options: Option<Value>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamPayload, String>> + Send>>, String> {
        let request = build_chat_request(&model, messages, system_prompt, options, tools);
        let request = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .json(&request)
            ;
        let response = self
            .with_optional_auth(request)
            .send()
            .await
            .map_err(normalize_network_error)?;

        if !response.status().is_success() {
            return Err(api_error(response).await);
        }

        let mut bytes = response.bytes_stream();
        let stream_model = model.clone();
        let output = stream! {
            let mut parser = SseParser::default();
            let mut pending_tool_calls = BTreeMap::<u64, PendingToolCall>::new();
            let mut metadata = None;
            let mut emitted_done = false;

            while let Some(result) = bytes.next().await {
                let chunk = match result {
                    Ok(chunk) => chunk,
                    Err(error) => {
                        yield Err(normalize_network_error(error));
                        return;
                    }
                };

                for event in parser.push_bytes(&chunk) {
                    if event == "[DONE]" {
                        yield Ok(done_payload(&stream_model, &pending_tool_calls, metadata.clone()));
                        emitted_done = true;
                        break;
                    }

                    match serde_json::from_str::<ChatCompletionChunk>(&event) {
                        Ok(chunk) => {
                            metadata = chunk.usage.map(|usage| stream_metadata(&stream_model, usage)).or(metadata);
                            for choice in chunk.choices {
                                append_tool_call_deltas(&mut pending_tool_calls, choice.delta.tool_calls);
                                if let Some(content) = choice.delta.content {
                                    if !content.is_empty() {
                                        yield Ok(StreamPayload {
                                            request_id: String::new(),
                                            content,
                                            thinking: None,
                                            done: false,
                                            metadata: None,
                                            tool_calls: None,
                                        });
                                    }
                                }
                            }
                        }
                        Err(error) => {
                            yield Err(format!("OpenAI-compatible stream parse failed: {error}"));
                            return;
                        }
                    }
                }

                if emitted_done {
                    return;
                }
            }

            for event in parser.finish() {
                if event == "[DONE]" {
                    yield Ok(done_payload(&stream_model, &pending_tool_calls, metadata.clone()));
                    emitted_done = true;
                    break;
                }
            }

            if !emitted_done {
                yield Ok(done_payload(&stream_model, &pending_tool_calls, metadata));
            }
        };

        Ok(Box::pin(output))
    }

    async fn get_available_models(&self) -> Result<Vec<ModelDetails>, String> {
        self.models().await.map(|models| {
            models
                .into_iter()
                .map(|model| ModelDetails {
                    name: model.id,
                    families: Vec::new(),
                    size: 0,
                    provider_type: ProviderType::OpenAICompatible,
                })
                .collect()
        })
    }

    async fn pull_model(
        &self,
        _model: String,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<PullProgressPayload, String>> + Send>>, String>
    {
        Err("Model pull is only available for Ollama.".to_string())
    }

    async fn delete_model(&self, _model: String) -> Result<(), String> {
        Err("Model deletion is only available for Ollama.".to_string())
    }

    fn get_provider_name(&self) -> String {
        "OpenAI-compatible API".to_string()
    }

    fn get_provider_type(&self) -> ProviderType {
        ProviderType::OpenAICompatible
    }
}

fn normalize_api_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    }
}

fn build_chat_request(
    model: &str,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
    options: Option<Value>,
    tools: Option<Vec<ToolDefinition>>,
) -> Value {
    let mut body = Map::from_iter([
        ("model".to_string(), json!(model)),
        (
            "messages".to_string(),
            Value::Array(build_messages(messages, system_prompt)),
        ),
        ("stream".to_string(), Value::Bool(true)),
    ]);

    if let Some(options) = options.and_then(|value| value.as_object().cloned()) {
        for key in ["temperature", "top_p"] {
            if let Some(value) = options.get(key) {
                body.insert(key.to_string(), value.clone());
            }
        }
        for key in ["max_tokens", "max_completion_tokens"] {
            if let Some(value) = options.get(key) {
                body.insert(key.to_string(), value.clone());
            }
        }
        if let Some(format) = options.get("format").and_then(openai_response_format) {
            body.insert("response_format".to_string(), format);
        }
    }

    if let Some(tools) = tools.filter(|tools| !tools.is_empty()) {
        body.insert(
            "tools".to_string(),
            Value::Array(
                tools
                    .into_iter()
                    .map(|tool| {
                        json!({
                            "type": "function",
                            "function": {
                                "name": tool.name,
                                "description": tool.description,
                                "parameters": tool.parameters,
                            }
                        })
                    })
                    .collect(),
            ),
        );
    }

    Value::Object(body)
}

fn build_messages(messages: Vec<ChatMessage>, system_prompt: Option<String>) -> Vec<Value> {
    let mut output = Vec::new();
    if let Some(prompt) = system_prompt.filter(|prompt| !prompt.trim().is_empty()) {
        output.push(json!({ "role": "system", "content": prompt }));
    }

    output.extend(messages.into_iter().map(|message| match message.role.as_str() {
        "assistant" => {
            let mut value = json!({ "role": "assistant", "content": message.content });
            if let Some(tool_calls) = message.tool_calls.filter(|calls| !calls.is_empty()) {
                value["tool_calls"] = Value::Array(
                    tool_calls
                        .into_iter()
                        .map(|call| {
                            json!({
                                "id": call.id.unwrap_or_else(|| format!("call_{}", uuid::Uuid::new_v4())),
                                "type": "function",
                                "function": {
                                    "name": call.name,
                                    "arguments": arguments_json(&call.arguments),
                                }
                            })
                        })
                        .collect(),
                );
            }
            value
        }
        "tool" => {
            let mut value = json!({ "role": "tool", "content": message.content });
            if let Some(tool_call_id) = message.tool_call_id {
                value["tool_call_id"] = Value::String(tool_call_id);
            }
            value
        }
        _ => user_message_value(message),
    }));

    output
}

fn user_message_value(message: ChatMessage) -> Value {
    let images: Vec<Value> = message
        .attachments
        .unwrap_or_default()
        .into_iter()
        .filter(|attachment| attachment.content_type.starts_with("image/"))
        .filter_map(|attachment| {
            attachment.content.map(|content| {
                json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:{};base64,{}", attachment.content_type, content)
                    }
                })
            })
        })
        .collect();

    if images.is_empty() {
        json!({ "role": "user", "content": message.content })
    } else {
        let mut content = vec![json!({ "type": "text", "text": message.content })];
        content.extend(images);
        json!({ "role": "user", "content": content })
    }
}

fn openai_response_format(format: &Value) -> Option<Value> {
    match format {
        Value::String(value) if value == "json" => Some(json!({ "type": "json_object" })),
        Value::Object(_) => Some(json!({
            "type": "json_schema",
            "json_schema": {
                "name": "response",
                "strict": true,
                "schema": format,
            }
        })),
        _ => None,
    }
}

fn arguments_json(arguments: &Value) -> String {
    match arguments {
        Value::String(value) => value.clone(),
        value => value.to_string(),
    }
}

fn append_tool_call_deltas(
    pending: &mut BTreeMap<u64, PendingToolCall>,
    deltas: Vec<ToolCallDelta>,
) {
    for delta in deltas {
        let call = pending.entry(delta.index).or_default();
        if let Some(id) = delta.id {
            call.id.push_str(&id);
        }
        if let Some(function) = delta.function {
            if let Some(name) = function.name {
                call.name.push_str(&name);
            }
            if let Some(arguments) = function.arguments {
                call.arguments.push_str(&arguments);
            }
        }
    }
}

fn done_payload(
    model: &str,
    pending_tool_calls: &BTreeMap<u64, PendingToolCall>,
    metadata: Option<StreamMetadata>,
) -> StreamPayload {
    let tool_calls: Vec<ToolCallInfo> = pending_tool_calls
        .values()
        .map(|call| ToolCallInfo {
            id: (!call.id.is_empty()).then(|| call.id.clone()),
            name: call.name.clone(),
            arguments: serde_json::from_str(&call.arguments)
                .unwrap_or_else(|_| Value::String(call.arguments.clone())),
        })
        .collect();

    StreamPayload {
        request_id: String::new(),
        content: String::new(),
        thinking: None,
        done: true,
        metadata: metadata.or_else(|| Some(empty_stream_metadata(model))),
        tool_calls: (!tool_calls.is_empty()).then_some(tool_calls),
    }
}

fn empty_stream_metadata(model: &str) -> StreamMetadata {
    StreamMetadata {
        prompt_eval_count: None,
        eval_count: None,
        total_duration: None,
        load_duration: None,
        prompt_eval_duration: None,
        eval_duration: None,
        model: model.to_string(),
    }
}

fn stream_metadata(model: &str, usage: Usage) -> StreamMetadata {
    StreamMetadata {
        prompt_eval_count: usage.prompt_tokens,
        eval_count: usage.completion_tokens,
        ..empty_stream_metadata(model)
    }
}

async fn parse_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T, String> {
    if response.status().is_success() {
        response
            .json()
            .await
            .map_err(|error| format!("OpenAI-compatible API response parse failed: {error}"))
    } else {
        Err(api_error(response).await)
    }
}

async fn api_error(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    format!("OpenAI-compatible API error ({status}): {body}")
}

fn normalize_network_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "OpenAI-compatible API request timed out.".to_string()
    } else {
        format!("Network error reaching OpenAI-compatible API: {error}")
    }
}

#[derive(Default)]
struct SseParser {
    buffer: Vec<u8>,
}

impl SseParser {
    #[cfg(test)]
    fn push(&mut self, chunk: &str) -> Vec<String> {
        self.push_bytes(chunk.as_bytes())
    }

    fn push_bytes(&mut self, chunk: &[u8]) -> Vec<String> {
        self.buffer.extend_from_slice(chunk);
        self.drain(false)
    }

    fn finish(&mut self) -> Vec<String> {
        self.drain(true)
    }

    fn drain(&mut self, finish: bool) -> Vec<String> {
        let mut events = Vec::new();
        while let Some((index, separator_len)) = find_sse_separator(&self.buffer) {
            let block = String::from_utf8_lossy(&self.buffer[..index]).into_owned();
            self.buffer.drain(..index + separator_len);
            if let Some(data) = sse_data(&block) {
                events.push(data);
            }
        }
        if finish && !self.buffer.is_empty() {
            let block = std::mem::take(&mut self.buffer);
            if let Some(data) = sse_data(&String::from_utf8_lossy(&block)) {
                events.push(data);
            }
        }
        events
    }
}

fn find_sse_separator(buffer: &[u8]) -> Option<(usize, usize)> {
    let lf = buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2));
    let crlf = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| (index, 4));
    match (lf, crlf) {
        (Some(left), Some(right)) => Some(if left.0 < right.0 { left } else { right }),
        (Some(found), None) | (None, Some(found)) => Some(found),
        (None, None) => None,
    }
}

fn sse_data(block: &str) -> Option<String> {
    let data: Vec<&str> = block
        .lines()
        .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
        .collect();
    (!data.is_empty()).then(|| data.join("\n"))
}

#[derive(Deserialize)]
struct ModelsResponse {
    data: Vec<OpenAIModel>,
}

#[derive(Deserialize)]
struct OpenAIModel {
    id: String,
}

#[derive(Deserialize)]
struct ChatCompletionChunk {
    #[serde(default)]
    choices: Vec<ChatCompletionChoice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct ChatCompletionChoice {
    #[serde(default)]
    delta: ChatCompletionDelta,
}

#[derive(Default, Deserialize)]
struct ChatCompletionDelta {
    content: Option<String>,
    #[serde(default)]
    tool_calls: Vec<ToolCallDelta>,
}

#[derive(Deserialize)]
struct ToolCallDelta {
    index: u64,
    id: Option<String>,
    function: Option<ToolCallFunctionDelta>,
}

#[derive(Deserialize)]
struct ToolCallFunctionDelta {
    name: Option<String>,
    arguments: Option<String>,
}

#[derive(Default)]
struct PendingToolCall {
    id: String,
    name: String,
    arguments: String,
}

#[derive(Deserialize)]
struct Usage {
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::chat::{ChatMessage, ToolCallInfo};

    #[test]
    fn normalizes_api_base_url() {
        assert_eq!(
            normalize_api_base_url("https://api.openai.com/v1/"),
            "https://api.openai.com/v1"
        );
        assert_eq!(
            normalize_api_base_url("localhost:1234/v1"),
            "http://localhost:1234/v1"
        );
    }

    #[test]
    fn configured_health_status_does_not_require_model_catalog_fetch() {
        assert_eq!(configured_health_status(), ProviderStatus::Online);
    }

    #[test]
    fn builds_tool_followup_messages_with_openai_ids() {
        let messages = vec![
            ChatMessage {
                role: "assistant".into(),
                content: String::new(),
                attachments: None,
                tool_calls: Some(vec![ToolCallInfo {
                    id: Some("call_123".into()),
                    name: "web_search".into(),
                    arguments: serde_json::json!({ "query": "news" }),
                }]),
                tool_call_id: None,
            },
            ChatMessage {
                role: "tool".into(),
                content: "result".into(),
                attachments: None,
                tool_calls: None,
                tool_call_id: Some("call_123".into()),
            },
        ];

        let value = build_messages(messages, None);

        assert_eq!(value[0]["tool_calls"][0]["id"], "call_123");
        assert_eq!(value[1]["tool_call_id"], "call_123");
    }

    #[test]
    fn does_not_send_ollama_num_predict_to_openai_api() {
        let request = build_chat_request(
            "gpt-test",
            Vec::new(),
            None,
            Some(serde_json::json!({ "num_predict": 80 })),
            None,
        );

        assert!(request.get("max_tokens").is_none());
        assert!(request.get("max_completion_tokens").is_none());
    }

    #[test]
    fn sends_explicit_openai_completion_token_limit() {
        let request = build_chat_request(
            "gpt-test",
            Vec::new(),
            None,
            Some(serde_json::json!({ "max_completion_tokens": 80 })),
            None,
        );

        assert_eq!(request["max_completion_tokens"], 80);
    }

    #[test]
    fn parses_fragmented_sse_events() {
        let mut parser = SseParser::default();

        assert!(parser
            .push("data: {\"choices\":[{\"delta\":{\"content\":\"hel")
            .is_empty());
        assert_eq!(
            parser.push("lo\"}}]}\n\ndata: [DONE]\n\n"),
            vec![
                "{\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}".to_string(),
                "[DONE]".to_string(),
            ]
        );
    }

    #[test]
    fn preserves_utf8_split_across_http_chunks() {
        let mut parser = SseParser::default();
        let event = b"data: {\"choices\":[{\"delta\":{\"content\":\"\xC2\xA3\"}}]}\n\n";
        let split = event.iter().position(|byte| *byte == 0xC2).unwrap() + 1;

        assert!(parser.push_bytes(&event[..split]).is_empty());
        assert_eq!(
            parser.push_bytes(&event[split..]),
            vec!["{\"choices\":[{\"delta\":{\"content\":\"\u{00A3}\"}}]}".to_string()]
        );
    }
}
