use crate::models::chat::SearchResultItem;
use crate::web_search::{
    create_web_search_client, read_web_results, search_web, ReadWebResultsRequest,
    ReadWebResultsResponse, SearchWebRequest, SearchWebResponse, WebSearchConfig,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentWorkspace {
    id: String,
    name: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    path: String,
    additions: u32,
    deletions: u32,
    status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    path: String,
    diff: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDirEntry {
    name: String,
    kind: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentGrepHit {
    path: String,
    line: usize,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCommandOutput {
    stdout: String,
    stderr: String,
    status: i32,
    timed_out: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCommandRequest {
    workspace_path: String,
    command: String,
    timeout_secs: Option<u64>,
}

#[tauri::command]
pub fn agent_list_workspaces() -> Vec<AgentWorkspace> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut candidates = Vec::new();

    push_workspace(&mut candidates, &cwd);
    for ancestor in cwd.ancestors().skip(1).take(4) {
        push_workspace(&mut candidates, ancestor);
    }

    candidates.sort_by_key(|item| {
        if item.name.eq_ignore_ascii_case("monolabs") {
            0
        } else if item.name.eq_ignore_ascii_case("poly-ui") {
            1
        } else {
            2
        }
    });
    candidates
}

fn push_workspace(items: &mut Vec<AgentWorkspace>, path: &Path) {
    let Ok(canonical) = path.canonicalize() else {
        return;
    };
    if !canonical.is_dir() {
        return;
    }
    let path_string = canonical.to_string_lossy().to_string();
    if items.iter().any(|item| item.path == path_string) {
        return;
    }
    let name = canonical
        .file_name()
        .and_then(|part| part.to_str())
        .unwrap_or(&path_string)
        .to_string();
    items.push(AgentWorkspace {
        id: path_string.clone(),
        name,
        path: path_string,
    });
}

#[tauri::command]
pub async fn agent_changed_files(workspace_path: String) -> Result<Vec<ChangedFile>, String> {
    tauri::async_runtime::spawn_blocking(move || changed_files_blocking(workspace_path))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_file_diff(workspace_path: String, path: String) -> Result<FileDiff, String> {
    tauri::async_runtime::spawn_blocking(move || file_diff_blocking(workspace_path, path))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_prepare_chat_sandbox(chat_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let safe_id: String = chat_id
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
            .collect();
        let path = std::env::temp_dir()
            .join("polyui-agent-sandboxes")
            .join(if safe_id.is_empty() { "chat" } else { &safe_id });
        std::fs::create_dir_all(&path).map_err(|err| err.to_string())?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_delete_chat_sandbox(chat_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let safe_id: String = chat_id
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
            .collect();
        if safe_id.is_empty() {
            return Ok(());
        }
        let path = std::env::temp_dir()
            .join("polyui-agent-sandboxes")
            .join(safe_id);
        if path.exists() {
            std::fs::remove_dir_all(path).map_err(|err| err.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_read_text_file(workspace_path: String, path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let workspace = canonical_workspace(&workspace_path)?;
        let path = resolve_workspace_path(&workspace, &path)?;
        std::fs::read_to_string(path).map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_write_text_file(
    workspace_path: String,
    path: String,
    content: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let workspace = canonical_workspace(&workspace_path)?;
        let path = resolve_workspace_path(&workspace, &path)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        std::fs::write(path, content).map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_list_directory(
    workspace_path: String,
    path: String,
) -> Result<Vec<AgentDirEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let workspace = canonical_workspace(&workspace_path)?;
        let path = resolve_workspace_path(&workspace, &path)?;
        let mut entries = Vec::new();
        for entry in std::fs::read_dir(path).map_err(|err| err.to_string())? {
            let entry = entry.map_err(|err| err.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let kind = entry.file_type().map_err(|err| err.to_string())?;
            entries.push(AgentDirEntry {
                name,
                kind: if kind.is_dir() { "dir" } else { "file" }.to_string(),
            });
        }
        entries.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(entries)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_grep(
    workspace_path: String,
    pattern: String,
    max_results: Option<usize>,
) -> Result<Vec<AgentGrepHit>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let workspace = canonical_workspace(&workspace_path)?;
        let limit = max_results.unwrap_or(50).clamp(1, 200);
        let mut hits = Vec::new();
        grep_dir(&workspace, &workspace, &pattern, limit, &mut hits)?;
        Ok(hits)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn agent_web_search(
    query: String,
    config: WebSearchConfig,
) -> Result<Vec<SearchResultItem>, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Err("Search query is empty.".to_string());
    }
    if !config.is_configured() {
        return Err("Web search is not configured.".to_string());
    }
    let client = create_web_search_client(&config);
    client.search(&query, &config.api_key).await
}

#[tauri::command]
pub async fn agent_search_web(request: SearchWebRequest) -> Result<SearchWebResponse, String> {
    if request.query.trim().is_empty() {
        return Err("Search query is empty.".to_string());
    }
    Ok(search_web(request).await)
}

#[tauri::command]
pub async fn agent_read_web_results(
    request: ReadWebResultsRequest,
) -> Result<ReadWebResultsResponse, String> {
    if request.result_ids.is_empty() {
        return Err("No result ids provided.".to_string());
    }
    Ok(read_web_results(request).await)
}

#[tauri::command]
pub async fn agent_run_command(request: AgentCommandRequest) -> Result<AgentCommandOutput, String> {
    let workspace = canonical_workspace(&request.workspace_path)?;
    let timeout = Duration::from_secs(request.timeout_secs.unwrap_or(60).clamp(1, 300));
    let command = request.command;
    tauri::async_runtime::spawn(async move {
        let mut cmd = if cfg!(target_os = "windows") {
            let mut c = tokio::process::Command::new("cmd");
            c.args(["/C", &command]);
            c
        } else {
            let mut c = tokio::process::Command::new("sh");
            c.args(["-lc", &command]);
            c
        };
        let child = cmd
            .current_dir(workspace)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;

        match tokio::time::timeout(timeout, child.wait_with_output()).await {
            Ok(result) => {
                let output = result.map_err(|err| err.to_string())?;
                Ok(AgentCommandOutput {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    status: output.status.code().unwrap_or(-1),
                    timed_out: false,
                })
            }
            Err(_) => Ok(AgentCommandOutput {
                stdout: String::new(),
                stderr: "Command timed out.".to_string(),
                status: -1,
                timed_out: true,
            }),
        }
    })
    .await
    .map_err(|err| err.to_string())?
}

fn changed_files_blocking(workspace_path: String) -> Result<Vec<ChangedFile>, String> {
    let workspace = canonical_workspace(&workspace_path)?;
    if ensure_git_repo(&workspace).is_err() {
        return changed_files_without_git(&workspace);
    }

    let numstat = run_git(&workspace, &["diff", "--numstat", "--"])?;
    let status = run_git(&workspace, &["diff", "--name-status", "--"])?;
    let mut files = parse_numstat(&numstat, &status);

    let untracked = run_git(&workspace, &["ls-files", "--others", "--exclude-standard"])?;
    for path in untracked
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        if files.iter().any(|file| file.path == path) {
            continue;
        }
        files.push(ChangedFile {
            path: path.to_string(),
            additions: count_file_lines(&workspace, path).unwrap_or(0),
            deletions: 0,
            status: "added".to_string(),
        });
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

fn file_diff_blocking(workspace_path: String, path: String) -> Result<FileDiff, String> {
    let workspace = canonical_workspace(&workspace_path)?;
    let path = normalize_git_path(&path)?;
    if ensure_git_repo(&workspace).is_err() {
        return Ok(FileDiff {
            path: path.clone(),
            diff: synthetic_added_file_diff(&workspace, &path)?,
        });
    }
    let untracked = run_git(
        &workspace,
        &["ls-files", "--others", "--exclude-standard", "--", &path],
    )?;
    if untracked.lines().any(|line| line.trim() == path) {
        return Ok(FileDiff {
            path: path.clone(),
            diff: synthetic_added_file_diff(&workspace, &path)?,
        });
    }

    let diff = run_git(&workspace, &["diff", "--", &path])?;
    Ok(FileDiff { path, diff })
}

fn changed_files_without_git(workspace: &Path) -> Result<Vec<ChangedFile>, String> {
    let mut files = Vec::new();
    collect_plain_files(workspace, workspace, &mut files)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

fn collect_plain_files(
    root: &Path,
    dir: &Path,
    files: &mut Vec<ChangedFile>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        let name = entry.file_name();
        if name.to_string_lossy().starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_plain_files(root, &path, files)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|err| err.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        files.push(ChangedFile {
            additions: count_file_lines(root, &relative).unwrap_or(0),
            deletions: 0,
            status: "added".to_string(),
            path: relative,
        });
    }
    Ok(())
}

fn canonical_workspace(workspace_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(workspace_path);
    let canonical = path
        .canonicalize()
        .map_err(|err| format!("Workspace not found: {err}"))?;
    if !canonical.is_dir() {
        return Err("Workspace path is not a directory.".to_string());
    }
    Ok(canonical)
}

fn resolve_workspace_path(workspace: &Path, path: &str) -> Result<PathBuf, String> {
    let clean = path.trim().replace('\\', "/");
    let relative = if clean == "." || clean.is_empty() {
        PathBuf::new()
    } else {
        PathBuf::from(normalize_git_path(&clean)?)
    };
    let joined = workspace.join(relative);
    let canonical = if joined.exists() {
        joined
            .canonicalize()
            .map_err(|err| format!("Path not found: {err}"))?
    } else {
        let parent = joined.parent().unwrap_or(workspace);
        let canonical_parent = parent
            .canonicalize()
            .map_err(|err| format!("Parent path not found: {err}"))?;
        canonical_parent.join(joined.file_name().unwrap_or_default())
    };
    if !canonical.starts_with(workspace) {
        return Err("Path escapes workspace.".to_string());
    }
    Ok(canonical)
}

fn grep_dir(
    workspace: &Path,
    dir: &Path,
    pattern: &str,
    limit: usize,
    hits: &mut Vec<AgentGrepHit>,
) -> Result<(), String> {
    if hits.len() >= limit {
        return Ok(());
    }
    for entry in std::fs::read_dir(dir).map_err(|err| err.to_string())? {
        if hits.len() >= limit {
            break;
        }
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || matches!(name.as_str(), "node_modules" | "dist" | "target") {
            continue;
        }
        if path.is_dir() {
            grep_dir(workspace, &path, pattern, limit, hits)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };
        for (index, line) in content.lines().enumerate() {
            if !line.contains(pattern) {
                continue;
            }
            let relative = path
                .strip_prefix(workspace)
                .map_err(|err| err.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            hits.push(AgentGrepHit {
                path: relative,
                line: index + 1,
                text: line.chars().take(400).collect(),
            });
            if hits.len() >= limit {
                break;
            }
        }
    }
    Ok(())
}

fn normalize_git_path(path: &str) -> Result<String, String> {
    if Path::new(path).is_absolute() {
        return Err("Invalid file path.".to_string());
    }
    let path = path.replace('\\', "/");
    if path.trim().is_empty()
        || path.starts_with('/')
        || path.starts_with("../")
        || path.contains("/../")
        || path.ends_with("/..")
        || path == ".."
        || path.contains(':')
    {
        return Err("Invalid file path.".to_string());
    }
    Ok(path)
}

fn ensure_git_repo(workspace: &Path) -> Result<(), String> {
    run_git(workspace, &["rev-parse", "--is-inside-work-tree"]).map(|_| ())
}

fn run_git(workspace: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace)
        .output()
        .map_err(|err| format!("Failed to run git: {err}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Git command failed.".to_string()
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_numstat(numstat: &str, status_output: &str) -> Vec<ChangedFile> {
    let statuses = parse_statuses(status_output);
    numstat
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() < 3 {
                return None;
            }
            let path = parts.last()?.to_string();
            Some(ChangedFile {
                path: path.clone(),
                additions: parse_count(parts[0]),
                deletions: parse_count(parts[1]),
                status: statuses
                    .iter()
                    .find(|(candidate, _)| candidate == &path)
                    .map(|(_, status)| status.clone())
                    .unwrap_or_else(|| "modified".to_string()),
            })
        })
        .collect()
}

fn parse_statuses(status_output: &str) -> Vec<(String, String)> {
    status_output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            let code = parts.first()?.chars().next().unwrap_or('M');
            let path = if code == 'R' && parts.len() >= 3 {
                parts[2]
            } else {
                parts.get(1).copied()?
            };
            Some((path.to_string(), status_label(code)))
        })
        .collect()
}

fn status_label(code: char) -> String {
    match code {
        'A' => "added",
        'D' => "deleted",
        'R' => "renamed",
        'M' => "modified",
        _ => "unknown",
    }
    .to_string()
}

fn parse_count(value: &str) -> u32 {
    value.parse::<u32>().unwrap_or(0)
}

fn count_file_lines(workspace: &Path, git_path: &str) -> Result<u32, String> {
    let full_path = workspace.join(git_path);
    let content = std::fs::read_to_string(full_path).map_err(|err| err.to_string())?;
    if content.is_empty() {
        return Ok(0);
    }
    Ok(content.lines().count().max(1) as u32)
}

fn synthetic_added_file_diff(workspace: &Path, git_path: &str) -> Result<String, String> {
    let full_path = workspace.join(git_path);
    let content = std::fs::read_to_string(full_path).map_err(|err| err.to_string())?;
    let mut diff = format!(
        "diff --git a/{0} b/{0}\nnew file mode 100644\n--- /dev/null\n+++ b/{0}\n@@ -0,0 +1,{1} @@\n",
        git_path,
        content.lines().count()
    );
    for line in content.lines() {
        diff.push('+');
        diff.push_str(line);
        diff.push('\n');
    }
    Ok(diff)
}
