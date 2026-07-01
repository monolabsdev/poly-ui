pub mod brave;
pub mod duckduckgo;
pub mod mojeek;

use super::types::{RawSearchResult, SearchWebRequest, WebSearchError};
use async_trait::async_trait;
use reqwest::Client;
use std::time::Duration;

#[async_trait]
pub trait SearchProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn timeout(&self) -> Duration {
        Duration::from_millis(1800)
    }
    async fn search(
        &self,
        client: &Client,
        request: &SearchWebRequest,
    ) -> Result<Vec<RawSearchResult>, WebSearchError>;
}

fn html_text(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn attr(tag: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=\"");
    let start = tag.find(&needle)? + needle.len();
    let rest = &tag[start..];
    let end = rest.find('"')?;
    Some(html_text(&rest[..end]))
}

async fn fetch_html(client: &Client, url: String) -> Result<String, WebSearchError> {
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|_| WebSearchError::ProviderUnavailable)?;
    let status = res.status();
    if !status.is_success() {
        return Err(WebSearchError::ProviderUnavailable);
    }
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/html") && !content_type.is_empty() {
        return Err(WebSearchError::UnsupportedContentType);
    }
    res.text()
        .await
        .map_err(|_| WebSearchError::ProviderUnavailable)
}
