use crate::models::chat::ChatMessage;
use crate::providers::base::LLMProvider;
use chrono::Utc;
use serde_json::Value;
use std::env;
use tokio_stream::StreamExt;

pub async fn generate_title(
    provider: &dyn LLMProvider,
    model: &str,
    messages: &[ChatMessage],
    user_name: Option<&str>,
) -> Option<String> {
    if !title_generation_enabled() {
        return None;
    }

    let task_model = selected_title_model(model);
    if task_model.trim().is_empty() {
        return None;
    }

    let prompt = build_title_prompt(messages, user_name);
    let task_messages = vec![ChatMessage {
        role: "user".to_string(),
        content: prompt,
        attachments: None,
        tool_calls: None,
        tool_call_id: None,
    }];

    let max_attempts = if title_generation_retry_enabled() {
        2
    } else {
        1
    };

    for _ in 0..max_attempts {
        for options in title_completion_options() {
            if let Some(title) =
                attempt_title_generation(provider, task_model, &task_messages, options, messages)
                    .await
            {
                return Some(title);
            }
        }
    }

    first_user_fallback_title(messages)
}

async fn attempt_title_generation(
    provider: &dyn LLMProvider,
    task_model: &str,
    task_messages: &[ChatMessage],
    options: Value,
    conversation: &[ChatMessage],
) -> Option<String> {
    match run_title_completion(provider, task_model, task_messages, options).await {
        Ok(raw) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                eprintln!("[TitleGeneration] Empty response from model");
                return None;
            }
            if let Some(title) =
                parse_title_response(trimmed).and_then(|title| validate_title(title, conversation))
            {
                return Some(title);
            }
            eprintln!("[TitleGeneration] No valid title parsed from response: {trimmed:?}");
            None
        }
        Err(error) => {
            eprintln!("[TitleGeneration] Completion failed: {error}");
            None
        }
    }
}

pub fn strip_thinking_blocks(content: &str) -> String {
    let mut result = content.to_string();
    for (start_tag, end_tag) in &[
        ("<think>", "</think>"),
        ("<|channel|thought>", "</|channel|thought>"),
    ] {
        while let Some(start) = result.find(start_tag) {
            let end = match result[start..].find(end_tag) {
                Some(pos) => start + pos + end_tag.len(),
                None => break,
            };
            result.replace_range(start..end, "");
        }
    }
    result
}

fn title_generation_enabled() -> bool {
    env::var("ENABLE_TITLE_GENERATION")
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(normalized.as_str(), "0" | "false" | "off" | "no")
        })
        .unwrap_or(true)
}

fn title_generation_retry_enabled() -> bool {
    env::var("TITLE_GENERATION_RETRY")
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(normalized.as_str(), "0" | "false" | "off" | "no")
        })
        .unwrap_or(true)
}

