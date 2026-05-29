use crate::models::chat::{
    ChatMessage, SearchResultItem, StreamMetadata, StreamPayload, ThinkingPayload, ToolCallInfo,
    ToolDefinition, WebSearchEvent,
};
use crate::title_generator;
use crate::web_search;
use crate::AppState;
use serde_json::Value;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tokio_stream::StreamExt;

const THINK_START_TAGS: [&str; 2] = ["<think>", "<|channel>thought"];
const THINK_END_TAGS: [&str; 2] = ["</think>", "<channel|>"];

struct ThinkingTagParser {
    enabled: bool,
    in_thinking: bool,
    buffer: String,
}

impl ThinkingTagParser {
    fn new(enabled: bool) -> Self {
        Self {
            enabled,
            in_thinking: false,
            buffer: String::new(),
        }
    }

    fn push(&mut self, chunk: &str) -> (String, String) {
        if !self.enabled {
            return (chunk.to_string(), String::new());
        }

        self.buffer.push_str(chunk);
        self.drain(false)
    }

    fn finish(&mut self) -> (String, String) {
        if !self.enabled {
            return (String::new(), String::new());
        }

        let drained = self.drain(true);
        self.in_thinking = false;
        drained
    }

    fn drain(&mut self, finish: bool) -> (String, String) {
        let mut content = String::new();
        let mut thinking = String::new();

        loop {
            if self.in_thinking {
                if let Some((idx, tag)) = find_first_tag(&self.buffer, &THINK_END_TAGS) {
                    thinking.push_str(&self.buffer[..idx]);
                    self.buffer.drain(..idx + tag.len());
                    self.in_thinking = false;
                    continue;
                }

                let keep = if finish {
                    0
                } else {
                    THINK_END_TAGS
                        .iter()
                        .map(|tag| tag.len())
                        .max()
                        .unwrap_or(0)
                        - 1
                };
                if self.buffer.len() > keep {
                    let split_at = safe_split_index(&self.buffer, self.buffer.len() - keep);
                    thinking.push_str(&self.buffer[..split_at]);
                    self.buffer.drain(..split_at);
                }
                break;
            }

            if let Some((idx, tag)) = find_first_tag(&self.buffer, &THINK_START_TAGS) {
                content.push_str(&self.buffer[..idx]);
                self.buffer.drain(..idx + tag.len());
                self.in_thinking = true;
                if self.buffer.starts_with('\n') {
                    self.buffer.drain(..1);
                }
                continue;
            }

            let keep = if finish {
                0
            } else {
                THINK_START_TAGS
                    .iter()
                    .map(|tag| tag.len())
                    .max()
                    .unwrap_or(0)
                    - 1
            };
            if self.buffer.len() > keep {
                let split_at = safe_split_index(&self.buffer, self.buffer.len() - keep);
                content.push_str(&self.buffer[..split_at]);
                self.buffer.drain(..split_at);
            }
            break;
        }

        if finish && !self.buffer.is_empty() {
            if self.in_thinking {
                thinking.push_str(&self.buffer);
            } else {
                content.push_str(&self.buffer);
            }
            self.buffer.clear();
        }

        (content, thinking)
    }
}

fn find_first_tag<'a>(haystack: &str, tags: &'a [&str]) -> Option<(usize, &'a str)> {
    tags.iter()
        .filter_map(|tag| haystack.find(tag).map(|idx| (idx, *tag)))
        .min_by_key(|(idx, _)| *idx)
}

