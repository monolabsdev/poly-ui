use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use futures::Stream;
use std::pin::Pin;
use crate::models::chat::{ChatMessage, StreamPayload};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash, sqlx::Type)]
pub enum ProviderType {
    OllamaLocal,
    OllamaAPI,
    Anthropic,
    OpenAI,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum ProviderStatus {
    Online,
    Offline,
    Reconnecting,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProviderConfig {
    pub provider_type: ProviderType,
    pub enabled: bool,
    pub ollama_host: Option<String>,
    pub ollama_api_key: Option<String>,
    pub ollama_api_base_url: Option<String>,
    pub priority: i32,
}

#[async_trait]
pub trait LLMProvider: Send + Sync {
    async fn health_check(&self) -> ProviderStatus;
    async fn chat_completion(
        &self,
        model: String,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        tools: Option<Vec<serde_json::Value>>,
        options: Option<serde_json::Value>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamPayload, String>> + Send>>, String>;
    async fn get_available_models(&self) -> Result<Vec<crate::models::chat::ModelDetails>, String>;
    async fn pull_model(&self, model: String) -> Result<Pin<Box<dyn Stream<Item = Result<crate::models::chat::PullProgressPayload, String>> + Send>>, String>;
    async fn delete_model(&self, model: String) -> Result<(), String>;
    fn get_provider_name(&self) -> String;
    fn get_provider_type(&self) -> ProviderType;
}
