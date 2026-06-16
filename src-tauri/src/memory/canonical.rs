use crate::memory::error::MemoryError;
use crate::memory::types::MemoryOperation;
use serde_json::Value;
use std::collections::BTreeSet;

pub fn normalize_canonical_key(key: &str) -> Result<String, MemoryError> {
    let key = key.trim().to_ascii_lowercase();
    if key.is_empty() {
        return Err(MemoryError::InvalidMemoryOperation(
            "canonical key cannot be empty".to_string(),
        ));
    }
    if key.len() > 160 {
        return Err(MemoryError::InvalidMemoryOperation(
            "canonical key is too long".to_string(),
        ));
    }
    if key.starts_with('.') || key.ends_with('.') || key.contains("..") {
        return Err(MemoryError::InvalidMemoryOperation(
            "canonical key must use non-empty dot-separated segments".to_string(),
        ));
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '.')
    {
        return Err(MemoryError::InvalidMemoryOperation(
            "canonical key must contain lowercase letters, numbers, underscores, and dots only"
                .to_string(),
        ));
    }
    Ok(key)
}

pub fn normalize_optional_canonical_key(
    key: Option<String>,
) -> Result<Option<String>, MemoryError> {
    key.map(|value| normalize_canonical_key(&value)).transpose()
}

pub fn validate_operation(operation: &MemoryOperation) -> Result<(), MemoryError> {
    if operation.scope_owner_id.trim().is_empty() {
        return Err(MemoryError::ScopeMismatch(
            "scope owner id is required".to_string(),
        ));
    }

    if let Some(key) = operation.canonical_key.as_deref() {
        normalize_canonical_key(key)?;
    }

    if operation.operation != crate::memory::types::MemoryOperationKind::Delete
        && operation.operation != crate::memory::types::MemoryOperationKind::Noop
        && operation.value.is_none()
    {
        return Err(MemoryError::InvalidMemoryOperation(
            "memory value is required".to_string(),
        ));
    }

    Ok(())
}

pub fn summary_for(value: &Value, summary: Option<String>) -> String {
    if let Some(summary) = summary
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return summary;
    }
    match value {
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

pub fn merge_source_message_ids(
    existing_json: &str,
    incoming: &[String],
) -> Result<Vec<String>, MemoryError> {
    let existing: Vec<String> = serde_json::from_str(existing_json).unwrap_or_default();
    let mut merged = BTreeSet::new();
    for value in existing.into_iter().chain(incoming.iter().cloned()) {
        let value = value.trim().to_string();
        if !value.is_empty() {
            merged.insert(value);
        }
    }
    Ok(merged.into_iter().collect())
}

pub fn clamp_score(value: Option<f32>, fallback: f32) -> f32 {
    value.unwrap_or(fallback).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_key_normalizes() {
        assert_eq!(
            normalize_canonical_key(" Identity.Preferred_Name ").unwrap(),
            "identity.preferred_name"
        );
    }

    #[test]
    fn canonical_key_rejects_pathological_values() {
        assert!(normalize_canonical_key("identity..name").is_err());
        assert!(normalize_canonical_key("identity/name").is_err());
        assert!(normalize_canonical_key("").is_err());
    }

    #[test]
    fn source_ids_merge_uniquely() {
        let merged =
            merge_source_message_ids(r#"["a","b"]"#, &["b".to_string(), "c".to_string()]).unwrap();
        assert_eq!(merged, vec!["a", "b", "c"]);
    }
}
