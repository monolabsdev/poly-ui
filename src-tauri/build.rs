fn main() {
    let out_dir = std::path::PathBuf::from(std::env::var_os("OUT_DIR").expect("OUT_DIR missing"));
    let profile_dir = out_dir.ancestors().nth(3).expect("invalid OUT_DIR");
    let target = std::env::var("TARGET").expect("TARGET missing");
    let library_name = if target.contains("windows") {
        "onnxruntime.dll"
    } else if target.contains("apple-darwin") {
        "libonnxruntime.dylib"
    } else {
        "libonnxruntime.so"
    };
    let source = profile_dir.join(library_name);
    let staged_dir = std::path::PathBuf::from(
        std::env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR missing"),
    )
    .join("target/onnxruntime");
    std::fs::create_dir_all(&staged_dir).expect("failed to create ONNX Runtime resource directory");
    std::fs::copy(&source, staged_dir.join(library_name)).unwrap_or_else(|error| {
        panic!(
            "failed to stage ONNX Runtime from {}: {error}",
            source.display()
        )
    });

    tauri_build::build();
}
