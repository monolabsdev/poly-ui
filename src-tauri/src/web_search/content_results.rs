use super::truncate_highlight;
use crate::models::chat::SearchResultItem;
use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct ContentResultsResponse {
    pub results: Vec<ContentResult>,
}

#[derive(Deserialize)]
pub(super) struct ContentResult {
    pub title: String,
    pub url: String,
    pub content: String,
}

pub(super) fn normalize_results(response: ContentResultsResponse) -> Vec<SearchResultItem> {
    response
        .results
        .into_iter()
        .map(|result| SearchResultItem {
            title: result.title,
            url: result.url,
            highlights: vec![truncate_highlight(result.content)],
        })
        .collect()
}
