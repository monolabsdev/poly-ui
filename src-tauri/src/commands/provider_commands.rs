use crate::error::AppError;
use crate::models::chat::ModelDetails;
use crate::providers::base::{ProviderConfig, ProviderStatus, ProviderType};
use crate::providers::factory::ProviderFactory;
use crate::AppState;

#[derive(serde::Serialize)]
pub struct ProviderStatusResponse {
    pub provider_type: ProviderType,
    pub status: ProviderStatus,
    pub config: ProviderConfig,
}

#[derive(serde::Serialize)]
pub struct ProviderAndModelsResponse {
    pub providers: Vec<ProviderStatusResponse>,
    pub models: Vec<ModelDetails>,
}

#[tauri::command]
pub async fn get_providers(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ProviderStatusResponse>, String> {
    let selector = &state.provider_selector;
    let configs = selector.get_provider_configs().await.map_err(|e| AppError::Db(e).to_string())?;
    let health = selector.check_all_providers().await;

    let mut response = Vec::new();
    for config in configs {
        let status = health.get(&config.provider_type).cloned().unwrap_or(ProviderStatus::Offline);
        response.push(ProviderStatusResponse { provider_type: config.provider_type, status, config });
    }
    Ok(response)
}

#[tauri::command]
pub async fn get_provider_and_models(
    state: tauri::State<'_, AppState>,
) -> Result<ProviderAndModelsResponse, String> {
    let selector = &state.provider_selector;
    let configs = selector.get_provider_configs().await.map_err(|e| AppError::Db(e).to_string())?;
    let health = selector.check_all_providers().await;

    let mut providers = Vec::new();
    let mut models = Vec::new();
    let mut online_config: Option<ProviderConfig> = None;

    for config in configs {
        let status = health.get(&config.provider_type).cloned().unwrap_or(ProviderStatus::Offline);
        if status == ProviderStatus::Online && online_config.is_none() {
            online_config = Some(config);
        } else {
            providers.push(ProviderStatusResponse { provider_type: config.provider_type, status, config });
        }
    }

    if let Some(config) = online_config {
        providers.push(ProviderStatusResponse { provider_type: config.provider_type, status: ProviderStatus::Online, config: config.clone() });
        if let Some(provider) = ProviderFactory::create(config) {
            models = provider.get_available_models().await.map_err(|e| AppError::Provider(e).to_string())?;
        }
    }

    Ok(ProviderAndModelsResponse { providers, models })
}

#[derive(serde::Deserialize)]
pub struct UpdateProviderConfigRequest {
    pub provider_type: ProviderType,
    pub enabled: bool,
    #[serde(default)]
    pub ollama_host: Option<String>,
    #[serde(default)]
    pub ollama_api_key: Option<String>,
    #[serde(default)]
    pub ollama_api_base_url: Option<String>,
}

#[tauri::command]
pub async fn update_provider_config(
    state: tauri::State<'_, AppState>,
    request: UpdateProviderConfigRequest,
) -> Result<(), String> {
    state
        .provider_selector
        .update_provider_config(&request.provider_type, request.enabled, request.ollama_host, request.ollama_api_key, request.ollama_api_base_url)
        .await
        .map_err(|e| AppError::Db(e).to_string())
}
