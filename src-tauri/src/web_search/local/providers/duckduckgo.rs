use super::{attr, fetch_html, html_text, SearchProvider};
use crate::web_search::local::types::{RawSearchResult, SearchWebRequest, WebSearchError};
use async_trait::async_trait;
use reqwest::Client;

pub struct DuckDuckGoProvider;

#[async_trait]
impl SearchProvider for DuckDuckGoProvider {
    fn id(&self) -> &'static str {
        "duckduckgo"
    }

    async fn search(
        &self,
        client: &Client,
        request: &SearchWebRequest,
    ) -> Result<Vec<RawSearchResult>, WebSearchError> {
        let url = format!(
            "https://html.duckduckgo.com/html/?q={}",
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
    for (idx, part) in html.split("result__a").skip(1).enumerate() {
        let Some(tag_end) = part.find('>') else {
            continue;
        };
        let tag_start = part[..tag_end].rfind('<').unwrap_or(0);
        let tag = &part[tag_start..tag_end];
        let Some(href) = attr(tag, "href") else {
            continue;
        };
        let title = part
            .split_once('>')
            .and_then(|(_, rest)| rest.split_once("</a>").map(|(t, _)| t))
            .map(strip_tags)
            .unwrap_or_default();
        let snippet = part
            .split("result__snippet")
            .nth(1)
            .and_then(|rest| {
                rest.split_once('>')
                    .and_then(|(_, r)| r.split_once("</").map(|(s, _)| s))
            })
            .map(strip_tags)
            .unwrap_or_default();
        let href = if href.starts_with('/') {
            format!("https://duckduckgo.com{href}")
        } else {
            href
        };
        if let Ok(result) = RawSearchResult::new("duckduckgo", idx + 1, title, &href, snippet) {
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
