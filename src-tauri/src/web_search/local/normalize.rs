use super::types::WebSearchError;
use url::{form_urlencoded, Url};

const TRACKING_KEYS: &[&str] = &[
    "fbclid", "gclid", "dclid", "mc_cid", "mc_eid", "igshid", "msclkid",
];

pub fn normalize_url(raw: &str) -> Result<Url, WebSearchError> {
    let raw = unwrap_redirect(raw);
    let mut url = Url::parse(&raw).map_err(|_| WebSearchError::InvalidUrl)?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err(WebSearchError::InvalidUrl),
    }
    url.set_fragment(None);
    let scheme = url.scheme().to_ascii_lowercase();
    let _ = url.set_scheme(&scheme);
    if let Some(host) = url.host_str().map(|h| h.to_ascii_lowercase()) {
        url.set_host(Some(&host))
            .map_err(|_| WebSearchError::InvalidUrl)?;
    }
    if (url.scheme() == "https" && url.port() == Some(443))
        || (url.scheme() == "http" && url.port() == Some(80))
    {
        let _ = url.set_port(None);
    }
    normalize_query(&mut url);
    Ok(url)
}

pub fn display_url(url: &Url) -> String {
    let host = url.host_str().unwrap_or_default();
    let path = url.path().trim_end_matches('/');
    if path.is_empty() || path == "/" {
        host.to_string()
    } else {
        format!("{host}{path}")
    }
}

fn normalize_query(url: &mut Url) {
    let Some(query) = url.query() else {
        return;
    };
    let mut pairs: Vec<(String, String)> = form_urlencoded::parse(query.as_bytes())
        .filter_map(|(k, v)| {
            let key = k.to_string();
            if key.starts_with("utm_") || TRACKING_KEYS.contains(&key.as_str()) {
                None
            } else {
                Some((key, v.to_string()))
            }
        })
        .collect();
    pairs.sort();
    if pairs.is_empty() {
        url.set_query(None);
        return;
    }
    let query = pairs
        .into_iter()
        .fold(
            form_urlencoded::Serializer::new(String::new()),
            |mut s, (k, v)| {
                s.append_pair(&k, &v);
                s
            },
        )
        .finish();
    url.set_query(Some(&query));
}

fn unwrap_redirect(raw: &str) -> String {
    let Ok(url) = Url::parse(raw) else {
        return raw.to_string();
    };
    let host = url.host_str().unwrap_or_default();
    if !(host.contains("duckduckgo.") || host.contains("brave.") || host.contains("mojeek.")) {
        return raw.to_string();
    }
    for key in ["uddg", "u", "url", "q"] {
        if let Some((_, value)) = url.query_pairs().find(|(k, _)| k == key) {
            if value.starts_with("http://") || value.starts_with("https://") {
                return value.to_string();
            }
        }
    }
    raw.to_string()
}