fn safe_split_index(value: &str, max: usize) -> usize {
    let mut idx = max.min(value.len());
    while idx > 0 && !value.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

#[tauri::command]
pub async fn chat_stream(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    request_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
    exa_api_key: Option<String>,
    reasoning_enabled: bool,
) -> Result<(), String> {
    let my_generation_id = state.current_generation_id.load(Ordering::SeqCst);

    const TOKEN_BATCH_SIZE: usize = 15;

    macro_rules! is_cancelled {
        () => {
            state.current_generation_id.load(Ordering::SeqCst) != my_generation_id
        };
    }

    let provider = state
        .provider_selector
        .get_active_provider()
        .await
        .map_err(|e| e.to_string())?;

    // Build web_search tool definition
    let web_search_tool = ToolDefinition {
        name: "web_search".into(),
        description: "Search the web for current information. Use this when you need up-to-date information, recent events, or facts outside your training data.".into(),
        parameters: serde_json::json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to look up"
                }
            },
            "required": ["query"]
        }),
    };

    let mut current_messages = messages;
    let mut content_acc = String::new();
    let mut thinking_acc = String::new();
    let mut final_metadata: Option<StreamMetadata> = None;
    let mut thinking_tag_parser = ThinkingTagParser::new(reasoning_enabled);

    // Iterative tool-calling loop: each pass streams with tools defined;
    // if the model calls web_search, we execute the search, append tool call +
    // result to the message history, and loop back for the next response.
    // When the model responds without a tool call, we finalise and return.
    loop {
        let mut tool_calls_opt: Option<Vec<ToolCallInfo>> = None;
        let mut pending_content = String::new();
        let mut handled_tool_call = false;

        let reasoning_opt = if reasoning_enabled {
            serde_json::json!({"reasoning_enabled": true})
        } else {
            serde_json::json!({"reasoning_enabled": false})
        };

        let mut stream = match provider
            .chat_completion(
                model.clone(),
                current_messages.clone(),
                system_prompt.clone(),
                Some(reasoning_opt),
                Some(vec![web_search_tool.clone()]),
            )
            .await
        {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: format!("\n\n*Generation failed: {e}*"),
                        thinking: None,
                        done: true,
                        metadata: None,
                        tool_calls: None,
                    },
                );
                return Ok(());
            }
        };

        while let Some(result) = stream.next().await {
            if is_cancelled!() {
                if !pending_content.is_empty() {
                    let _ = app_handle.emit(
                        "chat-chunk",
                        StreamPayload {
                            request_id: request_id.clone(),
                            content: pending_content.clone(),
                            thinking: None,
                            done: false,
                            metadata: None,
                            tool_calls: None,
                        },
                    );
                }
                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: String::new(),
                        thinking: None,
                        done: true,
                        metadata: None,
                        tool_calls: None,
                    },
                );
                return Ok(());
            }

            let mut chunk = match result {
                Ok(c) => c,
                Err(e) => {
                    let _ = app_handle.emit(
                        "chat-chunk",
                        StreamPayload {
                            request_id: request_id.clone(),
                            content: format!("\n\n*Stream error: {e}*"),
                            thinking: None,
                            done: true,
                            metadata: None,
                            tool_calls: None,
                        },
                    );
                    return Ok(());
                }
            };

            chunk.request_id = request_id.clone();

            if let Some(ref metadata) = chunk.metadata {
                final_metadata = Some(metadata.clone());
            }

            if let Some(tcs) = chunk.tool_calls {
                if !tcs.is_empty() {
                    tool_calls_opt = Some(tcs);
                }
            }

            if let Some(ref thinking_chunk) = chunk.thinking {
                if !thinking_chunk.is_empty() {
                    thinking_acc.push_str(thinking_chunk);
                    let is_thinking = content_acc.is_empty();
                    let _ = app_handle.emit(
                        "chat-thinking",
                        ThinkingPayload {
                            request_id: request_id.clone(),
                            thinking: thinking_acc.clone(),
                            is_thinking,
                        },
                    );
                }
            }

            if !chunk.content.is_empty() {
                let (content_chunk, thinking_chunk) = thinking_tag_parser.push(&chunk.content);
                if !thinking_chunk.is_empty() {
                    thinking_acc.push_str(&thinking_chunk);
                    let is_thinking = content_acc.is_empty();
                    let _ = app_handle.emit(
                        "chat-thinking",
                        ThinkingPayload {
                            request_id: request_id.clone(),
                            thinking: thinking_acc.clone(),
                            is_thinking,
                        },
                    );
                }

                content_acc.push_str(&content_chunk);
                pending_content.push_str(&content_chunk);
                if pending_content.len() >= TOKEN_BATCH_SIZE {
                    let _ = app_handle.emit(
                        "chat-chunk",
                        StreamPayload {
                            request_id: request_id.clone(),
                            content: pending_content.clone(),
                            thinking: None,
                            done: false,
                            metadata: None,
                            tool_calls: None,
                        },
                    );
                    pending_content.clear();
                }
            }

            if chunk.done {
                let (content_chunk, thinking_chunk) = thinking_tag_parser.finish();
                if !thinking_chunk.is_empty() {
                    thinking_acc.push_str(&thinking_chunk);
                    let _ = app_handle.emit(
                        "chat-thinking",
                        ThinkingPayload {
                            request_id: request_id.clone(),
                            thinking: thinking_acc.clone(),
                            is_thinking: false,
                        },
                    );
                }
                if !content_chunk.is_empty() {
                    content_acc.push_str(&content_chunk);
                    pending_content.push_str(&content_chunk);
                }

                // Flush remaining pending content
                if !pending_content.is_empty() {
                    let _ = app_handle.emit(
                        "chat-chunk",
                        StreamPayload {
                            request_id: request_id.clone(),
                            content: pending_content.clone(),
                            thinking: None,
                            done: false,
                            metadata: None,
                            tool_calls: None,
                        },
                    );
                    pending_content.clear();
                }

                // If the model made a tool call, execute the search and loop back
                if let Some(tcs) = tool_calls_opt {
                    if let Some(tc) = tcs.into_iter().next() {
                        if tc.name == "web_search" {
                            handled_tool_call = true;

                            let query = tc
                                .arguments
                                .get("query")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            let _ = app_handle.emit(
                                "web-search-event",
                                WebSearchEvent {
                                    request_id: request_id.clone(),
                                    query: query.clone(),
                                    status: "searching".into(),
                                    results: None,
                                },
                            );

                            let (search_results, search_error): (
                                Vec<SearchResultItem>,
                                Option<String>,
                            ) = if let Some(ref key) = exa_api_key {
                                if !key.is_empty() {
                                    match web_search::search_exa(&query, key).await {
                                        Ok(results) => (results, None),
                                        Err(e) => {
                                            eprintln!("[WebSearch] Exa error: {e}");
                                            (Vec::new(), Some(e))
                                        }
                                    }
                                } else {
                                    (Vec::new(), Some("No Exa API key configured".into()))
                                }
                            } else {
                                (Vec::new(), Some("No Exa API key configured".into()))
                            };

                            let search_results_clone = search_results.clone();

                            let _ = app_handle.emit(
                                "web-search-event",
                                WebSearchEvent {
                                    request_id: request_id.clone(),
                                    query: query.clone(),
                                    status: if search_error.is_some() {
                                        "error".into()
                                    } else {
                                        "complete".into()
                                    },
                                    results: Some(search_results),
                                },
                            );

                            let tool_result_content = format_search_results(
                                &query,
                                &search_results_clone,
                                search_error.as_deref(),
                            );

                            let follow_up_messages = {
                                let mut msgs = current_messages.clone();
                                msgs.push(ChatMessage {
                                    role: "assistant".into(),
                                    content: content_acc.clone(),
                                    attachments: None,
                                    tool_calls: Some(vec![ToolCallInfo {
                                        name: tc.name.clone(),
                                        arguments: tc.arguments.clone(),
                                    }]),
                                });
                                msgs.push(ChatMessage {
                                    role: "tool".into(),
                                    content: tool_result_content,
                                    attachments: None,
                                    tool_calls: None,
                                });
                                msgs
                            };
                            current_messages = follow_up_messages;

                            break; // back to outer loop for follow-up stream
                        }
                    }
                }

                // No tool call: emit done and return
                if !thinking_acc.is_empty() && content_acc.is_empty() {
                    let _ = app_handle.emit(
                        "chat-thinking",
                        ThinkingPayload {
                            request_id: request_id.clone(),
                            thinking: thinking_acc.clone(),
                            is_thinking: false,
                        },
                    );
                }

                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: String::new(),
                        thinking: None,
                        done: true,
                        metadata: final_metadata,
                        tool_calls: None,
                    },
                );

                return Ok(());
            }
        }

        // If we broke out due to a tool call, the outer loop starts a new stream.
        // Otherwise (stream ended without done), emit done and return.
        if !handled_tool_call {
            if !pending_content.is_empty() {
                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: pending_content.clone(),
                        thinking: None,
                        done: false,
                        metadata: None,
                        tool_calls: None,
                    },
                );
            }
            let _ = app_handle.emit(
                "chat-chunk",
                StreamPayload {
                    request_id: request_id.clone(),
                    content: String::new(),
                    thinking: None,
                    done: true,
                    metadata: None,
                    tool_calls: None,
                },
            );
            return Ok(());
        }
    }
}

