use crate::models::chat::SearchResultItem;
use serde::Deserialize;

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

pub async fn search_exa(query: &str, api_key: &str) -> Result<Vec<SearchResultItem>, String> {
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
