use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::System;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProfile {
    total_memory_mb: u64,
    available_memory_mb: u64,
    cpu_count: usize,
}

#[tauri::command]
pub fn get_system_profile() -> SystemProfile {
    let mut system = System::new();
    system.refresh_memory();

    SystemProfile {
        total_memory_mb: system.total_memory() / 1024 / 1024,
        available_memory_mb: system.available_memory() / 1024 / 1024,
        cpu_count: std::thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(1),
    }
}

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
