use crate::providers::base::{LLMProvider, ProviderConfig, ProviderType};
use crate::providers::ollama::OllamaProvider;
use crate::providers::openai_compatible::OpenAICompatibleProvider;

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create(config: ProviderConfig) -> Option<Box<dyn LLMProvider>> {
        if !config.enabled {
            return None;
        }

        match config.provider_type {
            ProviderType::OllamaLocal => {
                let host = config
                    .ollama_host
                    .unwrap_or_else(|| "http://localhost:11434".to_string());
                let api_key = config.ollama_api_key.clone();
                Some(Box::new(OllamaProvider::new(
                    host,
                    ProviderType::OllamaLocal,
                    api_key,
                )))
            }
            ProviderType::OpenAICompatible => {
                let base_url = config
                    .api_base_url
                    .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
                Some(Box::new(OpenAICompatibleProvider::new(
                    base_url,
                    config.api_key.unwrap_or_default(),
                    config.headers.clone(),
                )))
            }
        }
    }
}
