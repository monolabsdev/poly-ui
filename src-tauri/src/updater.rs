use crate::AppState;
use reqwest::Client;
use serde::Serialize;
use std::io::Write;
use std::path::Path;
use std::thread;
use std::time::Duration;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};

const GITHUB_REPO: &str = "monolabsdev/poly-ui";
const CHECK_INTERVAL_SECS: u64 = 1800;
const APP_NAME: &str = "PolyUI";

#[derive(serde::Deserialize)]
struct GithubRelease {
    tag_name: String,
    assets: Vec<GithubAsset>,
}

#[derive(serde::Deserialize, Clone)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    size: Option<i64>,
}

#[derive(Serialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub version: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
    pub size: Option<i64>,
}

#[derive(Serialize, Clone)]
pub struct UpdateProgress {
    pub status: String,
    pub percent: f64,
    pub bytes: u64,
    pub total: u64,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(state: State<'_, AppState>) -> Result<UpdateInfo, String> {
    {
        let mut last = state.last_update_check.lock().map_err(|e| e.to_string())?;
        if let Some(instant) = *last {
            if instant.elapsed().as_secs() < CHECK_INTERVAL_SECS {
                return Err("rate_limited".into());
            }
        }
        *last = Some(Instant::now());
    }

    let client = Client::builder()
        .user_agent("polyui-updater")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }
    let release: GithubRelease = resp.json().await.map_err(|e| e.to_string())?;

    let current = env!("CARGO_PKG_VERSION");
    let remote = release.tag_name.trim_start_matches('v');

    if !is_newer_version(remote, current)? {
        return Ok(UpdateInfo {
            has_update: false,
            version: release.tag_name,
            download_url: None,
            asset_name: None,
            size: None,
        });
    }

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let asset = select_update_asset(&release.assets, os, arch);

    match asset {
        Some(a) => Ok(UpdateInfo {
            has_update: true,
            version: release.tag_name,
            download_url: Some(a.browser_download_url.clone()),
            asset_name: Some(a.name.clone()),
            size: a.size,
        }),
        None => Ok(UpdateInfo {
            has_update: true,
            version: release.tag_name,
            download_url: None,
            asset_name: None,
            size: None,
        }),
    }
}

fn select_update_asset<'a>(
    assets: &'a [GithubAsset],
    os: &str,
    arch: &str,
) -> Option<&'a GithubAsset> {
    let arch_aliases: &[&str] = match arch {
        "x86_64" => &["x64", "amd64", "x86_64"],
        "aarch64" => &["aarch64", "arm64"],
        _ => &[arch],
    };
    let known_arches = ["x64", "amd64", "x86_64", "aarch64", "arm64"];

    let matches_platform = |a: &&GithubAsset| {
        let n = a.name.to_lowercase();
        if n.contains("ollama") {
            return false;
        }

        match os {
            "windows" => n.contains("setup") || n.ends_with(".exe"),
            "macos" => {
                n.contains("macos")
                    || n.contains("darwin")
                    || n.ends_with(".dmg")
                    || n.contains(".tar.gz")
            }
            "linux" => n.ends_with(".appimage") || n.ends_with(".deb") || n.contains("linux"),
            _ => false,
        }
    };
    let matching_assets = assets.iter().filter(matches_platform);
    matching_assets
        .clone()
        .find(|a| {
            let name = a.name.to_lowercase();
            arch_aliases.iter().any(|alias| name.contains(alias))
        })
        .or_else(|| {
            matching_assets.into_iter().find(|a| {
                let name = a.name.to_lowercase();
                !known_arches.iter().any(|arch| name.contains(arch))
            })
        })
}

fn is_newer_version(remote: &str, current: &str) -> Result<bool, String> {
    let remote = semver::Version::parse(remote.trim_start_matches('v'))
        .map_err(|e| format!("Invalid release version '{}': {}", remote, e))?;
    let current = semver::Version::parse(current.trim_start_matches('v'))
        .map_err(|e| format!("Invalid app version '{}': {}", current, e))?;
    Ok(remote > current)
}

#[derive(Debug, PartialEq)]
enum LinuxInstallKind {
    AppImage,
    Deb,
}

fn linux_install_kind(path: &Path) -> Option<LinuxInstallKind> {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("AppImage") => Some(LinuxInstallKind::AppImage),
        Some("deb") => Some(LinuxInstallKind::Deb),
        _ => None,
    }
}

