#[cfg(feature = "dictation")]
use crate::AppState;
#[cfg(feature = "dictation")]
use moonshine_sys::{
    moonshine_error_to_string, moonshine_free_transcriber, moonshine_get_version,
    moonshine_load_transcriber_from_files, moonshine_transcribe_without_streaming, transcript_t,
    MOONSHINE_HEADER_VERSION, MOONSHINE_MODEL_ARCH_BASE,
};
#[cfg(feature = "dictation")]
use std::ffi::{CStr, CString};
#[cfg(feature = "dictation")]
use std::path::PathBuf;
#[cfg(feature = "dictation")]
use std::ptr;
#[cfg(feature = "dictation")]
use std::sync::Arc;
#[cfg(feature = "dictation")]
use std::sync::OnceLock;
#[cfg(feature = "dictation")]
use std::time::Duration;
#[cfg(feature = "dictation")]
use tauri::{AppHandle, Emitter, Manager};
#[cfg(feature = "dictation")]
use tokio::fs;
#[cfg(feature = "dictation")]
use tokio::io::AsyncWriteExt;
#[cfg(feature = "dictation")]
use tokio_stream::StreamExt;

#[cfg(feature = "dictation")]
const MOONSHINE_MODEL_URL_BASE: &str =
    "https://download.moonshine.ai/model/base-en/quantized/base-en";
#[cfg(feature = "dictation")]
const MOONSHINE_MODEL_FILES: &[&str] = &[
    "encoder_model.ort",
    "decoder_model_merged.ort",
    "tokenizer.bin",
];

#[cfg(feature = "dictation")]
pub struct DictationState {
    context: OnceLock<Arc<MoonshineContext>>,
}

#[cfg(feature = "dictation")]
pub struct MoonshineContext {
    handle: i32,
}

#[cfg(feature = "dictation")]
unsafe impl Send for MoonshineContext {}

#[cfg(feature = "dictation")]
unsafe impl Sync for MoonshineContext {}

#[cfg(feature = "dictation")]
impl MoonshineContext {
    fn load(model_dir: PathBuf) -> Result<Self, String> {
        let model_dir = CString::new(model_dir.to_string_lossy().as_bytes())
            .map_err(|_| "Dictation model path contains null byte".to_string())?;
        let version = unsafe { moonshine_get_version() };
        if version != MOONSHINE_HEADER_VERSION {
            return Err(format!(
                "Moonshine library version mismatch: runtime {version}, header {MOONSHINE_HEADER_VERSION}."
            ));
        }

        let handle = unsafe {
            moonshine_load_transcriber_from_files(
                model_dir.as_ptr(),
                MOONSHINE_MODEL_ARCH_BASE,
                ptr::null(),
                0,
                MOONSHINE_HEADER_VERSION,
            )
        };

        if handle < 0 {
            return Err(format!(
                "Failed to load dictation model: {}",
                error_message(handle)
            ));
        }

        Ok(Self { handle })
    }

    fn transcribe(&self, mut samples: Vec<f32>) -> Result<String, String> {
        let mut transcript: *mut transcript_t = ptr::null_mut();
        let result = unsafe {
            moonshine_transcribe_without_streaming(
                self.handle,
                samples.as_mut_ptr(),
                samples.len() as u64,
                16_000,
                0,
                &mut transcript,
            )
        };

        if result != 0 {
            return Err(format!("Dictation failed: {}", error_message(result)));
        }

        transcript_to_string(transcript)
    }
}

#[cfg(feature = "dictation")]
impl Drop for MoonshineContext {
    fn drop(&mut self) {
        unsafe {
            moonshine_free_transcriber(self.handle);
        }
    }
}

#[cfg(not(feature = "dictation"))]
pub struct DictationState;

#[cfg(feature = "dictation")]
impl DictationState {
    pub fn new() -> Self {
        Self {
            context: OnceLock::new(),
        }
    }

    async fn context(&self, model_dir: PathBuf) -> Result<Arc<MoonshineContext>, String> {
        if let Some(context) = self.context.get() {
            return Ok(context.clone());
        }

        let loaded_context =
            tokio::task::spawn_blocking(move || MoonshineContext::load(model_dir).map(Arc::new))
                .await
                .map_err(|err| format!("Dictation model load task failed: {err}"))??;

        self.context
            .set(loaded_context.clone())
            .map_err(|_| "Dictation model already initialized by another task".to_string())?;

        Ok(loaded_context)
    }
}

