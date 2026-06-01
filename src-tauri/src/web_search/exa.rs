use super::{truncate_highlight, WebSearchClient, WebSearchProvider};
use crate::models::chat::SearchResultItem;
use async_trait::async_trait;
use serde::Deserialize;

pub struct ExaWebSearchClient;

#[derive(Deserialize)]
struct ExaResponse {
    results: Vec<ExaResult>,
}

#[derive(Deserialize)]
struct ExaResult {
    title: String,
    url: String,
    highlights: Vec<String>,
}

#[async_trait]
impl WebSearchClient for ExaWebSearchClient {
    fn provider(&self) -> WebSearchProvider {
        WebSearchProvider::Exa
    }

    async fn search(&self, query: &str, api_key: &str) -> Result<Vec<SearchResultItem>, String> {
        let response = reqwest::Client::new()
            .post("https://api.exa.ai/search")
            .header("x-api-key", api_key)
            .json(&serde_json::json!({
                "query": query,
                "type": "auto",
                "num_results": 5,
                "contents": { "highlights": true }
            }))
            .send()
            .await
            .map_err(|error| format!("Exa request failed: {error}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Exa API error ({status}): {body}"));
        }

        let response: ExaResponse = response
            .json()
            .await
            .map_err(|error| format!("Exa parse failed: {error}"))?;

        Ok(response
            .results
            .into_iter()
            .map(|result| SearchResultItem {
                title: result.title,
                url: result.url,
                highlights: result
                    .highlights
                    .into_iter()
                    .take(2)
                    .map(truncate_highlight)
                    .collect(),
            })
            .collect())
    }
}
