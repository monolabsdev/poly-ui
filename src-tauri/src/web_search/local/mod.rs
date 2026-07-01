pub mod normalize;
pub mod passages;
pub mod providers;
pub mod ranking;
pub mod reader;
pub mod search;
pub mod security;
pub mod types;

pub use reader::read_web_results;
pub use search::search_web;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_urls_for_dedup_without_dropping_meaningful_query() {
        let url =
            normalize::normalize_url("HTTPS://Example.COM:443/docs/?b=2&utm_source=x&a=1#section")
                .unwrap();

        assert_eq!(url.as_str(), "https://example.com/docs/?a=1&b=2");
    }

    #[test]
    fn unwraps_search_redirect_urls() {
        let url = normalize::normalize_url(
            "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.rs%2Ftokio%2Flatest%2Ftokio%2F",
        )
        .unwrap();

        assert_eq!(url.as_str(), "https://docs.rs/tokio/latest/tokio/");
    }

    #[test]
    fn blocks_ssrf_targets() {
        for raw in [
            "http://localhost/",
            "http://127.0.0.1/",
            "http://10.1.2.3/",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]/",
            "file:///etc/passwd",
            "http://printer.local/",
        ] {
            assert!(security::validate_public_http_url(raw).is_err(), "{raw}");
        }
    }

    #[test]
    fn fuses_duplicate_results_and_keeps_providers() {
        let results = ranking::rank_and_fuse(
            "rust async runtime",
            vec![
                types::RawSearchResult::new(
                    "duckduckgo",
                    1,
                    "Tokio - async runtime",
                    "https://tokio.rs/?utm_campaign=x",
                    "Runtime for writing reliable async apps.",
                )
                .unwrap(),
                types::RawSearchResult::new(
                    "mojeek",
                    2,
                    "Tokio async runtime",
                    "https://tokio.rs/",
                    "Rust async runtime.",
                )
                .unwrap(),
            ],
            8,
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].providers, vec!["duckduckgo", "mojeek"]);
    }

    #[test]
    fn splits_and_scores_passages() {
        let passages = passages::select_passages(
            "rust cancellation token",
            "Intro\nTokio cancellation token stops async work safely.\nOther text.\nRust futures can be cancelled by dropping.",
            2,
        );

        assert_eq!(passages.len(), 2);
        assert!(passages[0].text.contains("cancellation token"));
    }

    #[test]
    fn parses_duckduckgo_fixture() {
        let html = r#"
        <html><body>
          <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs">Example Docs</a>
          <a class="result__snippet">Useful docs snippet.</a>
        </body></html>
        "#;

        let results = providers::duckduckgo::parse_results(html).unwrap();

        assert_eq!(results[0].title, "Example Docs");
        assert_eq!(results[0].url.as_str(), "https://example.com/docs");
        assert_eq!(results[0].snippet, "Useful docs snippet.");
    }
}
