use crate::models::chat::{
    ChatMessage, GenericToolCall, StreamMetadata, StreamPayload, ThinkingPayload,
};
use crate::providers::base::{LLMProvider, ProviderType};
use crate::tools::ToolInvocationPayload;
use crate::AppState;
use crate::PendingApproval;
use chrono::Utc;
use serde_json::Value;
use std::env;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio_stream::StreamExt;

#[tauri::command]
pub async fn chat_stream(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    request_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
    max_tool_iterations: Option<u32>,
) -> Result<(), String> {
    let my_generation_id = state.current_generation_id.load(Ordering::SeqCst);

    // Token batching: accumulate and emit every N chars
    const TOKEN_BATCH_SIZE: usize = 15;
    let mut pending_content = String::new();

    macro_rules! is_cancelled {
        () => {
            state.current_generation_id.load(Ordering::SeqCst) != my_generation_id
        };
    }

    // Flush pending batched content to the frontend.
    // Emits a done:true sentinel so the placeholder settles.
    // Then returns Err to trigger the frontend .catch() error path.
    macro_rules! emit_error_and_return {
        ($msg:expr) => {{
            if !pending_content.is_empty() {
                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: pending_content.clone(),
                        thinking: None,
                        tool_calls: None,
                        done: false,
                        metadata: None,
                    },
                );
                pending_content.clear();
            }
            let _ = app_handle.emit(
                "chat-chunk",
                StreamPayload {
                    request_id: request_id.clone(),
                    content: String::new(),
                    thinking: None,
                    tool_calls: None,
                    done: true,
                    metadata: None,
                },
            );
            return Err($msg);
        }};
    }

    let mut history = messages.clone();
    let provider = state
        .provider_selector
        .get_active_provider()
        .await
        .map_err(|e| e.to_string())?;

    let max_iterations = max_tool_iterations.unwrap_or(5);
    let tool_defs = state.tool_registry.to_ollama_tool_json().await;
    let has_images = messages_contain_images(&messages);
    let mut tools_skipped = false;

    for _iteration in 0..max_iterations {
        if is_cancelled!() {
            return Ok(());
        }

        let tools = if !has_images && !tool_defs.is_empty() && !tools_skipped {
            Some(tool_defs.clone())
        } else {
            None
        };

        // chat_completion errors (e.g. connection refused, model not found)
        // are already normalized by the provider layer. Surface them as Err
        // so the frontend .catch() handles them — never emit them as chat
        // content.
        let mut stream = match provider
            .chat_completion(
                model.clone(),
                history.clone(),
                system_prompt.clone(),
                tools,
                None,
            )
            .await
        {
            Ok(s) => s,
            Err(e) => {
                // If model doesn't support tools, retry without tools
                if e.contains("does not support tools") && !tools_skipped {
                    tools_skipped = true;
                    continue;
                }
                emit_error_and_return!(e)
            }
        };

        let mut content_acc = String::new();
        let mut thinking_acc = String::new();
        let mut tool_calls: Vec<GenericToolCall> = Vec::new();
        let mut final_metadata: Option<StreamMetadata> = None;
        let mut stream_done = false;

        while let Some(result) = stream.next().await {
            if is_cancelled!() {
                return Ok(());
            }

            // Stream item errors (e.g. mid-stream disconnect) are also
            // normalized by the provider. Return Err — the frontend .catch()
            // will attach the error to the placeholder message.
            let mut chunk = match result {
                Ok(c) => c,
                Err(e) => emit_error_and_return!(e),
            };

            stream_done = chunk.done;
            chunk.request_id = request_id.clone();

            if let Some(ref metadata) = chunk.metadata {
                final_metadata = Some(metadata.clone());
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
                content_acc.push_str(&chunk.content);

                if chunk.tool_calls.is_none() {
                    pending_content.push_str(&chunk.content);
                    if pending_content.len() >= TOKEN_BATCH_SIZE {
                        let _ = app_handle.emit(
                            "chat-chunk",
                            StreamPayload {
                                request_id: request_id.clone(),
                                content: pending_content.clone(),
                                thinking: None,
                                tool_calls: None,
                                done: false,
                                metadata: None,
                            },
                        );
                        pending_content.clear();
                    }
                }
            }

            if let Some(new_tool_calls) = chunk.tool_calls {
                tool_calls.extend(new_tool_calls);
            }
        }

        // Flush remaining pending content
        if !pending_content.is_empty() {
            let _ = app_handle.emit(
                "chat-chunk",
                StreamPayload {
                    request_id: request_id.clone(),
                    content: pending_content.clone(),
                    thinking: None,
                    tool_calls: None,
                    done: false,
                    metadata: None,
                },
            );
            pending_content.clear();
        }

        if !stream_done {
            continue;
        }

        if tool_calls.is_empty() {
            // Flush any trailing thinking state before the done sentinel.
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
                    tool_calls: None,
                    done: true,
                    metadata: final_metadata,
                },
            );

            return Ok(());
        }

        // Tool call path — add assistant turn to history.
        history.push(ChatMessage {
            role: "assistant".to_string(),
            content: content_acc.clone(),
            attachments: None,
        });

        for tool_call in &tool_calls {
            let tool_name = &tool_call.name;
            let tool_args = tool_call.arguments.clone();
            let invocation_id = uuid::Uuid::new_v4().to_string();
            let needs_approval = state.tool_registry.needs_approval(tool_name).await;

            let approved = if needs_approval {
                let (tx, rx) = oneshot::channel();
                {
                    let mut approvals =
                        state.pending_approvals.lock().map_err(|e| e.to_string())?;
                    approvals.insert(
                        invocation_id.clone(),
                        PendingApproval {
                            sender: tx,
                            tool_name: tool_name.clone(),
                        },
                    );
                }

                let _ = app_handle.emit(
                    "tool-invocation",
                    ToolInvocationPayload {
                        invocation_id: invocation_id.clone(),
                        request_id: request_id.clone(),
                        tool_name: tool_name.clone(),
                        tool_args: tool_args.clone(),
                        requires_approval: true,
                    },
                );

                rx.await
                    .map_err(|_| "Approval channel closed".to_string())?
            } else {
                let _ = app_handle.emit(
                    "tool-invocation",
                    ToolInvocationPayload {
                        invocation_id: invocation_id.clone(),
                        request_id: request_id.clone(),
                        tool_name: tool_name.clone(),
                        tool_args: tool_args.clone(),
                        requires_approval: false,
                    },
                );
                true
            };

            if !approved {
                history.push(ChatMessage {
                    role: "tool".to_string(),
                    content: "Tool invocation denied by user".to_string(),
                    attachments: None,
                });
                continue;
            }

            let result = state.tool_registry.execute(tool_name, tool_args).await;
            history.push(ChatMessage {
                role: "tool".to_string(),
                content: result.output,
                attachments: None,
            });
        }

        content_acc.clear();
        thinking_acc.clear();
        tool_calls.clear();
    }

    // Max iterations reached — emit a clean done sentinel.
    let _ = app_handle.emit(
        "chat-chunk",
        StreamPayload {
            request_id: request_id.clone(),
            content: String::new(),
            thinking: None,
            tool_calls: None,
            done: true,
            metadata: None,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn chat(
    state: tauri::State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    options: Option<serde_json::Value>,
) -> Result<String, String> {
    let provider = state.provider_selector.get_active_provider().await?;
    let mut stream = provider
        .chat_completion(model, messages, None, None, options)
        .await?;

    let mut full_content = String::new();
    while let Some(result) = stream.next().await {
        let chunk = result.map_err(|e| e.to_string())?;
        full_content.push_str(&chunk.content);
        if chunk.done {
            break;
        }
    }

    Ok(strip_thinking_blocks(&full_content))
}

#[tauri::command]
pub async fn generate_chat_title(
    state: tauri::State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    user_name: Option<String>,
) -> Result<Option<String>, String> {
    if !title_generation_enabled() {
        return Ok(None);
    }

    let provider = match state.provider_selector.get_active_provider().await {
        Ok(provider) => provider,
        Err(error) => {
            eprintln!("[TitleGeneration] Provider unavailable: {error}");
            return Ok(None);
        }
    };

    let task_model = resolve_task_model(provider.get_provider_type(), &model);
    if task_model.trim().is_empty() {
        return Ok(None);
    }

    let prompt = build_title_prompt(&messages, user_name.as_deref());
    let task_messages = vec![ChatMessage {
        role: "user".to_string(),
        content: prompt,
        attachments: None,
    }];

    let max_attempts = if title_generation_retry_enabled() { 2 } else { 1 };

    for attempt in 0..max_attempts {
        let temperature = if attempt == 0 { 0.2 } else { 0.7 };

        for use_json_format in [false, true] {
            match run_title_completion(
                provider.as_ref(),
                &task_model,
                &task_messages,
                use_json_format,
                temperature,
            )
            .await
            {
                Ok(raw) => {
                    let trimmed = raw.trim();
                    if trimmed.is_empty() {
                        eprintln!("[TitleGeneration] Empty response from model");
                        continue;
                    }
                    if let Some(title) =
                        parse_title_response(trimmed).and_then(|title| validate_title(title, &messages))
                    {
                        return Ok(Some(title));
                    }
                    eprintln!("[TitleGeneration] No valid title parsed from response: {trimmed:?}");
                }
                Err(error) => eprintln!("[TitleGeneration] Completion failed: {error}"),
            }
        }
    }

    // Fallback: use first user message as title
    Ok(first_user_fallback_title(&messages))
}

/// Strip reasoning-model thinking blocks from content.
/// Handles DeepSeek/Qwen3 `<think>...</think>` and Gemma `<|channel|thought>` blocks.
fn strip_thinking_blocks(content: &str) -> String {
    let mut result = content.to_string();
    for (start_tag, end_tag) in &[
        ("<think>", "</think>"),
        ("<|channel|thought>", "</|channel|thought>"),
    ] {
        loop {
            let start = match result.find(start_tag) {
                Some(pos) => pos,
                None => break,
            };
            let end = match result[start..].find(end_tag) {
                Some(pos) => start + pos + end_tag.len(),
                None => break,
            };
            result.replace_range(start..end, "");
        }
    }
    result
}

fn title_generation_enabled() -> bool {
    env::var("ENABLE_TITLE_GENERATION")
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(normalized.as_str(), "0" | "false" | "off" | "no")
        })
        .unwrap_or(true)
}

