use crate::whisper_state::WhisperState;
use futures::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncWriteExt;
use whisper_rs::{FullParams, SamplingStrategy};

const SELECTED_MODEL_FILE: &str = "whisper-selected-model.txt";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperModelInfo {
    id: &'static str,
    name: &'static str,
    filename: &'static str,
    download_url: &'static str,
    size_label: &'static str,
    speed_label: &'static str,
    quality_label: &'static str,
    description: &'static str,
    recommended: bool,
    installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperModelsStatus {
    models: Vec<WhisperModelInfo>,
    selected_model_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperDownloadProgress {
    model_id: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
}

struct WhisperModelDef {
    id: &'static str,
    name: &'static str,
    filename: &'static str,
    download_url: &'static str,
    size_label: &'static str,
    speed_label: &'static str,
    quality_label: &'static str,
    description: &'static str,
    recommended: bool,
}

fn whisper_models() -> &'static [WhisperModelDef] {
    &[
        WhisperModelDef {
            id: "base.en",
            name: "Base English",
            filename: "ggml-base.en.bin",
            download_url:
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin?download=true",
            size_label: "142 MB",
            speed_label: "Fast",
            quality_label: "Good",
            description: "Best first install for quick English dictation.",
            recommended: true,
        },
        WhisperModelDef {
            id: "small.en",
            name: "Small English",
            filename: "ggml-small.en.bin",
            download_url:
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin?download=true",
            size_label: "466 MB",
            speed_label: "Medium",
            quality_label: "Better",
            description: "Higher accuracy while still practical on most machines.",
            recommended: false,
        },
        WhisperModelDef {
            id: "large-v3-turbo-q5_0",
            name: "Large v3 Turbo Q5",
            filename: "ggml-large-v3-turbo-q5_0.bin",
            download_url:
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true",
            size_label: "547 MB",
            speed_label: "Slower",
            quality_label: "High",
            description: "Strong quality with much smaller disk use than full Turbo.",
            recommended: false,
        },
        WhisperModelDef {
            id: "large-v3-turbo",
            name: "Large v3 Turbo",
            filename: "ggml-large-v3-turbo.bin",
            download_url:
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin?download=true",
            size_label: "1.5 GB",
            speed_label: "Slowest",
            quality_label: "Highest",
            description: "Best accuracy option; needs more disk, RAM, and patience.",
            recommended: false,
        },
    ]
}

fn model_by_id(model_id: &str) -> Result<&'static WhisperModelDef, String> {
    whisper_models()
        .iter()
        .find(|model| model.id == model_id)
        .ok_or_else(|| format!("Unknown Whisper model: {model_id}"))
}

fn models_dir(state: &WhisperState) -> PathBuf {
    state.app_data_dir().join("models")
}

fn selected_model_path(state: &WhisperState) -> PathBuf {
    models_dir(state).join(SELECTED_MODEL_FILE)
}

fn installed_path(state: &WhisperState, model: &WhisperModelDef) -> PathBuf {
    models_dir(state).join(model.filename)
}

fn read_selected_model_id(state: &WhisperState) -> Result<Option<String>, String> {
    let path = selected_model_path(state);
    if !path.exists() {
        return Ok(None);
    }

    let model_id = std::fs::read_to_string(path)
        .map_err(|error| error.to_string())?
        .trim()
        .to_string();
    let model = model_by_id(&model_id)?;

    if !installed_path(state, model).exists() {
        return Err(format!(
            "Selected Whisper model is missing: {}",
            model.filename
        ));
    }

    Ok(Some(model_id))
}

fn write_selected_model_id(state: &WhisperState, model_id: &str) -> Result<(), String> {
    std::fs::create_dir_all(models_dir(state)).map_err(|error| error.to_string())?;
    std::fs::write(selected_model_path(state), model_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_whisper_models_status(
    state: State<'_, WhisperState>,
) -> Result<WhisperModelsStatus, String> {
    let models_path = models_dir(&state);
    let selected_model_id = read_selected_model_id(&state)?;
    let models = whisper_models()
        .iter()
        .map(|model| WhisperModelInfo {
            id: model.id,
            name: model.name,
            filename: model.filename,
            download_url: model.download_url,
            size_label: model.size_label,
            speed_label: model.speed_label,
            quality_label: model.quality_label,
            description: model.description,
            recommended: model.recommended,
            installed: models_path.join(model.filename).exists(),
        })
        .collect();

    Ok(WhisperModelsStatus {
        models,
        selected_model_id,
    })
}

#[tauri::command]
pub fn select_whisper_model(
    model_id: String,
    state: State<'_, WhisperState>,
) -> Result<(), String> {
    let model = model_by_id(&model_id)?;
    if !installed_path(&state, model).exists() {
        return Err(format!("Whisper model is not installed: {}", model.name));
    }

    write_selected_model_id(&state, model.id)
}

#[tauri::command]
pub fn release_whisper_model(
    state: State<'_, WhisperState>,
) -> Result<(), String> {
    state.release_model();
    Ok(())
}

#[tauri::command]
pub async fn download_whisper_model(
    app_handle: AppHandle,
    model_id: String,
    state: State<'_, WhisperState>,
) -> Result<(), String> {
    let model = model_by_id(&model_id)?;
    let model_dir = models_dir(&state);
    tokio::fs::create_dir_all(&model_dir)
        .await
        .map_err(|error| error.to_string())?;

    let destination = installed_path(&state, model);
    let partial = destination.with_extension("bin.part");

    if partial.exists() {
        tokio::fs::remove_file(&partial)
            .await
            .map_err(|error| error.to_string())?;
    }

    let response = reqwest::get(model.download_url)
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let total_bytes = response.content_length();
    let mut file = tokio::fs::File::create(&partial)
        .await
        .map_err(|error| error.to_string())?;
    let mut downloaded_bytes = 0_u64;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        file.write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;
        downloaded_bytes += chunk.len() as u64;
        app_handle
            .emit(
                "whisper-model-download-progress",
                WhisperDownloadProgress {
                    model_id: model.id.to_string(),
                    downloaded_bytes,
                    total_bytes,
                },
            )
            .map_err(|error| error.to_string())?;
    }

    file.flush().await.map_err(|error| error.to_string())?;
    drop(file);

    if let Some(total) = total_bytes {
        if downloaded_bytes != total {
            return Err(format!(
                "Whisper model download incomplete: expected {total} bytes, got {downloaded_bytes}"
            ));
        }
    }

    tokio::fs::rename(&partial, &destination)
        .await
        .map_err(|error| error.to_string())?;
    write_selected_model_id(&state, model.id)?;

    Ok(())
}

#[tauri::command]
pub fn transcribe_audio(
    audio_samples: Vec<f32>,
    language: Option<String>,
    state: State<'_, WhisperState>,
) -> Result<String, String> {
    let selected_model_id = read_selected_model_id(&state)?
        .ok_or_else(|| "Install a Whisper model before dictation.".to_string())?;
    let model = model_by_id(&selected_model_id)?;
    let model_path = installed_path(&state, model);

    state.with_context(model.id, model_path, |context| {
        let mut whisper_state = context.create_state().map_err(|error| error.to_string())?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        params.set_language(language.as_deref());
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        whisper_state
            .full(params, &audio_samples)
            .map_err(|error| error.to_string())?;

        let transcript = whisper_state
            .as_iter()
            .map(|segment| segment.to_string())
            .collect::<Vec<_>>()
            .join("");

        Ok(transcript.trim().to_string())
    })
}
