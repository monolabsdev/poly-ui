use crate::error::AppError;
use crate::models::chat::ChatMessage;
use crate::providers::base::ProviderType;
use crate::stream_emitter::TauriStreamEmitter;
use crate::title_generator;
use crate::tool_loop::ToolLoop;
use crate::web_search::{create_web_search_client, WebSearchConfig};
use crate::AppState;
use serde_json::Value;
use std::sync::atomic::Ordering;
use tauri::AppHandle;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn chat_stream(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    request_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
    web_search_config: Option<WebSearchConfig>,
    reasoning_enabled: bool,
    provider_type: Option<ProviderType>,
) -> Result<(), String> {
    let my_generation_id = state.current_generation_id.load(Ordering::SeqCst);

    let provider = state
        .provider_selector
        .get_provider(provider_type.unwrap_or(ProviderType::OllamaLocal))
        .await
        .map_err(|e| e.to_string())?;

    let emitter = TauriStreamEmitter::new(app_handle.clone());
    let web_search = web_search_config.as_ref().map(create_web_search_client);
    let web_search = web_search.as_deref().zip(web_search_config.as_ref());

    let result = ToolLoop::run(
        provider.as_ref(),
        &model,
        messages,
        system_prompt,
        reasoning_enabled,
        &request_id,
        &emitter,
        web_search,
        || state.current_generation_id.load(Ordering::SeqCst) != my_generation_id,
    )
    .await;

    match result {
        Ok(_) => Ok(()),
        Err(AppError::Cancelled) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn chat(
    state: tauri::State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    options: Option<Value>,
    provider_type: Option<ProviderType>,
) -> Result<String, String> {
    let provider = state
        .provider_selector
        .get_provider(provider_type.unwrap_or(ProviderType::OllamaLocal))
        .await?;
    let mut stream = provider
        .chat_completion(model, messages, None, options, None)
        .await?;

    let mut full_content = String::new();
    while let Some(result) = tokio_stream::StreamExt::next(&mut stream).await {
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
    provider_type: Option<ProviderType>,
) -> Result<Option<String>, String> {
    let provider = match state
        .provider_selector
        .get_provider(provider_type.unwrap_or(ProviderType::OllamaLocal))
        .await
    {
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
