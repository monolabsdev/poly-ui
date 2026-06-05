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

fn should_preload_models(provider_type: ProviderType) -> bool {
    provider_type == ProviderType::OllamaLocal
}

async fn try_preload_models(
    config: &ProviderConfig,
) -> Option<(Vec<ModelDetails>, ProviderStatus)> {
    let provider = ProviderFactory::create(config.clone())?;
    let result = match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        provider.get_available_models(),
    )
    .await
    {
        Ok(Ok(models)) => (models, ProviderStatus::Online),
        Ok(Err(error)) => {
            eprintln!(
                "[Providers] Failed to list {:?} models: {error}",
                provider.get_provider_type()
            );
            (Vec::new(), ProviderStatus::Offline)
        }
        Err(_) => {
            eprintln!(
                "[Providers] Timed out listing {:?} models",
                provider.get_provider_type()
            );
            (Vec::new(), ProviderStatus::Offline)
        }
    };
    Some(result)
}

fn config_health_key(config: &ProviderConfig) -> i64 {
    config.id.unwrap_or(0)
}

#[tauri::command]
pub async fn get_providers(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ProviderStatusResponse>, String> {
    let selector = &state.provider_selector;
    let configs = selector
        .get_provider_configs()
        .await
        .map_err(|e| AppError::Db(e).to_string())?;
    let health = selector.check_all_providers().await;

    let mut response = Vec::new();
    for config in configs {
        let key = config_health_key(&config);
        let status = health
            .get(&key)
            .cloned()
            .unwrap_or(ProviderStatus::Offline);
        response.push(ProviderStatusResponse {
            provider_type: config.provider_type,
            status,
            config,
        });
    }
    Ok(response)
}

#[tauri::command]
pub async fn get_provider_and_models(
    state: tauri::State<'_, AppState>,
) -> Result<ProviderAndModelsResponse, String> {
    let selector = &state.provider_selector;
    let configs = selector
        .get_provider_configs()
        .await
        .map_err(|e| AppError::Db(e).to_string())?;
    let health = selector.check_all_providers().await;

    let mut providers = Vec::new();
    let mut models = Vec::new();
    for config in configs {
        let key = config_health_key(&config);
        let mut status = health
            .get(&key)
            .cloned()
            .unwrap_or(ProviderStatus::Offline);
        if status == ProviderStatus::Online && should_preload_models(config.provider_type) {
            if let Some((preloaded_models, preload_status)) = try_preload_models(&config).await {
                models.extend(preloaded_models);
                status = preload_status;
            }
        }
        providers.push(ProviderStatusResponse {
            provider_type: config.provider_type,
            status,
            config: config.clone(),
        });
    }

    Ok(ProviderAndModelsResponse { providers, models })
}

#[tauri::command]
pub async fn get_provider_models(
    state: tauri::State<'_, AppState>,
    provider_type: ProviderType,
) -> Result<Vec<ModelDetails>, String> {
    let provider = state.provider_selector.get_provider(provider_type).await?;

    tokio::time::timeout(
        std::time::Duration::from_secs(10),
        provider.get_available_models(),
    )
    .await
    .map_err(|_| format!("Timed out listing {provider_type:?} models."))?
}

#[derive(serde::Deserialize)]
pub struct UpdateProviderConfigRequest {
    pub provider_type: ProviderType,
    pub enabled: bool,
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub ollama_host: Option<String>,
    #[serde(default)]
    pub ollama_api_key: Option<String>,
    #[serde(default)]
    pub ollama_api_base_url: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub api_base_url: Option<String>,
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub headers: Option<String>,
    #[serde(default)]
    pub model_suggestions: Option<String>,
}

#[tauri::command]
pub async fn update_provider_config(
    state: tauri::State<'_, AppState>,
    request: UpdateProviderConfigRequest,
) -> Result<(), String> {
    state
        .provider_selector
        .update_provider_config(
            request.id,
            &request.provider_type,
            request.enabled,
            request.ollama_host,
            request.ollama_api_key,
            request.ollama_api_base_url,
            request.api_key,
            request.api_base_url,
            request.preset,
            request.headers,
            request.model_suggestions,
        )
        .await
        .map_err(|e| AppError::Db(e).to_string())
}

#[derive(serde::Deserialize)]
pub struct AddProviderRequest {
    pub provider_type: ProviderType,
    pub enabled: bool,
    #[serde(default)]
    pub ollama_host: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub api_base_url: Option<String>,
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub headers: Option<String>,
    #[serde(default)]
    pub model_suggestions: Option<String>,
}

#[tauri::command]
pub async fn add_provider(
    state: tauri::State<'_, AppState>,
    request: AddProviderRequest,
) -> Result<i64, String> {
    state
        .provider_selector
        .add_provider_config(
            &request.provider_type,
            request.enabled,
            request.ollama_host,
            request.api_key,
            request.api_base_url,
            request.preset,
            request.headers,
            request.model_suggestions,
        )
        .await
        .map_err(|e| AppError::Db(e).to_string())
}

#[tauri::command]
pub async fn delete_provider(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state
        .provider_selector
        .delete_provider_config(id)
        .await
        .map_err(|e| AppError::Db(e).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preloads_only_local_models() {
        assert!(should_preload_models(ProviderType::OllamaLocal));
        assert!(!should_preload_models(ProviderType::OpenAICompatible));
    }
}
