use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const VERSION: &str = "v0.0.62";

fn main() {
    println!("cargo:rerun-if-env-changed=MOONSHINE_LIB_DIR");
    println!("cargo:rerun-if-env-changed=MOONSHINE_INCLUDE_DIR");

    let lib_dir = env::var_os("MOONSHINE_LIB_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| ensure_release().join("lib"));

    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    link_libs(&lib_dir);
    link_platform_libs();
    copy_runtime_dlls(&lib_dir);
}

fn ensure_release() -> PathBuf {
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR missing"));
    let release_dir = out_dir.join("moonshine");
    if release_dir.join("lib").is_dir() {
        return release_dir;
    }

    fs::create_dir_all(&release_dir).expect("failed to create moonshine release dir");

    let archive = out_dir.join(archive_name());
    if !archive.exists() {
        download(&archive);
    }

    extract(&archive, &release_dir);
    flatten_release_dir(&release_dir);
    release_dir
}

fn archive_name() -> &'static str {
    match env::var("CARGO_CFG_TARGET_OS").as_deref() {
        Ok("windows") => "moonshine-voice-windows-x86_64.tar.gz",
        Ok("macos") => {
            if env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("aarch64") {
                "moonshine-voice-macos-arm64.tar.gz"
            } else {
                "moonshine-voice-macos-x86_64.tar.gz"
            }
        }
        Ok("linux") => {
            if env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("aarch64") {
                "moonshine-voice-linux-aarch64.tar.gz"
            } else {
                "moonshine-voice-linux-x86_64.tar.gz"
            }
        }
        _ => panic!("unsupported Moonshine target"),
    }
}

fn download(archive: &Path) {
    let url = format!(
        "https://github.com/moonshine-ai/moonshine/releases/download/{VERSION}/{}",
        archive_name()
    );

    let status = if cfg!(windows) {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
                    url,
                    archive.display()
                ),
            ])
            .status()
    } else {
        Command::new("curl")
            .args(["-L", "-o", archive.to_str().expect("invalid archive path"), &url])
            .status()
    }
    .expect("failed to spawn Moonshine download command");

    if !status.success() {
        panic!("failed to download Moonshine release asset from {url}");
    }
}

fn extract(archive: &Path, release_dir: &Path) {
    let status = Command::new("tar")
        .args([
            "-xzf",
            archive.to_str().expect("invalid archive path"),
            "-C",
            release_dir.to_str().expect("invalid release path"),
        ])
        .status()
        .expect("failed to spawn tar for Moonshine release");

    if !status.success() {
        panic!("failed to extract Moonshine release asset");
    }
}

fn flatten_release_dir(release_dir: &Path) {
    if release_dir.join("lib").is_dir() {
        return;
    }

    let Some(child) = fs::read_dir(release_dir)
        .expect("failed to read Moonshine release dir")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| path.join("lib").is_dir())
    else {
        panic!("Moonshine release asset missing lib dir");
    };

    for name in ["include", "lib"] {
        let source = child.join(name);
        if source.exists() {
            let target = release_dir.join(name);
            if target.exists() {
                fs::remove_dir_all(&target).expect("failed to replace Moonshine release dir");
            }
            fs::rename(source, target).expect("failed to flatten Moonshine release dir");
        }
    }
}

fn link_libs(lib_dir: &Path) {
    let mut linked = false;
    for entry in fs::read_dir(lib_dir).expect("failed to read Moonshine lib dir") {
        let path = entry.expect("failed to read Moonshine lib entry").path();
        let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or_default();
        let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };

        match ext {
            "lib" => {
                println!("cargo:rustc-link-lib={stem}");
                linked = true;
            }
            "a" => {
                let name = stem.strip_prefix("lib").unwrap_or(stem);
                println!("cargo:rustc-link-lib=static={name}");
                linked = true;
            }
            "so" | "dylib" => {
                let name = stem.strip_prefix("lib").unwrap_or(stem);
                println!("cargo:rustc-link-lib={name}");
                linked = true;
            }
            _ => {}
        }
    }

    if !linked {
        panic!("Moonshine lib dir contains no linkable libraries");
    }
}

fn link_platform_libs() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-lib=vcruntime");
    }
}

fn copy_runtime_dlls(lib_dir: &Path) {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR missing"));
    let Some(profile_dir) = out_dir
        .ancestors()
        .nth(3)
        .map(Path::to_path_buf)
    else {
        return;
    };

    for name in ["onnxruntime.dll"] {
        let source = lib_dir.join(name);
        if source.exists() {
            let _ = fs::copy(source, profile_dir.join(name));
            let deps_dir = profile_dir.join("deps");
            if deps_dir.exists() {
                let _ = fs::copy(lib_dir.join(name), deps_dir.join(name));
            }
        }
    }
}
