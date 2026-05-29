use crate::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use tokio_stream::StreamExt;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const WHISPER_MODEL_NAME: &str = "ggml-tiny.en.bin";
const WHISPER_MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";

pub struct DictationState {
    context: Mutex<Option<Arc<WhisperContext>>>,
}

impl DictationState {
    pub fn new() -> Self {
        Self {
            context: Mutex::new(None),
        }
    }

    async fn context(&self, model_path: PathBuf) -> Result<Arc<WhisperContext>, String> {
        if let Some(context) = self.context.lock().await.as_ref().cloned() {
            return Ok(context);
        }

        let loaded_context = tokio::task::spawn_blocking(move || {
            WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
                .map(Arc::new)
                .map_err(|err| format!("Failed to load dictation model: {err}"))
        })
        .await
        .map_err(|err| format!("Dictation model load task failed: {err}"))??;

        let mut context = self.context.lock().await;
        if let Some(existing_context) = context.as_ref().cloned() {
            return Ok(existing_context);
        }

        *context = Some(loaded_context.clone());
        Ok(loaded_context)
    }
}

#[tauri::command]
pub async fn transcribe_audio(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
    samples: Vec<f32>,
    sample_rate: u32,
    language: Option<String>,
) -> Result<String, String> {
    if samples.is_empty() {
        return Ok(String::new());
    }

    if sample_rate != 16_000 {
        return Err(format!("Unsupported sample rate: {sample_rate}. Expected 16000."));
    }

    let model_path = ensure_model(&app_handle).await?;
    let context = state.dictation.context(model_path).await?;
    let language = language.unwrap_or_else(|| "en".to_string());

    let transcript = tokio::task::spawn_blocking(move || transcribe_samples(context, samples, language))
        .await
        .map_err(|err| format!("Dictation task failed: {err}"))??;
    eprintln!("[Dictation] returning transcript to frontend: {transcript:?}");
    Ok(transcript)
}

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
    eprintln!("[Dictation] transcript: {transcript:?}");
    Ok(transcript)
}

fn thread_count() -> i32 {
    std::thread::available_parallelism()
        .map(|count| count.get().clamp(1, 4) as i32)
        .unwrap_or(4)
}

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
    let response = reqwest::get(WHISPER_MODEL_URL)
        .await
        .map_err(|err| format!("Failed to download dictation model: {err}"))?
        .error_for_status()
        .map_err(|err| format!("Failed to download dictation model: {err}"))?;

    let mut file = fs::File::create(&download_path)
        .await
        .map_err(|err| format!("Failed to create model file: {err}"))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|err| format!("Failed to download dictation model: {err}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|err| format!("Failed to write dictation model: {err}"))?;
    }

    file.flush()
        .await
        .map_err(|err| format!("Failed to finalize dictation model: {err}"))?;

    fs::rename(&download_path, &model_path)
        .await
        .map_err(|err| format!("Failed to install dictation model: {err}"))?;

    Ok(model_path)
}
