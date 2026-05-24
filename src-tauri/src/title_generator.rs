use crate::models::chat::ChatMessage;
use crate::providers::base::{LLMProvider, ProviderType};
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

    let task_model = resolve_task_model(provider.get_provider_type(), model);
    if task_model.trim().is_empty() {
        return None;
    }

    let prompt = build_title_prompt(messages, user_name);
    let task_messages = vec![ChatMessage {
        role: "user".to_string(),
        content: prompt,
        attachments: None,
        tool_calls: None,
    }];

    let max_attempts = if title_generation_retry_enabled() {
        2
    } else {
        1
    };

    for attempt in 0..max_attempts {
        let temperature = if attempt == 0 { 0.2 } else { 0.7 };
        for use_json_format in [false, true] {
            if let Some(title) = attempt_title_generation(
                provider,
                &task_model,
                &task_messages,
                use_json_format,
                temperature,
                messages,
            )
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
    use_json_format: bool,
    temperature: f64,
    conversation: &[ChatMessage],
) -> Option<String> {
    match run_title_completion(
        provider,
        task_model,
        task_messages,
        use_json_format,
        temperature,
    )
    .await
    {
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
        loop {
            let start = match result.find(start_tag) {
                Some(pos) => pos,
                None => break,
            };
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

    let words: Vec<&str> = first_user.split_whitespace().collect();
    let truncated: String = if words.len() <= 8 && first_user.chars().count() <= 80 {
        first_user
    } else {
        words[..8.min(words.len())].join(" ")
    };

    let cleaned: String = truncated
        .chars()
        .take(80)
        .map(|ch| if ch.is_control() { ' ' } else { ch })
        .collect();
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
    use_json_format: bool,
    temperature: f64,
) -> Result<String, String> {
    let mut opts = serde_json::json!({
        "temperature": temperature,
        "num_predict": 200,
        "top_p": 0.8,
    });

    if use_json_format {
        opts["format"] = serde_json::json!("json");
    }

    let mut stream = provider
        .chat_completion(model.to_string(), messages.to_vec(), None, Some(opts), None)
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

fn resolve_task_model(provider_type: ProviderType, fallback_model: &str) -> String {
    let env_key = if provider_type == ProviderType::OllamaLocal {
        "TASK_MODEL"
    } else {
        "TASK_MODEL_EXTERNAL"
    };

    env::var(env_key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback_model.to_string())
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
    r#"Generate a short chat title (2-5 words, with emoji) for this message:

{{prompt}}

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
            if key.to_ascii_lowercase() == "title" {
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