#[cfg(not(feature = "dictation"))]
impl DictationState {
    pub fn new() -> Self {
        Self
    }
}

#[tauri::command]
pub fn is_dictation_available() -> bool {
    cfg!(feature = "dictation")
}

#[cfg(feature = "dictation")]
#[tauri::command]
pub async fn transcribe_audio(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    samples: Vec<i16>,
    sample_rate: u32,
    language: Option<String>,
) -> Result<String, String> {
    if samples.is_empty() {
        return Ok(String::new());
    }

    if sample_rate != 16_000 {
        return Err(format!(
            "Unsupported sample rate: {sample_rate}. Expected 16000."
        ));
    }

    let model_dir = ensure_model(&app_handle).await?;
    let context = state.dictation.context(model_dir).await?;
    let _ = language;

    let samples: Vec<f32> = samples.into_iter().map(|s| (s as f32) / 32768.0).collect();

    let transcript = tokio::task::spawn_blocking(move || context.transcribe(samples))
        .await
        .map_err(|err| format!("Dictation task failed: {err}"))??;
    Ok(transcript)
}

#[cfg(not(feature = "dictation"))]
#[tauri::command]
pub async fn transcribe_audio(
    samples: Vec<i16>,
    sample_rate: u32,
    language: Option<String>,
) -> Result<String, String> {
    let _ = (samples, sample_rate, language);
    Err("Dictation is disabled in this build.".to_string())
}

#[cfg(feature = "dictation")]
async fn ensure_model(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;
    let model_dir = app_dir.join("dictation");
    fs::create_dir_all(&model_dir)
        .await
        .map_err(|err| err.to_string())?;

    let mut missing = Vec::new();
    for filename in MOONSHINE_MODEL_FILES {
        if fs::metadata(model_dir.join(filename)).await.is_err() {
            missing.push(*filename);
        }
    }

    if missing.is_empty() {
        return Ok(model_dir);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|err| format!("Failed to create HTTP client: {err}"))?;

    for filename in missing {
        let download_path = model_dir.join(format!("{filename}.download"));
        let model_path = model_dir.join(filename);
        let response = client
            .get(format!("{MOONSHINE_MODEL_URL_BASE}/{filename}"))
            .send()
            .await
            .map_err(|err| format!("Failed to download dictation model: {err}"))?
            .error_for_status()
            .map_err(|err| format!("Failed to download dictation model: {err}"))?;

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        let mut file = fs::File::create(&download_path)
            .await
            .map_err(|err| format!("Failed to create model file: {err}"))?;

        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk =
                chunk.map_err(|err| format!("Failed to download dictation model: {err}"))?;
            downloaded += chunk.len() as u64;
            file.write_all(&chunk)
                .await
                .map_err(|err| format!("Failed to write dictation model: {err}"))?;

            if total_size > 0 {
                let _ = app_handle.emit(
                    "dictation-progress",
                    serde_json::json!({
                        "file": filename,
                        "downloaded": downloaded,
                        "total": total_size,
                    }),
                );
            }
        }

        file.flush()
            .await
            .map_err(|err| format!("Failed to finalize dictation model: {err}"))?;

        fs::rename(&download_path, &model_path)
            .await
            .map_err(|err| format!("Failed to install dictation model: {err}"))?;
    }

    Ok(model_dir)
}

#[cfg(feature = "dictation")]
fn transcript_to_string(transcript: *mut transcript_t) -> Result<String, String> {
    if transcript.is_null() {
        return Ok(String::new());
    }

    let transcript = unsafe { &*transcript };
    if transcript.lines.is_null() || transcript.line_count == 0 {
        return Ok(String::new());
    }

    let lines =
        unsafe { std::slice::from_raw_parts(transcript.lines, transcript.line_count as usize) };
    let mut segments = Vec::with_capacity(lines.len());
    for line in lines {
        if line.text.is_null() {
            continue;
        }

        let text = unsafe { CStr::from_ptr(line.text) }
            .to_str()
            .map_err(|err| format!("Failed to read dictation text: {err}"))?
            .trim();
        if !text.is_empty() {
            segments.push(text.to_string());
        }
    }

    Ok(segments.join(" "))
}

#[cfg(feature = "dictation")]
fn error_message(error: i32) -> String {
    let message = unsafe { moonshine_error_to_string(error) };
    if message.is_null() {
        return format!("Moonshine error {error}");
    }

    unsafe { CStr::from_ptr(message) }
        .to_string_lossy()
        .into_owned()
}