fn format_search_results(query: &str, results: &[SearchResultItem], error: Option<&str>) -> String {
    let mut output = String::new();

    if let Some(err) = error {
        output.push_str(&format!("Web search for \"{}\" failed: {}\n", query, err));
        return output;
    }

    if results.is_empty() {
        output.push_str(&format!(
            "Web search for \"{}\" returned no results.\n",
            query
        ));
        return output;
    }

    output.push_str(&format!(
        "Web search results for \"{}\" ({} sources):\n\n",
        query,
        results.len()
    ));

    for (i, r) in results.iter().enumerate() {
        output.push_str(&format!("[{}. {}]({})\n", i + 1, r.title, r.url));
        for h in &r.highlights {
            output.push_str(&format!("   > {}\n", h));
        }
        output.push('\n');
    }

    output
}

#[tauri::command]
pub async fn chat(
    state: tauri::State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    options: Option<Value>,
) -> Result<String, String> {
    let provider = state.provider_selector.get_active_provider().await?;
    let mut stream = provider
        .chat_completion(model, messages, None, options, None)
        .await?;

    let mut full_content = String::new();
    while let Some(result) = stream.next().await {
        let chunk = result.map_err(|e| e.to_string())?;
        full_content.push_str(&chunk.content);
        if chunk.done {
            break;
        }
    }

    Ok(title_generator::strip_thinking_blocks(&full_content))
}

#[tauri::command]
pub async fn generate_chat_title(
    state: tauri::State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    user_name: Option<String>,
) -> Result<Option<String>, String> {
    let provider = match state.provider_selector.get_active_provider().await {
        Ok(provider) => provider,
        Err(error) => {
            eprintln!("[TitleGeneration] Provider unavailable: {error}");
            return Ok(None);
        }
    };

    Ok(
        title_generator::generate_title(provider.as_ref(), &model, &messages, user_name.as_deref())
            .await,
    )
}