#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    asset_name: String,
) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("polyui-updater")
        .build()
        .map_err(|e| e.to_string())?;

    let mut resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Update download failed: HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);

    let temp_dir = std::env::temp_dir().join("polyui-update");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let file_path = temp_dir.join(&asset_name);
    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        let percent = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "update-progress",
            UpdateProgress {
                status: "downloading".into(),
                percent,
                bytes: downloaded,
                total,
                file_path: None,
                error: None,
            },
        );
    }

    {
        let mut path = state
            .update_download_path
            .lock()
            .map_err(|e| e.to_string())?;
        *path = Some(file_path.clone());
    }

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            status: "downloaded".into(),
            percent: 100.0,
            bytes: downloaded,
            total,
            file_path: Some(file_path.to_string_lossy().to_string()),
            error: None,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn install_update(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let file_path = {
        let p = state
            .update_download_path
            .lock()
            .map_err(|e| e.to_string())?;
        p.clone()
            .ok_or_else(|| "No update downloaded".to_string())?
    };

    let os = std::env::consts::OS;
    let fp = file_path.to_string_lossy();

    match os {
        "windows" => {
            std::process::Command::new(fp.as_ref())
                .spawn()
                .map_err(|e| format!("Failed to start installer: {}", e))?;
        }
        "macos" => {
            let install_script = format!(
                r#"#!/bin/sh
sleep 2
VOLUME=$(hdiutil attach -quiet -nobrowse '{}' | tail -1 | awk '{{print $NF}}')
mkdir -p ~/Applications
cp -R "$VOLUME/{}.app" ~/Applications/
hdiutil detach -quiet "$VOLUME"
open ~/Applications/{}.app
rm -- "$0"
"#,
                fp, APP_NAME, APP_NAME
            );
            let script_path = std::env::temp_dir()
                .join("polyui-update")
                .join("install.sh");
            std::fs::create_dir_all(script_path.parent().unwrap()).ok();
            std::fs::write(&script_path, &install_script).map_err(|e| e.to_string())?;
            std::process::Command::new("chmod")
                .args(["+x", &script_path.to_string_lossy()])
                .spawn()
                .map_err(|e| e.to_string())?;
            std::process::Command::new(&script_path)
                .spawn()
                .map_err(|e| format!("Failed to start installer: {}", e))?;
        }
        "linux" => {
            if linux_install_kind(&file_path) == Some(LinuxInstallKind::AppImage) {
                std::process::Command::new("chmod")
                    .args(["+x", fp.as_ref()])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                std::process::Command::new(fp.as_ref())
                    .arg("--no-sandbox")
                    .spawn()
                    .map_err(|e| format!("Failed to start installer: {}", e))?;
            } else if linux_install_kind(&file_path) == Some(LinuxInstallKind::Deb) {
                let install_script = format!("sleep 2\npkexec dpkg -i '{}'\n", fp);
                let script_path = std::env::temp_dir()
                    .join("polyui-update")
                    .join("install.sh");
                std::fs::create_dir_all(script_path.parent().unwrap()).ok();
                std::fs::write(&script_path, &install_script).map_err(|e| e.to_string())?;
                std::process::Command::new("sh")
                    .arg(&script_path)
                    .spawn()
                    .map_err(|e| format!("Failed to start installer: {}", e))?;
            } else {
                return Err("Unsupported Linux update package".to_string());
            }
        }
        _ => return Err("Unsupported OS".to_string()),
    }

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(500));
        app.exit(0);
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(name: &str) -> GithubAsset {
        GithubAsset {
            name: name.to_string(),
            browser_download_url: String::new(),
            size: None,
        }
    }

    #[test]
    fn windows_updater_ignores_ollama_bundle() {
        let assets = vec![
            asset("PolyUI_0.10.0_x64-setup-Ollama.exe"),
            asset("PolyUI_0.10.0_x64-setup.exe"),
        ];

        assert_eq!(
            select_update_asset(&assets, "windows", "x86_64").map(|asset| asset.name.as_str()),
            Some("PolyUI_0.10.0_x64-setup.exe")
        );
    }

    #[test]
    fn macos_updater_uses_dmg_instead_of_ollama_pkg() {
        let assets = vec![
            asset("PolyUI-Ollama.pkg"),
            asset("PolyUI_0.10.0_aarch64.dmg"),
        ];

        assert_eq!(
            select_update_asset(&assets, "macos", "aarch64").map(|asset| asset.name.as_str()),
            Some("PolyUI_0.10.0_aarch64.dmg")
        );
    }

    #[test]
    fn version_comparison_uses_semver_order() {
        assert!(is_newer_version("v0.11.0", "0.9.0").unwrap());
        assert!(!is_newer_version("v0.9.0", "0.11.0").unwrap());
    }

    #[test]
    fn version_comparison_handles_prereleases() {
        assert!(is_newer_version("v0.11.0", "0.11.0-rc.2").unwrap());
        assert!(!is_newer_version("v0.11.0-rc.1", "0.11.0-rc.2").unwrap());
    }

    #[test]
    fn windows_updater_selects_matching_architecture() {
        let assets = vec![
            asset("PolyUI_0.11.0_arm64-setup.exe"),
            asset("PolyUI_0.11.0_x64-setup.exe"),
        ];

        assert_eq!(
            select_update_asset(&assets, "windows", "x86_64").map(|asset| asset.name.as_str()),
            Some("PolyUI_0.11.0_x64-setup.exe")
        );
    }

    #[test]
    fn windows_updater_rejects_wrong_architecture() {
        let assets = vec![asset("PolyUI_0.11.0_arm64-setup.exe")];

        assert!(select_update_asset(&assets, "windows", "x86_64").is_none());
    }

    #[test]
    fn linux_updater_rejects_unknown_package_type() {
        assert_eq!(
            linux_install_kind(std::path::Path::new("PolyUI.tar.gz")),
            None
        );
    }
}
