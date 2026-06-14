use crate::startup_log;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const IDENTIFIER: &str = "com.tslater.polyui";
const WINDOW_STATE_FILE: &str = ".window-state.json";

pub fn recover_invalid_window_state() {
    let Some(path) = window_state_path() else {
        startup_log::log_error("window-state path unavailable");
        return;
    };
    startup_log::log_phase(format!("window-state recovery check: {}", path.display()));
    match validate_window_state_file(&path) {
        Ok(()) => startup_log::log_phase("window-state valid or missing"),
        Err(error) => match quarantine_file(&path) {
            Ok(backup) => startup_log::log_error(format!(
                "window-state recovered: {error}; backup={}",
                backup.display()
            )),
            Err(backup_error) => startup_log::log_error(format!(
                "window-state invalid but backup failed: {error}; backup_error={backup_error}"
            )),
        },
    }
}

fn window_state_path() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(IDENTIFIER).join(WINDOW_STATE_FILE))
}

pub fn validate_window_state_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    if raw.trim().is_empty() {
        return Err("empty window-state file".to_string());
    }
    validate_window_state_json(&raw)
}

pub fn validate_window_state_json(raw: &str) -> Result<(), String> {
    let value: Value = serde_json::from_str(raw).map_err(|error| format!("bad JSON: {error}"))?;
    let windows = value
        .as_object()
        .ok_or_else(|| "window-state root is not an object".to_string())?;

    for (label, state) in windows {
        let state = state
            .as_object()
            .ok_or_else(|| format!("window {label} state is not an object"))?;
        let width = state.get("width").and_then(Value::as_f64).unwrap_or(1100.0);
        let height = state.get("height").and_then(Value::as_f64).unwrap_or(750.0);
        if !(100.0..=10000.0).contains(&width) || !(100.0..=10000.0).contains(&height) {
            return Err(format!("window {label} has invalid size {width}x{height}"));
        }

        for key in ["x", "y", "prev_x", "prev_y"] {
            if let Some(position) = state.get(key).and_then(Value::as_f64) {
                if !(-32000.0..=32000.0).contains(&position) {
                    return Err(format!("window {label} has invalid {key}={position}"));
                }
            }
        }
        if state
            .get("fullscreen")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            && state.get("visible").and_then(Value::as_bool) == Some(false)
        {
            return Err(format!("window {label} restores hidden fullscreen state"));
        }
    }

    Ok(())
}

fn quarantine_file(path: &Path) -> Result<PathBuf, String> {
    let backup = path.with_extension(format!("json.corrupt-{}", chrono::Utc::now().timestamp()));
    fs::rename(path, &backup)
        .or_else(|_| {
            fs::copy(path, &backup)?;
            fs::remove_file(path)
        })
        .map_err(|error| error.to_string())?;
    Ok(backup)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn accepts_valid_window_state() {
        let raw = r#"{"main":{"width":1100,"height":750,"x":20,"y":30,"maximized":false}}"#;
        assert!(validate_window_state_json(raw).is_ok());
    }

    #[test]
    fn rejects_malformed_window_state() {
        assert!(validate_window_state_json(r#"{"main":"#).is_err());
    }

    #[test]
    fn rejects_invalid_dimensions() {
        let raw = r#"{"main":{"width":0,"height":750}}"#;
        assert!(validate_window_state_json(raw).is_err());
    }

    #[test]
    fn rejects_unreasonable_positions() {
        let raw = r#"{"main":{"width":1100,"height":750,"x":999999,"y":30}}"#;
        assert!(validate_window_state_json(raw).is_err());
    }

    #[test]
    fn rejects_empty_window_state_file() {
        let path = std::env::temp_dir().join(format!(
            "polyui-empty-window-state-{}.json",
            std::process::id()
        ));
        fs::write(&path, "").unwrap();
        assert!(validate_window_state_file(&path).is_err());
        let _ = fs::remove_file(path);
    }
}
