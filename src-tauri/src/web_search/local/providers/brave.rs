use super::{attr, fetch_html, html_text, SearchProvider};
use crate::web_search::local::types::{RawSearchResult, SearchWebRequest, WebSearchError};
use async_trait::async_trait;
use reqwest::Client;

pub struct BraveProvider;

#[async_trait]
impl SearchProvider for BraveProvider {
    fn id(&self) -> &'static str {
        "brave"
    }

    async fn search(
        &self,
        client: &Client,
        request: &SearchWebRequest,
    ) -> Result<Vec<RawSearchResult>, WebSearchError> {
        let url = format!(
            "https://search.brave.com/search?q={}",
            url::form_urlencoded::byte_serialize(request.query.as_bytes()).collect::<String>()
        );
        parse_results(&fetch_html(client, url).await?)
    }
}

pub fn parse_results(html: &str) -> Result<Vec<RawSearchResult>, WebSearchError> {
    if html.to_ascii_lowercase().contains("captcha") {
        return Err(WebSearchError::ProviderUnavailable);
    }
    let mut out = Vec::new();
    for (idx, part) in html.split("result-header").skip(1).enumerate() {
        let Some(anchor) = part.split("<a").nth(1) else {
            continue;
        };
        let tag = anchor.split_once('>').map(|(t, _)| t).unwrap_or(anchor);
        let Some(href) = attr(tag, "href") else {
            continue;
        };
        let title = anchor
            .split_once('>')
            .and_then(|(_, rest)| rest.split_once("</a>").map(|(t, _)| strip_tags(t)))
            .unwrap_or_default();
        let snippet = part
            .split("snippet")
            .nth(1)
            .and_then(|rest| {
                rest.split_once('>')
                    .and_then(|(_, r)| r.split_once("</").map(|(s, _)| strip_tags(s)))
            })
            .unwrap_or_default();
        if let Ok(result) = RawSearchResult::new("brave", idx + 1, title, &href, snippet) {
            out.push(result);
        }
    }
    if out.is_empty() {
        return Err(WebSearchError::ProviderParseFailed);
    }
    Ok(out)
}

fn strip_tags(value: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    html_text(&out)
}
