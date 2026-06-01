#[cfg(feature = "dictation")]
use crate::AppState;
#[cfg(feature = "dictation")]
use std::path::PathBuf;
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
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[cfg(feature = "dictation")]
const WHISPER_MODEL_NAME: &str = "ggml-tiny.en.bin";
#[cfg(feature = "dictation")]
const WHISPER_MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";

#[cfg(feature = "dictation")]
pub struct DictationState {
    context: OnceLock<Arc<WhisperContext>>,
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

    async fn context(&self, model_path: PathBuf) -> Result<Arc<WhisperContext>, String> {
        if let Some(context) = self.context.get() {
            return Ok(context.clone());
        }

        let loaded_context = tokio::task::spawn_blocking(move || {
            WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
                .map(Arc::new)
                .map_err(|err| format!("Failed to load dictation model: {err}"))
        })
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

    let model_path = ensure_model(&app_handle).await?;
    let context = state.dictation.context(model_path).await?;
    let language = language.unwrap_or_else(|| "en".to_string());

    let samples: Vec<f32> = samples.into_iter().map(|s| (s as f32) / 32768.0).collect();

    let transcript =
        tokio::task::spawn_blocking(move || transcribe_samples(context, samples, language))
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
fn transcribe_samples(
    context: Arc<WhisperContext>,
    samples: Vec<f32>,
    language: String,
) -> Result<String, String> {
    let mut state = context
        .create_state()
        .map_err(|err| format!("Failed to create dictation state: {err}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_n_threads(thread_count());
    params.set_translate(false);
    params.set_language(Some(language.as_str()));
    params.set_no_context(true);
    params.set_no_timestamps(true);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_token_timestamps(false);

    state
        .full(params, &samples[..])
        .map_err(|err| format!("Dictation failed: {err}"))?;

    let num_segments = state.full_n_segments();

    if num_segments == 0 {
        return Ok(String::new());
    }

    let mut segments = Vec::with_capacity(num_segments as usize);
    for index in 0..num_segments {
        let segment = state
            .get_segment(index)
            .ok_or_else(|| format!("Missing dictation segment at index {index}"))?;
        let text = segment
            .to_str_lossy()
            .map_err(|err| format!("Failed to read dictation text: {err}"))?;
        let clean = text.trim();
        if !clean.is_empty() {
            segments.push(clean.to_string());
        }
    }

    let transcript = segments.join(" ");
    Ok(transcript)
}

#[cfg(feature = "dictation")]
fn thread_count() -> i32 {
    std::thread::available_parallelism()
        .map(|count| count.get() as i32)
        .unwrap_or(4)
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

    let model_path = model_dir.join(WHISPER_MODEL_NAME);
    if fs::metadata(&model_path).await.is_ok() {
        return Ok(model_path);
    }

    let download_path = model_dir.join(format!("{WHISPER_MODEL_NAME}.download"));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|err| format!("Failed to create HTTP client: {err}"))?;

    let response = client
        .get(WHISPER_MODEL_URL)
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
        let chunk = chunk.map_err(|err| format!("Failed to download dictation model: {err}"))?;
        downloaded += chunk.len() as u64;
        file.write_all(&chunk)
            .await
            .map_err(|err| format!("Failed to write dictation model: {err}"))?;

        if total_size > 0 {
            let _ = app_handle.emit(
                "dictation-progress",
                serde_json::json!({
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

    Ok(model_path)
}
