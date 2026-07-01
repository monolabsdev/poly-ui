use super::normalize::normalize_url;
use super::passages::select_passages;
use super::search::{http_client, resolve_result};
use super::security::validate_public_http_url;
use super::types::{
    ReadWebResultsRequest, ReadWebResultsResponse, ResultFailure, WebSearchError, WebSource,
};
use chrono::Utc;
use futures::StreamExt;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const MAX_HTML_BYTES: usize = 4 * 1024 * 1024;
const DOC_CACHE_TTL: Duration = Duration::from_secs(30 * 60);

static DOC_CACHE: OnceLock<Mutex<HashMap<String, (Instant, CachedDoc)>>> = OnceLock::new();

#[derive(Clone)]
struct CachedDoc {
    title: String,
    canonical_url: String,
    text: String,
    retrieved_at: String,
}

pub async fn read_web_results(request: ReadWebResultsRequest) -> ReadWebResultsResponse {
    let limit = request.max_passages_per_result.unwrap_or(3).clamp(1, 5);
    let mut sources = Vec::new();
    let mut failed_results = Vec::new();

    for result_id in request.result_ids.iter().take(8) {
        let Some((query, result)) = resolve_result(result_id) else {
            failed_results.push(ResultFailure {
                result_id: result_id.clone(),
                error: "unknown_result_id".into(),
            });
            continue;
        };
        match fetch_or_cached(&result.url).await {
            Ok(doc) => {
                let passages = select_passages(&query, &doc.text, limit);
                if passages.is_empty() {
                    failed_results.push(ResultFailure {
                        result_id: result_id.clone(),
                        error: WebSearchError::ExtractionFailed.to_string(),
                    });
                    continue;
                }
                let domain = normalize_url(&doc.canonical_url)
                    .ok()
                    .and_then(|u| u.host_str().map(str::to_string))
                    .unwrap_or_default();
                sources.push(WebSource {
                    source_id: source_id(&doc.canonical_url),
                    result_id: result_id.clone(),
                    title: if doc.title.trim().is_empty() {
                        result.title
                    } else {
                        doc.title
                    },
                    url: result.url,
                    canonical_url: doc.canonical_url,
                    domain,
                    published_at: result.published_at,
                    retrieved_at: doc.retrieved_at,
                    passages,
                    trust: "untrusted_web_content",
                });
            }
            Err(error) => failed_results.push(ResultFailure {
                result_id: result_id.clone(),
                error: error.to_string(),
            }),
        }
    }

    ReadWebResultsResponse {
        sources,
        failed_results,
    }
}

async fn fetch_or_cached(url: &str) -> Result<CachedDoc, WebSearchError> {
    if let Some(doc) = cached_doc(url) {
        return Ok(doc);
    }
    let url = validate_public_http_url(url)?;
    let response = http_client()
        .get(url.clone())
        .send()
        .await
        .map_err(|_| WebSearchError::ProviderUnavailable)?;
    if !response.status().is_success() {
        return Err(WebSearchError::ProviderUnavailable);
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.contains("text/html") && !content_type.contains("text/plain") {
        return Err(WebSearchError::UnsupportedContentType);
    }
    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| WebSearchError::ProviderUnavailable)?;
        body.extend_from_slice(&chunk);
        if body.len() > MAX_HTML_BYTES {
            return Err(WebSearchError::ResponseTooLarge);
        }
    }
    let html = String::from_utf8_lossy(&body);
    if html.to_ascii_lowercase().contains("<script") && !html.to_ascii_lowercase().contains("<p") {
        return Err(WebSearchError::DynamicPageUnsupported);
    }
    let doc = extract_doc(url.as_str(), &html)?;
    put_doc(url.as_str().to_string(), doc.clone());
    Ok(doc)
}

fn extract_doc(url: &str, html: &str) -> Result<CachedDoc, WebSearchError> {
    let title = tag_text(html, "title").unwrap_or_default();
    let canonical_url = meta_attr(html, "link", "rel", "canonical", "href")
        .and_then(|href| normalize_url(&href).ok())
        .map(|url| url.to_string())
        .unwrap_or_else(|| url.to_string());
    let text = readable_text(html);
    if text.len() < 120 {
        return Err(WebSearchError::ExtractionFailed);
    }
    Ok(CachedDoc {
        title,
        canonical_url,
        text: text.chars().take(50_000).collect(),
        retrieved_at: Utc::now().to_rfc3339(),
    })
}

fn readable_text(html: &str) -> String {
    let mut s = html.to_string();
    for tag in ["script", "style", "nav", "footer", "form", "svg"] {
        s = remove_tag_blocks(&s, tag);
    }
    let main = tag_text(&s, "article")
        .or_else(|| tag_text(&s, "main"))
        .unwrap_or(s);
    strip_tags(&main)
        .lines()
        .map(str::trim)
        .filter(|line| line.len() > 30)
        .collect::<Vec<_>>()
        .join("\n")
}

fn remove_tag_blocks(html: &str, tag: &str) -> String {
    let mut rest = html;
    let mut out = String::new();
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    while let Some(start) = rest.to_ascii_lowercase().find(&open) {
        out.push_str(&rest[..start]);
        let after = &rest[start..];
        if let Some(end) = after.to_ascii_lowercase().find(&close) {
            rest = &after[end + close.len()..];
        } else {
            rest = "";
            break;
        }
    }
    out.push_str(rest);
    out
}

fn tag_text(html: &str, tag: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let start = lower.find(&format!("<{tag}"))?;
    let after_start = html[start..].find('>')? + start + 1;
    let end = lower[after_start..].find(&format!("</{tag}>"))? + after_start;
    Some(strip_tags(&html[after_start..end]))
}

fn meta_attr(
    html: &str,
    tag: &str,
    match_attr: &str,
    match_value: &str,
    want_attr: &str,
) -> Option<String> {
    for part in html.split('<').filter(|p| p.starts_with(tag)) {
        if !part
            .to_ascii_lowercase()
            .contains(&format!("{match_attr}=\"{match_value}\""))
        {
            continue;
        }
        let needle = format!("{want_attr}=\"");
        let start = part.find(&needle)? + needle.len();
        let rest = &part[start..];
        let end = rest.find('"')?;
        return Some(html_unescape(&rest[..end]));
    }
    None
}

fn strip_tags(value: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for ch in html_unescape(value).chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push('\n');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out
}

fn html_unescape(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
}

fn source_id(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    let hex: String = digest[..8].iter().map(|b| format!("{b:02x}")).collect();
    format!("source-{hex}")
}

fn cached_doc(url: &str) -> Option<CachedDoc> {
    let cache = DOC_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().ok()?;
    let now = Instant::now();
    guard.retain(|_, (created, _)| now.duration_since(*created) < DOC_CACHE_TTL);
    guard.get(url).map(|(_, doc)| doc.clone())
}

fn put_doc(url: String, doc: CachedDoc) {
    let cache = DOC_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Ok(mut guard) = cache.lock() {
        if guard.len() > 128 {
            guard.clear();
        }
        guard.insert(url, (Instant::now(), doc));
    }
}