fn title_generation_retry_enabled() -> bool {
    env::var("TITLE_GENERATION_RETRY")
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(normalized.as_str(), "0" | "false" | "off" | "no")
        })
        .unwrap_or(true)
}

fn first_user_fallback_title(messages: &[ChatMessage]) -> Option<String> {
    let first_user = messages
        .iter()
        .find(|message| message.role == "user")
        .map(|message| compact_whitespace(&message.content))
        .unwrap_or_default();

    if first_user.is_empty() {
        return None;
    }

    // Truncate to first 8 words or 80 chars, whichever is shorter
    let words: Vec<&str> = first_user.split_whitespace().collect();
    let truncated: String = if words.len() <= 8 && first_user.chars().count() <= 80 {
        first_user
    } else {
        words[..8.min(words.len())].join(" ")
    };

    let mut cleaned = truncated
        .chars()
        .take(80)
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect::<String>();
    cleaned = compact_whitespace(&cleaned).trim().to_string();

    if cleaned.is_empty() { None } else { Some(cleaned) }
}

async fn run_title_completion(
    provider: &dyn LLMProvider,
    model: &str,
    messages: &[ChatMessage],
    use_json_format: bool,
    temperature: f64,
) -> Result<String, String> {
    let mut opts = serde_json::json!({
        "temperature": temperature,
        "num_predict": 200,
        "top_p": 0.8,
    });

    if use_json_format {
        opts["format"] = serde_json::json!("json");
    }

    let options = Some(opts);

    let mut stream = provider
        .chat_completion(model.to_string(), messages.to_vec(), None, None, options)
        .await?;

    let mut raw = String::new();
    while let Some(result) = stream.next().await {
        let chunk = result?;
        raw.push_str(&chunk.content);
        if chunk.done {
            break;
        }
    }

    Ok(raw)
}

