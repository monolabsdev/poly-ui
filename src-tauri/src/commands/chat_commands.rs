use crate::auth::{authorize_account, AuthError};
use crate::error::AppError;
use crate::memory::service::MemoryService;
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

fn map_auth_err(error: AuthError) -> String {
    match error {
        AuthError::SessionExpired => "Session expired".to_string(),
        _ => "Not authorized for this account".to_string(),
    }
}

async fn check_account(
    state: &tauri::State<'_, AppState>,
    token: Option<&str>,
    account_id: Option<&str>,
) -> Result<(), String> {
    match account_id {
        Some(id) => authorize_account(&state.db, token, id)
            .await
            .map_err(map_auth_err),
        None => Ok(()),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn chat_stream(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    request_id: String,
    conversation_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
    web_search_config: Option<WebSearchConfig>,
    reasoning_enabled: bool,
    provider_type: Option<ProviderType>,
    provider_config_id: Option<i64>,
    account_id: Option<String>,
    token: Option<String>,
) -> Result<(), String> {
    check_account(&state, token.as_deref(), account_id.as_deref()).await?;
    let my_generation_id = state.current_generation_id.load(Ordering::SeqCst);

    let provider_type = provider_type.unwrap_or(ProviderType::OllamaLocal);
    let provider = match provider_config_id {
        Some(config_id) => {
            state
                .provider_selector
                .get_provider_by_config_id(provider_type, config_id, account_id.as_deref())
                .await
        }
        None => {
            state
                .provider_selector
                .get_provider(provider_type, account_id.as_deref())
                .await
        }
    }
    .map_err(|e| e.to_string())?;

    let memory_context = match account_id.as_deref() {
        Some(owner_id) if !owner_id.trim().is_empty() => {
            let recall_query = messages
                .iter()
                .rev()
                .find(|message| message.role == "user")
                .map(|message| message.content.as_str())
                .unwrap_or_default();
            match MemoryService::new(state.db.clone())
                .build_context_for_chat(owner_id, &conversation_id, recall_query)
                .await
            {
                Ok(context) => context,
                Err(error) => {
                    log::warn!("Memory recall skipped: {error}");
                    String::new()
                }
            }
        }
        _ => String::new(),
    };
    let system_prompt = append_memory_context(system_prompt, memory_context);

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

fn append_memory_context(system_prompt: Option<String>, memory_context: String) -> Option<String> {
    if memory_context.trim().is_empty() {
        return system_prompt;
    }
    Some(match system_prompt {
        Some(prompt) if !prompt.trim().is_empty() => format!("{prompt}\n\n{memory_context}"),
        _ => memory_context,
    })
}

#[cfg(test)]
mod tests {
    use super::append_memory_context;

    #[test]
    fn memory_context_appends_without_replacing_prompt() {
        let prompt = append_memory_context(
            Some("System".to_string()),
            "<poly_memory>x</poly_memory>".to_string(),
        );
        assert_eq!(prompt.unwrap(), "System\n\n<poly_memory>x</poly_memory>");
    }

    #[test]
    fn empty_memory_context_preserves_prompt() {
        assert_eq!(
            append_memory_context(Some("System".to_string()), String::new()).unwrap(),
            "System"
        );
    }
}

#[tauri::command]
pub async fn chat(
    state: tauri::State<'_, AppState>,
    model: String,
    messages: Vec<ChatMessage>,
    options: Option<Value>,
    provider_type: Option<ProviderType>,
    account_id: Option<String>,
    token: Option<String>,
) -> Result<String, String> {
    check_account(&state, token.as_deref(), account_id.as_deref()).await?;
    let provider = state
        .provider_selector
        .get_provider(
            provider_type.unwrap_or(ProviderType::OllamaLocal),
            account_id.as_deref(),
        )
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
    account_id: Option<String>,
    token: Option<String>,
) -> Result<Option<String>, String> {
    check_account(&state, token.as_deref(), account_id.as_deref()).await?;
    let provider = match state
        .provider_selector
        .get_provider(
            provider_type.unwrap_or(ProviderType::OllamaLocal),
            account_id.as_deref(),
        )
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
