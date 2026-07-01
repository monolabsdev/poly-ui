use super::normalize::display_url;
use super::types::{RawSearchResult, SearchResult};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use url::Url;

pub fn rank_and_fuse(
    query: &str,
    raw: Vec<RawSearchResult>,
    max_results: usize,
) -> Vec<SearchResult> {
    let terms = terms(query);
    let mut by_url: HashMap<String, SearchResult> = HashMap::new();
    let mut provider_ranks: HashMap<String, f64> = HashMap::new();

    for item in raw {
        let key = canonical_key(&item.url);
        let rrf = 1.0 / (60.0 + item.rank as f64);
        provider_ranks
            .entry(key.clone())
            .and_modify(|score| *score += rrf)
            .or_insert(rrf);
        by_url
            .entry(key)
            .and_modify(|existing| {
                if !existing.providers.contains(&item.provider) {
                    existing.providers.push(item.provider.clone());
                }
                if existing.snippet.len() < item.snippet.len() {
                    existing.snippet = item.snippet.clone();
                }
            })
            .or_insert_with(|| SearchResult {
                id: stable_id(item.url.as_str()),
                title: clean(&item.title),
                url: item.url.to_string(),
                display_url: display_url(&item.url),
                snippet: clean(&item.snippet),
                published_at: item.published_at.clone(),
                providers: vec![item.provider.clone()],
                score: 0.0,
            });
    }

    let mut seen_domains = HashSet::new();
    let mut results: Vec<SearchResult> = by_url
        .into_iter()
        .map(|(key, mut result)| {
            let text = format!("{} {}", result.title, result.snippet).to_ascii_lowercase();
            let mut score = *provider_ranks.get(&key).unwrap_or(&0.0);
            let matched = terms
                .iter()
                .filter(|term| text.contains(term.as_str()))
                .count();
            score += matched as f64 * 0.08;
            if text.contains(&query.to_ascii_lowercase()) {
                score += 0.18;
            }
            if result.providers.len() > 1 {
                score += 0.12;
            }
            if is_low_quality(&result.url) {
                score -= 0.15;
            }
            result.score = (score * 1000.0).round() / 1000.0;
            result.providers.sort();
            result
        })
        .collect();

    results.sort_by(|a, b| b.score.total_cmp(&a.score).then_with(|| a.url.cmp(&b.url)));
    results.retain(|result| {
        let domain = Url::parse(&result.url)
            .ok()
            .and_then(|url| url.host_str().map(str::to_string))
            .unwrap_or_default();
        if seen_domains.contains(&domain) && seen_domains.len() >= max_results / 2 {
            return false;
        }
        seen_domains.insert(domain);
        true
    });
    results.truncate(max_results);
    results
}

pub fn stable_id(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    format!("result-{}", hex8(&digest))
}

fn hex8(bytes: &[u8]) -> String {
    bytes[..8].iter().map(|b| format!("{b:02x}")).collect()
}

fn canonical_key(url: &Url) -> String {
    let mut key = url.clone();
    key.set_query(None);
    key.to_string().trim_end_matches('/').to_string()
}

fn terms(query: &str) -> Vec<String> {
    query
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|part| part.len() > 2)
        .map(str::to_ascii_lowercase)
        .collect()
}

fn clean(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_low_quality(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.contains("/tag/") || lower.contains("/search?") || lower.contains("pinterest.")
}
