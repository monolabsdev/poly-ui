use crate::AppState;
use crate::providers::base::{ProviderConfig, ProviderStatus, ProviderType};

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
    let selector = &state.provider_selector;
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
