#[cfg(feature = "dictation")]
use crate::AppState;
#[cfg(feature = "dictation")]
use std::path::{Path, PathBuf};
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
const WHISPER_TINY_MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";
#[cfg(feature = "dictation")]
const WHISPER_TINY_MODEL_FILE: &str = "ggml-tiny.en.bin";

#[cfg(feature = "dictation")]
pub struct DictationState {
    transcribe_lock: tokio::sync::Mutex<()>,
}

#[cfg(not(feature = "dictation"))]
pub struct DictationState;

#[cfg(feature = "dictation")]
impl DictationState {
    pub fn new() -> Self {
        Self {
            transcribe_lock: tokio::sync::Mutex::new(()),
        }
    }

    async fn transcribe_once(
        &self,
        model_path: PathBuf,
        samples: Vec<i16>,
        language: Option<String>,
    ) -> Result<String, String> {
        let _guard = self.transcribe_lock.lock().await;
        tokio::task::spawn_blocking(move || transcribe_with_whisper(&model_path, samples, language))
            .await
            .map_err(|err| format!("Dictation task failed: {err}"))?
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
    state
        .dictation
        .transcribe_once(model_path, samples, language)
        .await
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

    let model_path = model_dir.join(WHISPER_TINY_MODEL_FILE);
    if fs::metadata(&model_path).await.is_ok() {
        return Ok(model_path);
    }

    let download_path = model_dir.join(format!("{WHISPER_TINY_MODEL_FILE}.download"));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|err| format!("Failed to create HTTP client: {err}"))?;

    let response = client
        .get(WHISPER_TINY_MODEL_URL)
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
                    "file": WHISPER_TINY_MODEL_FILE,
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

#[cfg(feature = "dictation")]
fn transcribe_with_whisper(
    model_path: &Path,
    samples: Vec<i16>,
    language: Option<String>,
) -> Result<String, String> {
    let model_path = model_path
        .to_str()
        .ok_or_else(|| "Dictation model path is not valid UTF-8".to_string())?;
    let context = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|err| format!("Failed to load dictation model: {err}"))?;
    let mut state = context
        .create_state()
        .map_err(|err| format!("Failed to create dictation state: {err}"))?;

    let mut audio = vec![0.0_f32; samples.len()];
    whisper_rs::convert_integer_to_float_audio(&samples, &mut audio)
        .map_err(|err| format!("Failed to prepare dictation audio: {err}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 0 });
    params.set_n_threads(1);
    params.set_translate(false);
    params.set_language(language.as_deref().or(Some("en")));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state
        .full(params, &audio)
        .map_err(|err| format!("Dictation failed: {err}"))?;

    Ok(state
        .as_iter()
        .map(|segment| segment.to_string())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string())
}
