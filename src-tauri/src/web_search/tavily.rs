use super::content_results::{normalize_results, ContentResultsResponse};
use super::{WebSearchClient, WebSearchProvider};
use crate::models::chat::SearchResultItem;
use async_trait::async_trait;

pub struct TavilyWebSearchClient;

#[async_trait]
impl WebSearchClient for TavilyWebSearchClient {
    fn provider(&self) -> WebSearchProvider {
        WebSearchProvider::Tavily
    }

    async fn search(&self, query: &str, api_key: &str) -> Result<Vec<SearchResultItem>, String> {
        let response = reqwest::Client::new()
            .post("https://api.tavily.com/search")
            .bearer_auth(api_key)
            .json(&serde_json::json!({
                "query": query,
                "search_depth": "basic",
                "max_results": 5
            }))
            .send()
            .await
            .map_err(|error| format!("Tavily request failed: {error}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Tavily API error ({status}): {body}"));
        }

        let response: ContentResultsResponse = response
            .json()
            .await
            .map_err(|error| format!("Tavily parse failed: {error}"))?;

        Ok(normalize_results(response))
    }
}