fn first_user_fallback_title(messages: &[ChatMessage]) -> Option<String> {
    let first_user = messages
        .iter()
        .find(|message| message.role == "user")
        .map(|message| compact_whitespace(&message.content))
        .unwrap_or_default();

    if first_user.is_empty() {
        return None;
    }

    let cleaned: String = first_user
        .chars()
        .filter(|ch| !is_emoji(*ch))
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect();
    let cleaned = compact_whitespace(&cleaned);
    let words: Vec<&str> = cleaned.split_whitespace().collect();
    let truncated: String = if words.len() <= 8 && cleaned.chars().count() <= 80 {
        cleaned
    } else {
        words[..8.min(words.len())].join(" ")
    };

    let cleaned: String = truncated.chars().take(80).collect();
    let cleaned = compact_whitespace(&cleaned).trim().to_string();

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

async fn run_title_completion(
    provider: &dyn LLMProvider,
    model: &str,
    messages: &[ChatMessage],
    options: Value,
) -> Result<String, String> {
    let mut stream = provider
        .chat_completion(
            model.to_string(),
            messages.to_vec(),
            None,
            Some(options),
            None,
        )
        .await?;

    let mut raw = String::new();
    while let Some(result) = stream.next().await {
        let chunk = result?;
        raw.push_str(&chunk.content);
        if chunk.done {
            break;
        }
    }

    Ok(raw)
}

fn selected_title_model(model: &str) -> &str {
    model
}

fn title_completion_options() -> [Value; 2] {
    let base = serde_json::json!({
        "temperature": 0.0,
        "num_predict": 80,
        "top_p": 0.8,
    });
    let mut structured = base.clone();
    structured["format"] = serde_json::json!({
        "type": "object",
        "properties": {
            "title": { "type": "string" }
        },
        "required": ["title"],
        "additionalProperties": false
    });
    let mut json = base;
    json["format"] = serde_json::json!("json");
    [structured, json]
}

fn build_title_prompt(messages: &[ChatMessage], user_name: Option<&str>) -> String {
    let template = env::var("TITLE_GENERATION_PROMPT_TEMPLATE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(default_title_prompt_template);

    let first_user_prompt = messages
        .iter()
        .find(|message| message.role == "user")
        .map(|message| message.content.as_str())
        .unwrap_or("");

    render_message_template(&template, messages)
        .replace("{{prompt}}", first_user_prompt)
        .replace("{{USER_NAME}}", user_name.unwrap_or("User"))
        .replace(
            "{{CURRENT_DATE}}",
            &Utc::now().format("%Y-%m-%d").to_string(),
        )
}

fn default_title_prompt_template() -> String {
    r#"Generate a concise chat title (2-5 words, without emoji) for this conversation:

{{MESSAGES:END:4}}

Respond with only this JSON: {"title": "..."}"#
        .to_string()
}

fn render_message_template(template: &str, messages: &[ChatMessage]) -> String {
    let mut rendered = template.replace("{{MESSAGES}}", &format_messages(messages));

    loop {
        let Some(start) = rendered.find("{{MESSAGES:END:") else {
            break;
        };
        let Some(relative_end) = rendered[start..].find("}}") else {
            break;
        };
        let end = start + relative_end + 2;
        let token = &rendered[start..end];
        let count = token
            .trim_start_matches("{{MESSAGES:END:")
            .trim_end_matches("}}")
            .parse::<usize>()
            .unwrap_or(2);
        let slice_start = messages.len().saturating_sub(count);
        let replacement = format_messages(&messages[slice_start..]);
        rendered.replace_range(start..end, &replacement);
    }

    rendered
}

fn format_messages(messages: &[ChatMessage]) -> String {
    messages
        .iter()
        .map(|message| {
            let role = match message.role.as_str() {
                "assistant" => "Assistant",
                "system" => "System",
                _ => "User",
            };
            format!("{role}: {}", compact_whitespace(&message.content))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_title_response(raw: &str) -> Option<String> {
    let cleaned = strip_thinking_blocks(raw);
    let cleaned = cleaned.trim();

    let cleaned = cleaned
        .trim_start_matches("```json")
        .trim_start_matches("```JSON")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    let from_full = parse_title_json(&cleaned);

    let from_json_block = from_full.or_else(|| {
        let start = cleaned.find('{')?;
        let end = cleaned.rfind('}')?;
        if end <= start {
            return None;
        }
        parse_title_json(&cleaned[start..=end])
    });

    let from_relaxed = from_json_block.or_else(|| {
        let lowered = cleaned.to_ascii_lowercase();
        let title_pos = lowered.find("\"title\"")?;
        let brace_start = cleaned[..title_pos].rfind('{')?;
        let brace_end = cleaned[title_pos..].rfind('}')? + title_pos;
        if brace_end <= brace_start {
            return None;
        }
        parse_title_json(&cleaned[brace_start..=brace_end])
    });

    from_relaxed.or_else(|| clean_freeform_title(&cleaned))
}

fn parse_title_json(raw_json: &str) -> Option<String> {
    parse_title_json_value(raw_json).or_else(|| {
        let sanitized = sanitize_title_json(raw_json);
        if sanitized == raw_json {
            return None;
        }
        parse_title_json_value(&sanitized)
    })
}

fn parse_title_json_value(raw_json: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(raw_json).ok()?;

    if let Some(title) = value
        .get("title")
        .or_else(|| value.get("Title"))
        .or_else(|| value.get("TITLE"))
        .or_else(|| value.get("tITLE"))
        .and_then(|v| v.as_str())
    {
        return clean_generated_title(title);
    }

    if let Some(obj) = value.as_object() {
        for (key, val) in obj {
            if key.eq_ignore_ascii_case("title") {
                if let Some(title) = val.as_str() {
                    return clean_generated_title(title);
                }
            }
        }
    }

    None
}

fn sanitize_title_json(raw_json: &str) -> String {
    let mut sanitized = raw_json
        .replace(['\u{201C}', '\u{201D}', '\u{201E}', '\u{201F}'], "\"")
        .replace(['\u{2018}', '\u{2019}', '\u{201A}', '\u{201B}'], "'")
        .replace(['\u{00AB}', '\u{00BB}'], "\"")
        .replace(['\u{300C}', '\u{300D}', '\u{300E}', '\u{300F}'], "\"")
        .replace(['\u{2032}', '\u{2033}', '\u{2036}', '\u{2037}'], "\"");

    if sanitized.contains("'title'") || sanitized.contains("{'") || sanitized.contains("'title\":")
    {
        sanitized = sanitized.replace('\'', "\"");
    }

    sanitized
}

fn validate_title(title: String, messages: &[ChatMessage]) -> Option<String> {
    if title.chars().any(is_emoji) {
        return None;
    }

    let first_user = messages
        .iter()
        .find(|message| message.role == "user")
        .map(|message| message.content.as_str())
        .unwrap_or("");

    let normalized_title_str = normalized_title(&title);
    let normalized_user = normalized_title(first_user);
    if !normalized_user.is_empty() && normalized_title_str == normalized_user {
        return None;
    }

    if normalized_title_str.len() >= 3 && normalized_user.starts_with(&normalized_title_str) {
        return None;
    }

    let word_count = title.split_whitespace().count();
    if !(1..=7).contains(&word_count) {
        return None;
    }

    Some(title)
}

fn clean_generated_title(title: &str) -> Option<String> {
    let mut cleaned = compact_whitespace(title)
        .trim_matches(|ch| matches!(ch, '"' | '\'' | '`'))
        .to_string();

    if cleaned.chars().count() > 60 {
        cleaned = cleaned.chars().take(60).collect();
        cleaned = cleaned.trim_end().to_string();
    }

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn clean_freeform_title(raw: &str) -> Option<String> {
    let title_prefixes = [
        "Title:",
        "title:",
        "TITLE:",
        "Here is a concise title:",
        "Here is a title:",
        "Suggested title:",
        "Suggested Title:",
        "Result:",
        "Output:",
        "Response:",
    ];

    let title = raw
        .lines()
        .find(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty()
                && !trimmed.eq_ignore_ascii_case("null")
                && !trimmed.eq_ignore_ascii_case("none")
                && !trimmed.eq_ignore_ascii_case("undefined")
                && !trimmed.starts_with("I cannot")
                && !trimmed.starts_with("I'm sorry")
                && !trimmed.starts_with("I apologize")
                && !trimmed.starts_with("Sorry,")
                && !trimmed.starts_with("As an AI")
        })
        .unwrap_or(raw);

    let cleaned = title.trim().to_string();
    let cleaned = title_prefixes
        .iter()
        .find(|prefix| cleaned.starts_with(**prefix))
        .map(|prefix| cleaned[prefix.len()..].trim().to_string())
        .unwrap_or(cleaned);

    clean_generated_title(&cleaned)
}

fn normalized_title(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_alphanumeric() || ch.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

fn compact_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_emoji(ch: char) -> bool {
    matches!(
        ch as u32,
        0x1F000..=0x1FAFF
            | 0x2300..=0x23FF
            | 0x2600..=0x27BF
            | 0x2B00..=0x2BFF
            | 0xFE00..=0xFE0F
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_message(content: &str) -> ChatMessage {
        ChatMessage {
            role: "user".to_string(),
            content: content.to_string(),
            attachments: None,
            tool_calls: None,
            tool_call_id: None,
        }
    }

    #[test]
    fn title_generation_uses_selected_model_unchanged() {
        assert_eq!(selected_title_model("llama3.2:latest"), "llama3.2:latest");
    }

    #[test]
    fn title_generation_requests_schema_before_json_with_zero_temperature() {
        let options = title_completion_options();

        assert_eq!(options.len(), 2);
        assert!(options[0]["format"].is_object());
        assert_eq!(
            options[0]["format"]["required"],
            serde_json::json!(["title"])
        );
        assert_eq!(options[1]["format"], serde_json::json!("json"));
        assert_eq!(options[0]["temperature"], serde_json::json!(0.0));
        assert_eq!(options[1]["temperature"], serde_json::json!(0.0));
    }

    #[test]
    fn generated_title_rejects_emoji() {
        let messages = vec![user_message("Help configure a Rust workspace")];

        assert_eq!(
            validate_title("Rust Workspace Setup 🚀".to_string(), &messages),
            None
        );
    }

    #[test]
    fn local_fallback_removes_emoji() {
        let messages = vec![user_message("🚀 Help configure a Rust workspace")];

        assert_eq!(
            first_user_fallback_title(&messages),
            Some("Help configure a Rust workspace".to_string())
        );
    }

    #[test]
    fn local_fallback_keeps_useful_words_after_leading_emoji() {
        let messages = vec![user_message(
            "🚀 🚀 🚀 🚀 🚀 🚀 🚀 🚀 Help configure a Rust workspace",
        )];

        assert_eq!(
            first_user_fallback_title(&messages),
            Some("Help configure a Rust workspace".to_string())
        );
    }
}
