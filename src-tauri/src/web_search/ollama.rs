use super::content_results::{normalize_results, ContentResultsResponse};
use super::{WebSearchClient, WebSearchProvider};
use crate::models::chat::SearchResultItem;
use async_trait::async_trait;

pub struct OllamaWebSearchClient;

#[async_trait]
impl WebSearchClient for OllamaWebSearchClient {
    fn provider(&self) -> WebSearchProvider {
        WebSearchProvider::Ollama
    }

    async fn search(&self, query: &str, api_key: &str) -> Result<Vec<SearchResultItem>, String> {
        let response = reqwest::Client::new()
            .post("https://ollama.com/api/web_search")
            .bearer_auth(api_key)
            .json(&serde_json::json!({
                "query": query,
                "max_results": 5
            }))
            .send()
            .await
            .map_err(|error| format!("Ollama request failed: {error}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Ollama API error ({status}): {body}"));
        }

        let response: ContentResultsResponse = response
            .json()
            .await
            .map_err(|error| format!("Ollama parse failed: {error}"))?;

        Ok(normalize_results(response))
    }
}
