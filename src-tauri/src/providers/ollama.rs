use crate::models::chat::{ChatMessage, StreamMetadata, StreamPayload};
use crate::providers::base::{LLMProvider, ProviderStatus, ProviderType};
use async_trait::async_trait;
use futures::Stream;
use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::ChatMessage as OllamaChatMessage;
use ollama_rs::generation::parameters::FormatType;
use ollama_rs::models::ModelOptions;
use ollama_rs::Ollama;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use std::pin::Pin;
use tokio_stream::StreamExt;

pub struct OllamaProvider {
    client: Ollama,
    provider_type: ProviderType,
    _api_key: Option<String>,
}

impl OllamaProvider {
    pub fn new(base_url: String, provider_type: ProviderType, api_key: Option<String>) -> Self {
        let host = if base_url.starts_with("http") {
            base_url
        } else {
            format!("http://{base_url}")
        };

        let mut headers = HeaderMap::new();
        if let Some(ref key) = api_key {
            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", key)) {
                headers.insert(AUTHORIZATION, val);
            }
        }

        let reqwest_client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();

        let url = reqwest::Url::parse(&host)
            .unwrap_or_else(|_| reqwest::Url::parse("http://localhost:11434").unwrap());
        let scheme = url.scheme();
        let host_only = url.host_str().unwrap_or("localhost");
        let host_with_scheme = format!("{}://{}", scheme, host_only);
        let port = url.port().unwrap_or(11434);

        if cfg!(debug_assertions) {
            println!(
                "[OllamaProvider] Initializing with host: {}, port: {}",
                host_with_scheme, port
            );
        }

        let client = Ollama::new_with_client(host_with_scheme, port, reqwest_client);

        Self {
            client,
            provider_type,
            _api_key: api_key,
        }
    }
}

fn normalize_ollama_error(raw: impl std::fmt::Display) -> String {
    let msg = raw.to_string().to_lowercase();
    normalize_msg(&msg, raw.to_string())
}

fn normalize_ollama_stream_error(raw: impl std::fmt::Debug) -> String {
    let debug = format!("{:?}", raw);
    let msg = debug.to_lowercase();
    normalize_msg(&msg, debug)
}

fn normalize_msg(msg: &str, raw: String) -> String {
    if msg.contains("connection refused") || msg.contains("connect error") {
        return "Ollama is not running. Start Ollama and try again.".to_string();
    }
    if msg.contains("timed out") || msg.contains("timeout") {
        return "Request timed out. Ollama may be overloaded or the model is too large."
            .to_string();
    }
    if msg.contains("model") && (msg.contains("not found") || msg.contains("404")) {
        return "Model not found. Run `ollama pull <model>` to download it.".to_string();
    }
    if msg.contains("internal server error") {
        return "Ollama internal error. Try: 1) Pull the model again, 2) Restart Ollama, 3) Check `ollama logs` for details.".to_string();
    }
    if msg.contains("reqwest") {
        return format!("Network error reaching Ollama: {}", raw);
    }
    raw
}

#[async_trait]
impl LLMProvider for OllamaProvider {
    async fn health_check(&self) -> ProviderStatus {
        match self.client.list_local_models().await {
            Ok(_) => ProviderStatus::Online,
            Err(e) => {
                eprintln!(
                    "[OllamaProvider] Health check failed for {}: {}",
                    self.client.url(),
                    e
                );
                ProviderStatus::Offline
            }
        }
    }

    async fn chat_completion(
        &self,
        model: String,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        options: Option<serde_json::Value>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamPayload, String>> + Send>>, String> {
        let mut history: Vec<OllamaChatMessage> = Vec::new();

        if let Some(prompt) = system_prompt {
            if !prompt.trim().is_empty() {
                history.push(OllamaChatMessage::system(prompt));
            }
        }

        for msg in messages {
            let mut ollama_msg = match msg.role.as_str() {
                "assistant" => OllamaChatMessage::assistant(msg.content),
                "tool" => OllamaChatMessage::tool(msg.content),
                _ => OllamaChatMessage::user(msg.content),
            };

            if let Some(attachments) = msg.attachments {
                let images: Vec<ollama_rs::generation::images::Image> = attachments
                    .into_iter()
                    .filter(|a| a.content_type.starts_with("image/"))
                    .filter_map(|a| {
                        a.content
                            .map(|c| ollama_rs::generation::images::Image::from_base64(&c))
                    })
                    .collect();
                if !images.is_empty() {
                    ollama_msg.images = Some(images);
                }
            }

            history.push(ollama_msg);
        }

        let mut request = ChatMessageRequest::new(model.clone(), history);

        if let Some(mut opt) = options {
            if opt
                .get("format")
                .and_then(|value| value.as_str())
                .is_some_and(|value| value == "json")
            {
                request.format = Some(FormatType::Json);
                if let Some(object) = opt.as_object_mut() {
                    object.remove("format");
                }
            }

            if let Ok(model_opts) = serde_json::from_value::<ModelOptions>(opt) {
                request.options = Some(model_opts);
            }
        }

        let stream = self
            .client
            .send_chat_messages_stream(request)
            .await
            .map_err(|e| normalize_ollama_error(e))?;

        let model_clone = model.clone();
        let mapped_stream = stream.map(move |result| match result {
            Ok(response) => {
                let mut metadata = None;
                if let Some(fd) = response.final_data {
                    metadata = Some(StreamMetadata {
                        prompt_eval_count: Some(fd.prompt_eval_count),
                        eval_count: Some(fd.eval_count),
                        total_duration: Some(fd.total_duration),
                        load_duration: Some(fd.load_duration),
                        prompt_eval_duration: Some(fd.prompt_eval_duration),
                        eval_duration: Some(fd.eval_duration),
                        model: model_clone.clone(),
                    });
                }

                Ok(StreamPayload {
                    request_id: String::new(),
                    content: response.message.content,
                    thinking: response.message.thinking,
                    done: response.done,
                    metadata,
                })
            }
            Err(e) => Err(normalize_ollama_stream_error(e)),
        });

        Ok(Box::pin(mapped_stream))
    }

    async fn get_available_models(&self) -> Result<Vec<crate::models::chat::ModelDetails>, String> {
        self.client
            .list_local_models()
            .await
            .map_err(|e| normalize_ollama_error(e))
            .map(|models| {
                models
                    .into_iter()
                    .map(|m| crate::models::chat::ModelDetails {
                        name: m.name,
                        families: Vec::new(),
                        size: m.size,
                    })
                    .collect()
            })
    }

    async fn pull_model(
        &self,
        model: String,
    ) -> Result<
        Pin<
            Box<dyn Stream<Item = Result<crate::models::chat::PullProgressPayload, String>> + Send>,
        >,
        String,
    > {
        let stream = self
            .client
            .pull_model_stream(model, false)
            .await
            .map_err(|e| normalize_ollama_error(e))?;

        let mapped = stream.map(|result| match result {
            Ok(response) => Ok(crate::models::chat::PullProgressPayload {
                status: response.message,
                digest: response.digest,
                total: response.total,
                completed: response.completed,
            }),
            Err(e) => Err(normalize_ollama_stream_error(e)),
        });

        Ok(Box::pin(mapped))
    }

    async fn delete_model(&self, model: String) -> Result<(), String> {
        self.client
            .delete_model(model)
            .await
            .map_err(|e| normalize_ollama_error(e))
    }

    fn get_provider_name(&self) -> String {
        "Ollama".to_string()
    }

    fn get_provider_type(&self) -> ProviderType {
        self.provider_type
    }
}
