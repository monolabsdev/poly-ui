use super::types::Passage;

pub fn select_passages(query: &str, text: &str, limit: usize) -> Vec<Passage> {
    let terms = query_terms(query);
    let mut passages: Vec<Passage> = split_blocks(text)
        .into_iter()
        .enumerate()
        .map(|(idx, block)| {
            let lower = block.to_ascii_lowercase();
            let term_hits = terms
                .iter()
                .filter(|term| lower.contains(term.as_str()))
                .count() as f64;
            let phrase = if lower.contains(&query.to_ascii_lowercase()) {
                0.35
            } else {
                0.0
            };
            let position = if idx < 3 { 0.12 } else { 0.0 };
            Passage {
                text: block,
                score: ((term_hits * 0.2 + phrase + position) * 1000.0).round() / 1000.0,
                section: None,
            }
        })
        .filter(|p| p.text.len() > 24)
        .collect();
    passages.sort_by(|a, b| b.score.total_cmp(&a.score));
    passages.truncate(limit.clamp(1, 5));
    passages
}

fn split_blocks(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if line.len() > 24 {
            if !current.trim().is_empty() {
                out.push(current.trim().to_string());
                current.clear();
            }
            out.push(line.to_string());
            continue;
        }
        if current.len() + line.len() > 900 && !current.is_empty() {
            out.push(current.trim().to_string());
            current.clear();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(line);
        if line.ends_with('.') && current.len() > 240 {
            out.push(current.trim().to_string());
            current.clear();
        }
    }
    if !current.trim().is_empty() {
        out.push(current.trim().to_string());
    }
    out
}

fn query_terms(query: &str) -> Vec<String> {
    query
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|part| part.len() > 2)
        .map(str::to_ascii_lowercase)
        .collect()
}
