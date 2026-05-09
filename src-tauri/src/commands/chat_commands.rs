use crate::AppState;
use crate::models::chat::{ChatMessage, StreamMetadata, StreamPayload, ThinkingPayload, GenericToolCall};
use crate::tools::ToolInvocationPayload;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tokio_stream::StreamExt;
use tokio::sync::oneshot;
use crate::PendingApproval;

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

    macro_rules! is_cancelled {
        () => {
            state.current_generation_id.load(Ordering::SeqCst) != my_generation_id
        };
    }

    let mut history = messages.clone();
    let provider = state.provider_selector.get_active_provider().await?;
    let max_iterations = max_tool_iterations.unwrap_or(5);
    let tool_defs = state.tool_registry.to_ollama_tool_json().await;
    let has_images = messages_contain_images(&messages);

    for _iteration in 0..max_iterations {
        if is_cancelled!() {
            return Ok(());
        }

        let tools = if !has_images && !tool_defs.is_empty() {
            Some(tool_defs.clone())
        } else {
            None
        };

        let mut stream = provider
            .chat_completion(model.clone(), history.clone(), system_prompt.clone(), tools)
            .await?;

        let mut content_acc = String::new();
        let mut thinking_acc = String::new();
        let mut tool_calls: Vec<GenericToolCall> = Vec::new();
        let mut final_metadata: Option<StreamMetadata> = None;
        let mut stream_done = false;

        while let Some(result) = stream.next().await {
            if is_cancelled!() {
                return Ok(());
            }

            let mut chunk = match result {
                Ok(c) => c,
                Err(e) => {
                    let err_msg = format!("\nError: Provider error: {}", e);
                    let _ = app_handle.emit(
                        "chat-chunk",
                        StreamPayload {
                            request_id: request_id.clone(),
                            content: err_msg.clone(),
                            thinking: None,
                            tool_calls: None,
                            done: true,
                            metadata: None,
                        },
                    );
                    return Err(err_msg);
                }
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
                    let _ = app_handle.emit("chat-chunk", chunk.clone());
                }
            }

            if let Some(new_tool_calls) = chunk.tool_calls {
                tool_calls.extend(new_tool_calls);
            }
        }

        if !stream_done {
            continue;
        }

        if tool_calls.is_empty() {
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

        // Add assistant message with tool calls to history
        history.push(ChatMessage {
            role: "assistant".to_string(),
            content: content_acc.clone(),
            attachments: None,
        });

        // Execute tool calls
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
) -> Result<String, String> {
    let provider = state.provider_selector.get_active_provider().await?;
    let mut stream = provider
        .chat_completion(model, messages, None, None)
        .await?;
    
    let mut full_content = String::new();
    while let Some(result) = stream.next().await {
        let chunk = result.map_err(|e| e.to_string())?;
        full_content.push_str(&chunk.content);
        if chunk.done {
            break;
        }
    }

    Ok(full_content)
}

fn messages_contain_images(messages: &[ChatMessage]) -> bool {
    messages
        .iter()
        .any(|message| {
            message.attachments
                .as_deref()
                .unwrap_or_default()
                .iter()
                .any(|a| a.content_type.starts_with("image/"))
        })
}
