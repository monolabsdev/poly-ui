use crate::AppState;
use crate::providers::base::{ProviderConfig, ProviderStatus, ProviderType};
use std::collections::HashMap;

#[derive(serde::Serialize)]
pub struct ProviderStatusResponse {
    pub provider_type: ProviderType,
    pub status: ProviderStatus,
    pub config: ProviderConfig,
}

#[tauri::command]
pub async fn get_providers(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ProviderStatusResponse>, String> {
    println!("[Command] get_providers called");
    let selector = &state.provider_selector;
    println!("[Command] selector acquired, calling get_provider_configs...");
    let configs = selector.get_provider_configs().await?;
    let health = selector.check_all_providers().await;

    let mut response = Vec::new();
    for config in configs {
        let status = health.get(&config.provider_type).cloned().unwrap_or(ProviderStatus::Offline);
        response.push(ProviderStatusResponse {
            provider_type: config.provider_type,
            status,
            config,
        });
    }

    Ok(response)
}

#[tauri::command]
pub async fn update_provider_config(
    state: tauri::State<'_, AppState>,
    config: ProviderConfig,
) -> Result<(), String> {
    sqlx::query(
        r#"
        UPDATE provider_configs 
        SET enabled = ?, ollama_host = ?, ollama_api_key = ?, ollama_api_base_url = ?, priority = ?, updated_at = datetime('now')
        WHERE provider_type = ?
        "#,
    )
    .bind(config.enabled)
    .bind(config.ollama_host)
    .bind(config.ollama_api_key)
    .bind(config.ollama_api_base_url)
    .bind(config.priority)
    .bind(config.provider_type)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn refresh_provider_health(
    state: tauri::State<'_, AppState>,
) -> Result<HashMap<ProviderType, ProviderStatus>, String> {
    Ok(state.provider_selector.force_check_all_providers().await)
}
