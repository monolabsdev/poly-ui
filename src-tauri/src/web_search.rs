use crate::models::chat::SearchResultItem;
use async_trait::async_trait;
use serde::Deserialize;

#[async_trait]
pub trait WebSearchClient: Send + Sync {
    async fn search(&self, query: &str, api_key: &str) -> Result<Vec<SearchResultItem>, String>;
}

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
    async fn search(&self, query: &str, api_key: &str) -> Result<Vec<SearchResultItem>, String> {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.exa.ai/search")
            .header("x-api-key", api_key)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "query": query,
                "type": "auto",
                "num_results": 5,
                "contents": {
                    "highlights": true
                }
            }))
            .send()
            .await
            .map_err(|e| format!("Exa request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Exa API error ({}): {}", status, body));
        }

        let exa: ExaResponse = resp
            .json()
            .await
            .map_err(|e| format!("Exa parse failed: {}", e))?;

        Ok(exa
            .results
            .into_iter()
            .map(|r| {
                let highlights: Vec<String> = r
                    .highlights
                    .into_iter()
                    .take(2)
                    .map(|h| {
                        if h.len() > 180 {
                            format!("{}…", &h[..180])
                        } else {
                            h
                        }
                    })
                    .collect();
                SearchResultItem {
                    title: r.title,
                    url: r.url,
                    highlights,
                }
            })
            .collect())
    }
}

#[cfg(test)]
pub mod test {
    use super::*;

    pub struct MockWebSearchClient {
        pub results: Vec<SearchResultItem>,
        pub should_fail: bool,
    }

    impl MockWebSearchClient {
        pub fn new(results: Vec<SearchResultItem>) -> Self {
            Self {
                results,
                should_fail: false,
            }
        }
    }

    #[async_trait]
    impl WebSearchClient for MockWebSearchClient {
        async fn search(&self, _query: &str, _api_key: &str) -> Result<Vec<SearchResultItem>, String> {
            if self.should_fail {
                Err("Mock search failed".to_string())
            } else {
                Ok(self.results.clone())
            }
        }
    }
}
