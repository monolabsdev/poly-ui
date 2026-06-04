fn main() {
    tauri_build::build();

    if cfg!(target_os = "windows") {
        if std::env::var_os("CARGO_FEATURE_DICTATION").is_some() {
            println!("cargo:rustc-link-arg=/NODEFAULTLIB:libvcruntime.lib");
        }
    }
}
