use crate::models::chat::{ChatMessage, StreamMetadata, StreamPayload, ThinkingPayload};
use crate::title_generator;
use crate::AppState;
use serde_json::Value;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tokio_stream::StreamExt;

#[tauri::command]
pub async fn chat_stream(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    request_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
) -> Result<(), String> {
    let my_generation_id = state.current_generation_id.load(Ordering::SeqCst);

    const TOKEN_BATCH_SIZE: usize = 15;
    let mut pending_content = String::new();

    macro_rules! is_cancelled {
        () => {
            state.current_generation_id.load(Ordering::SeqCst) != my_generation_id
        };
    }

    macro_rules! emit_error_and_return {
        ($msg:expr) => {{
            if !pending_content.is_empty() {
                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: pending_content.clone(),
                        thinking: None,
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
                    done: true,
                    metadata: None,
                },
            );
            return Err($msg);
        }};
    }

    let provider = state
        .provider_selector
        .get_active_provider()
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = match provider
        .chat_completion(model.clone(), messages, system_prompt.clone(), None)
        .await
    {
        Ok(s) => s,
        Err(e) => emit_error_and_return!(e),
    };

    let mut content_acc = String::new();
    let mut thinking_acc = String::new();
    let mut final_metadata: Option<StreamMetadata> = None;

    while let Some(result) = stream.next().await {
        if is_cancelled!() {
            return Ok(());
        }

        let mut chunk = match result {
            Ok(c) => c,
            Err(e) => emit_error_and_return!(e),
        };

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
            pending_content.push_str(&chunk.content);
            if pending_content.len() >= TOKEN_BATCH_SIZE {
                let _ = app_handle.emit(
                    "chat-chunk",
                    StreamPayload {
                        request_id: request_id.clone(),
                        content: pending_content.clone(),
                        thinking: None,
                        done: false,
                        metadata: None,
                    },
                );
                pending_content.clear();
            }
        }

        if chunk.done {
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
                    },
                );
                pending_content.clear();
            }

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
                },
            );

            return Ok(());
        }
    }

    // Flush remaining pending content (edge case: stream ended without done)
    if !pending_content.is_empty() {
        let _ = app_handle.emit(
            "chat-chunk",
            StreamPayload {
                request_id: request_id.clone(),
                content: pending_content.clone(),
                thinking: None,
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
    options: Option<Value>,
) -> Result<String, String> {
    let provider = state.provider_selector.get_active_provider().await?;
    let mut stream = provider
        .chat_completion(model, messages, None, options)
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
