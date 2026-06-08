use crate::models::chat::ModelDetails;
use crate::providers::base::ProviderType;
use crate::AppState;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tokio_stream::StreamExt;

#[tauri::command]
pub async fn get_local_models(
    state: tauri::State<'_, AppState>,
    account_id: Option<String>,
) -> Result<Vec<ModelDetails>, String> {
    let provider = state
        .provider_selector
        .get_provider(ProviderType::OllamaLocal, account_id.as_deref())
        .await?;
    provider.get_available_models().await
}

#[tauri::command]
pub async fn delete_model(
    state: tauri::State<'_, AppState>,
    model: String,
    account_id: Option<String>,
) -> Result<(), String> {
    let provider = state
        .provider_selector
        .get_provider(ProviderType::OllamaLocal, account_id.as_deref())
        .await?;
    provider.delete_model(model).await
}

#[tauri::command]
pub async fn pull_model(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    model: String,
    account_id: Option<String>,
) -> Result<(), String> {
    state.is_pull_cancelled.store(false, Ordering::SeqCst);
    let provider = state
        .provider_selector
        .get_provider(ProviderType::OllamaLocal, account_id.as_deref())
        .await?;

    let mut stream = provider
        .pull_model(model.clone())
        .await
        .map_err(|e| format!("Failed to start pull: {}", e))?;

    let mut last_error = String::new();
    while let Some(result) = stream.next().await {
        if state.is_pull_cancelled.load(Ordering::SeqCst) {
            return Err("Pull cancelled by user".to_string());
        }
        match result {
            Ok(payload) => {
                let _ = app_handle.emit("pull-progress", payload);
            }
            Err(e) => {
                last_error = e;
            }
        }
    }

    if last_error.is_empty() {
        return Ok(());
    }

    let lower = last_error.to_lowercase();
    if lower.contains("decode") {
        return Err(format!("Failed to pull {}: Ollama returned an invalid response. The model may still have been downloaded - try refreshing the model list.", model));
    }
    Err(format!("Failed to pull {}: {}", model, last_error))
}

#[tauri::command]
pub fn cancel_pull(state: tauri::State<'_, AppState>) {
    state.is_pull_cancelled.store(true, Ordering::SeqCst);
}
