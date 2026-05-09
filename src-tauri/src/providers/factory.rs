use crate::providers::base::{LLMProvider, ProviderConfig, ProviderType};
use crate::providers::ollama::OllamaProvider;

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create(config: ProviderConfig) -> Option<Box<dyn LLMProvider>> {
        if !config.enabled {
            return None;
        }

        match config.provider_type {
            ProviderType::OllamaLocal => {
                let host = config.ollama_host.unwrap_or_else(|| "http://localhost:11434".to_string());
                Some(Box::new(OllamaProvider::new(host, ProviderType::OllamaLocal, None)))
            }
            ProviderType::OllamaAPI => {
                let host = config.ollama_api_base_url?;
                Some(Box::new(OllamaProvider::new(host, ProviderType::OllamaAPI, config.ollama_api_key)))
            }
            _ => None, // Anthropic and OpenAI not implemented yet
        }
    }
}
