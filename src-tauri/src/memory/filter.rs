use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SensitiveFinding {
    pub kind: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SensitiveFilterResult {
    pub redacted: String,
    pub findings: Vec<SensitiveFinding>,
    pub rejected: bool,
}

pub trait SensitiveDataFilter: Send + Sync {
    fn inspect(&self, input: &str) -> SensitiveFilterResult;
}

#[derive(Debug, Clone, Default)]
pub struct DeterministicSensitiveDataFilter;

impl SensitiveDataFilter for DeterministicSensitiveDataFilter {
    fn inspect(&self, input: &str) -> SensitiveFilterResult {
        inspect_sensitive(input)
    }
}

pub fn inspect_sensitive(input: &str) -> SensitiveFilterResult {
    let mut findings = Vec::new();
    let mut redacted_lines = Vec::new();

    for line in input.lines() {
        let lower = line.to_ascii_lowercase();
        let mut line_sensitive = false;

        for (kind, marker) in [
            ("password", "password"),
            ("api_key", "api_key"),
            ("api_key", "api key"),
            ("token", "auth token"),
            ("token", "access_token"),
            ("token", "bearer "),
            ("cookie", "session cookie"),
            ("cookie", "set-cookie"),
            ("private_key", "private key"),
            ("recovery_phrase", "recovery phrase"),
            ("recovery_phrase", "seed phrase"),
            ("bank", "bank account"),
            ("payment_card", "card number"),
            ("address", "home address"),
            ("address", "private address"),
            ("secret", "client_secret"),
            ("secret", "aws_secret_access_key"),
        ] {
            if lower.contains(marker) {
                findings.push(SensitiveFinding {
                    kind: kind.to_string(),
                    reason: format!("matched marker `{marker}`"),
                });
                line_sensitive = true;
            }
        }

        if contains_secret_prefix(line) {
            findings.push(SensitiveFinding {
                kind: "secret".to_string(),
                reason: "matched secret-like token prefix".to_string(),
            });
            line_sensitive = true;
        }

        if contains_likely_payment_card(line) {
            findings.push(SensitiveFinding {
                kind: "payment_card".to_string(),
                reason: "matched long digit sequence".to_string(),
            });
            line_sensitive = true;
        }

        if line_sensitive {
            redacted_lines.push("[REDACTED SENSITIVE MEMORY DATA]".to_string());
        } else {
            redacted_lines.push(redact_inline_tokens(line));
        }
    }

    findings.sort_by(|a, b| a.kind.cmp(&b.kind).then(a.reason.cmp(&b.reason)));
    findings.dedup();

    SensitiveFilterResult {
        redacted: redacted_lines.join("\n"),
        rejected: !findings.is_empty(),
        findings,
    }
}

fn contains_secret_prefix(input: &str) -> bool {
    input
        .split(|c: char| {
            c.is_whitespace() || matches!(c, '"' | '\'' | '`' | ',' | ';' | '(' | ')' | '[' | ']')
        })
        .any(|token| {
            let trimmed =
                token.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '-' && c != '_');
            trimmed.starts_with("sk-")
                || trimmed.starts_with("sk_")
                || trimmed.starts_with("ghp_")
                || trimmed.starts_with("github_pat_")
                || trimmed.starts_with("xoxb-")
                || trimmed.starts_with("xoxp-")
                || trimmed.starts_with("AKIA")
                || trimmed.starts_with("-----BEGIN")
        })
}

fn contains_likely_payment_card(input: &str) -> bool {
    let mut run = String::new();
    for c in input.chars().chain(std::iter::once(' ')) {
        if c.is_ascii_digit() {
            run.push(c);
            continue;
        }
        if matches!(c, ' ' | '-') && !run.is_empty() {
            continue;
        }
        if (13..=19).contains(&run.len()) && luhn_valid(&run) {
            return true;
        }
        run.clear();
    }
    false
}

fn luhn_valid(digits: &str) -> bool {
    let mut sum = 0;
    let mut double = false;
    for ch in digits.chars().rev() {
        let Some(mut n) = ch.to_digit(10) else {
            return false;
        };
        if double {
            n *= 2;
            if n > 9 {
                n -= 9;
            }
        }
        sum += n;
        double = !double;
    }
    sum % 10 == 0
}

fn redact_inline_tokens(input: &str) -> String {
    input
        .split_whitespace()
        .map(|token| {
            if token.starts_with("sk-")
                || token.starts_with("sk_")
                || token.starts_with("ghp_")
                || token.starts_with("github_pat_")
                || token.starts_with("xoxb-")
                || token.starts_with("xoxp-")
            {
                "[REDACTED]"
            } else {
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_api_keys() {
        let result = inspect_sensitive("My API key is sk-test123");
        assert!(result.rejected);
        assert!(result
            .findings
            .iter()
            .any(|finding| finding.kind == "api_key"));
    }

    #[test]
    fn rejects_private_keys() {
        let result =
            inspect_sensitive("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
        assert!(result.rejected);
        assert!(result
            .findings
            .iter()
            .any(|finding| finding.kind == "private_key"));
    }

    #[test]
    fn allows_non_sensitive_preference() {
        let result =
            inspect_sensitive("I prefer concise responses and Bun for JavaScript projects.");
        assert!(!result.rejected);
        assert_eq!(
            result.redacted,
            "I prefer concise responses and Bun for JavaScript projects."
        );
    }
}