fn resolve_task_model(provider_type: ProviderType, fallback_model: &str) -> String {
    let env_key = if provider_type == ProviderType::OllamaLocal {
        "TASK_MODEL"
    } else {
        "TASK_MODEL_EXTERNAL"
    };

    env::var(env_key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback_model.to_string())
}

fn build_title_prompt(messages: &[ChatMessage], user_name: Option<&str>) -> String {
    let template = env::var("TITLE_GENERATION_PROMPT_TEMPLATE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(default_title_prompt_template);

    let first_user_prompt = messages
        .iter()
        .find(|message| message.role == "user")
        .map(|message| message.content.as_str())
        .unwrap_or("");

    let mut rendered = render_message_template(&template, messages);
    rendered = rendered.replace("{{prompt}}", first_user_prompt);
    rendered = rendered.replace("{{USER_NAME}}", user_name.unwrap_or("User"));
    rendered = rendered.replace(
        "{{CURRENT_DATE}}",
        &Utc::now().format("%Y-%m-%d").to_string(),
    );
    rendered
}

fn default_title_prompt_template() -> String {
    r#"Generate a short chat title (2-5 words, with emoji) for this message:

{{prompt}}

Respond with only this JSON: {"title": "..."}"#
        .to_string()
}

fn render_message_template(template: &str, messages: &[ChatMessage]) -> String {
    let mut rendered = template.replace("{{MESSAGES}}", &format_messages(messages));

    loop {
        let Some(start) = rendered.find("{{MESSAGES:END:") else {
            break;
        };
        let Some(relative_end) = rendered[start..].find("}}") else {
            break;
        };
        let end = start + relative_end + 2;
        let token = &rendered[start..end];
        let count = token
            .trim_start_matches("{{MESSAGES:END:")
            .trim_end_matches("}}")
            .parse::<usize>()
            .unwrap_or(2);
        let slice_start = messages.len().saturating_sub(count);
        let replacement = format_messages(&messages[slice_start..]);
        rendered.replace_range(start..end, &replacement);
    }

    rendered
}

fn format_messages(messages: &[ChatMessage]) -> String {
    messages
        .iter()
        .map(|message| {
            let role = match message.role.as_str() {
                "assistant" => "Assistant",
                "system" => "System",
                "tool" => "Tool",
                _ => "User",
            };
            format!("{role}: {}", compact_whitespace(&message.content))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_title_response(raw: &str) -> Option<String> {
    let cleaned = strip_thinking_blocks(raw);
    let cleaned = cleaned.trim();

    // Strip markdown code fences and language tags
    let cleaned = cleaned
        .trim_start_matches("```json")
        .trim_start_matches("```JSON")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    // Strategy 1: Parse entire cleaned string as JSON
    let from_full = parse_title_json(&cleaned);

    // Strategy 2: Extract JSON object from anywhere in the response
    let from_json_block = from_full.or_else(|| {
        let start = cleaned.find('{')?;
        let end = cleaned.rfind('}')?;
        if end <= start {
            return None;
        }
        parse_title_json(&cleaned[start..=end])
    });

    // Strategy 3: Try finding a JSON-like pattern: {"title": ...}
    let from_relaxed = from_json_block.or_else(|| {
        // Match `{"title": "value"}` or `{'title': 'value'}` etc.
        let lowered = cleaned.to_ascii_lowercase();
        let title_pos = lowered.find("\"title\"")?;
        let brace_start = cleaned[..title_pos].rfind('{')?;
        let brace_end = cleaned[title_pos..].rfind('}')? + title_pos;
        if brace_end <= brace_start {
            return None;
        }
        parse_title_json(&cleaned[brace_start..=brace_end])
    });

    // Strategy 4: Freeform fallback
    from_relaxed.or_else(|| clean_freeform_title(&cleaned))
}

fn parse_title_json(raw_json: &str) -> Option<String> {
    parse_title_json_value(raw_json).or_else(|| {
        let sanitized = sanitize_title_json(raw_json);
        if sanitized == raw_json {
            return None;
        }
        parse_title_json_value(&sanitized)
    })
}

fn parse_title_json_value(raw_json: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(raw_json).ok()?;

    // Try exact match first, then case-insensitive fallback
    if let Some(title) = value
        .get("title")
        .or_else(|| value.get("Title"))
        .or_else(|| value.get("TITLE"))
        .or_else(|| value.get("tITLE"))
        .and_then(|v| v.as_str())
    {
        return clean_generated_title(title);
    }

    // Walk the object and find any key resembling "title"
    if let Some(obj) = value.as_object() {
        for (key, val) in obj {
            if key.to_ascii_lowercase() == "title" {
                if let Some(title) = val.as_str() {
                    return clean_generated_title(title);
                }
            }
        }
    }

    None
}

fn sanitize_title_json(raw_json: &str) -> String {
    let mut sanitized = raw_json
        // Curly/smart double quotes
        .replace(['\u{201C}', '\u{201D}', '\u{201E}', '\u{201F}'], "\"")
        // Curly/smart single quotes
        .replace(['\u{2018}', '\u{2019}', '\u{201A}', '\u{201B}'], "'")
        // Guillemets (French quotes)
        .replace(['\u{00AB}', '\u{00BB}'], "\"")
        // Corner brackets (CJK quotes)
        .replace(['\u{300C}', '\u{300D}', '\u{300E}', '\u{300F}'], "\"")
        // Prime marks
        .replace(['\u{2032}', '\u{2033}', '\u{2036}', '\u{2037}'], "\"");

    // If the JSON uses single quotes for keys (invalid JSON), convert all ' to "
    if sanitized.contains("'title'") || sanitized.contains("{'") || sanitized.contains("'title\":") {
        sanitized = sanitized.replace('\'', "\"");
    }

    sanitized
}

fn validate_title(title: String, messages: &[ChatMessage]) -> Option<String> {
    let first_user = messages
        .iter()
        .find(|message| message.role == "user")
        .map(|message| message.content.as_str())
        .unwrap_or("");

    let normalized_title_str = normalized_title(&title);
    let normalized_user = normalized_title(first_user);
    if !normalized_user.is_empty() && normalized_title_str == normalized_user {
        return None;
    }

    // Check that title isn't just a repetition of the user message prefix
    if normalized_title_str.len() >= 3 && normalized_user.starts_with(&normalized_title_str) {
        return None;
    }

    let word_count = title.split_whitespace().count();
    if !(1..=7).contains(&word_count) {
        return None;
    }

    Some(title)
}

fn clean_generated_title(title: &str) -> Option<String> {
    let mut cleaned = compact_whitespace(title)
        .trim_matches(|ch| matches!(ch, '"' | '\'' | '`'))
        .to_string();

    if cleaned.chars().count() > 60 {
        cleaned = cleaned.chars().take(60).collect();
        cleaned = cleaned.trim_end().to_string();
    }

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn clean_freeform_title(raw: &str) -> Option<String> {
    let title_prefixes = [
        "Title:",
        "title:",
        "TITLE:",
        "Here is a concise title:",
        "Here is a title:",
        "Suggested title:",
        "Suggested Title:",
        "Result:",
        "Output:",
        "Response:",
    ];

    let title = raw
        .lines()
        .find(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty()
                && !trimmed.eq_ignore_ascii_case("null")
                && !trimmed.eq_ignore_ascii_case("none")
                && !trimmed.eq_ignore_ascii_case("undefined")
                && !trimmed.starts_with("I cannot")
                && !trimmed.starts_with("I'm sorry")
                && !trimmed.starts_with("I apologize")
                && !trimmed.starts_with("Sorry,")
                && !trimmed.starts_with("As an AI")
        })
        .unwrap_or(raw);

    let mut cleaned = title.trim().to_string();
    for prefix in &title_prefixes {
        if cleaned.starts_with(prefix) {
            cleaned = cleaned[prefix.len()..].trim().to_string();
            break;
        }
    }

    clean_generated_title(&cleaned)
}

fn normalized_title(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_alphanumeric() || ch.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

fn compact_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn messages_contain_images(messages: &[ChatMessage]) -> bool {
    messages.iter().any(|message| {
        message
            .attachments
            .as_deref()
            .unwrap_or_default()
            .iter()
            .any(|a| a.content_type.starts_with("image/"))
    })
}
