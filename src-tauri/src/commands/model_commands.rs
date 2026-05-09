use crate::models::chat::ModelDetails;
use crate::AppState;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};
use tokio_stream::StreamExt;

#[tauri::command]
pub async fn get_local_models(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ModelDetails>, String> {
    let provider = state.provider_selector.get_active_provider().await?;
    provider.get_available_models().await
}

#[tauri::command]
pub async fn delete_model(state: tauri::State<'_, AppState>, model: String) -> Result<(), String> {
    let provider = state.provider_selector.get_active_provider().await?;
    provider.delete_model(model).await
}

#[tauri::command]
pub async fn pull_model(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    model: String,
) -> Result<(), String> {
    state.is_pull_cancelled.store(false, Ordering::SeqCst);
    let provider = state.provider_selector.get_active_provider().await?;
    let mut stream = provider.pull_model(model).await?;

    while let Some(result) = stream.next().await {
        if state.is_pull_cancelled.load(Ordering::SeqCst) {
            return Err("Pull cancelled by user".to_string());
        }

        let payload = result.map_err(|e| e.to_string())?;
        let _ = app_handle.emit("pull-progress", payload);
    }

    Ok(())
}

#[tauri::command]
pub fn cancel_pull(state: tauri::State<'_, AppState>) {
    state.is_pull_cancelled.store(true, Ordering::SeqCst);
}
