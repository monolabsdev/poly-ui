use crate::startup_log;
use crate::whisper_state::WhisperState;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncWriteExt;
use whisper_rs::{FullParams, SamplingStrategy};

const SELECTED_MODEL_FILE: &str = "whisper-selected-model.txt";
const WHISPER_SAMPLE_RATE: f32 = 16_000.0;
const MIN_AUDIO_SAMPLES: usize = 4_800;
const MIN_AUDIO_RMS: f32 = 0.001;
const MIN_AUDIO_PEAK: f32 = 0.01;
const MIN_ACTIVE_AUDIO_RATIO: f32 = 0.005;
const CLIPPING_THRESHOLD: f32 = 0.999;
static LAST_AUDIO_HASH: LazyLock<Mutex<Option<String>>> = LazyLock::new(|| Mutex::new(None));

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationAudioMeta {
    recorder_mime_type: Option<String>,
    blob_type: Option<String>,
    blob_size: Option<u64>,
    chunk_count: Option<usize>,
    chunk_sizes: Option<Vec<u64>>,
    source_sample_rate: Option<u32>,
    source_channel_count: Option<u32>,
    decoded_length: Option<usize>,
    decoded_duration_seconds: Option<f32>,
    target_sample_rate: Option<u32>,
    sample_format: Option<String>,
    track_label: Option<String>,
    track_settings: Option<serde_json::Value>,
    audio_inputs: Option<Vec<String>>,
    frontend_stats: Option<serde_json::Value>,
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

#[derive(Clone, Copy, Debug)]
struct AudioStats {
    sample_count: usize,
    finite_count: usize,
    nan_count: usize,
    infinite_count: usize,
    clipped_count: usize,
    zero_count: usize,
    min: f32,
    max: f32,
    rms: f32,
    peak: f32,
    active_ratio: f32,
}

fn audio_stats(samples: &[f32]) -> AudioStats {
    if samples.is_empty() {
        return AudioStats {
            sample_count: 0,
            finite_count: 0,
            nan_count: 0,
            infinite_count: 0,
            clipped_count: 0,
            zero_count: 0,
            min: 0.0,
            max: 0.0,
            rms: 0.0,
            peak: 0.0,
            active_ratio: 0.0,
        };
    }

    let mut sum_squares = 0.0_f32;
    let mut peak = 0.0_f32;
    let mut active_samples = 0_usize;
    let mut finite_count = 0_usize;
    let mut nan_count = 0_usize;
    let mut infinite_count = 0_usize;
    let mut clipped_count = 0_usize;
    let mut zero_count = 0_usize;
    let mut min = f32::INFINITY;
    let mut max = f32::NEG_INFINITY;

    for sample in samples {
        if sample.is_nan() {
            nan_count += 1;
            continue;
        }
        if !sample.is_finite() {
            infinite_count += 1;
            continue;
        }

        let abs = sample.abs();
        finite_count += 1;
        min = min.min(*sample);
        max = max.max(*sample);
        peak = peak.max(abs);
        sum_squares += sample * sample;
        if *sample == 0.0 {
            zero_count += 1;
        }
        if abs >= CLIPPING_THRESHOLD {
            clipped_count += 1;
        }
        if abs >= MIN_AUDIO_PEAK {
            active_samples += 1;
        }
    }

    AudioStats {
        sample_count: samples.len(),
        finite_count,
        nan_count,
        infinite_count,
        clipped_count,
        zero_count,
        min: if finite_count > 0 { min } else { 0.0 },
        max: if finite_count > 0 { max } else { 0.0 },
        rms: if finite_count > 0 {
            (sum_squares / finite_count as f32).sqrt()
        } else {
            0.0
        },
        peak,
        active_ratio: if finite_count > 0 {
            active_samples as f32 / finite_count as f32
        } else {
            0.0
        },
    }
}

fn has_audible_audio(stats: AudioStats) -> bool {
    stats.rms >= MIN_AUDIO_RMS
        && stats.peak >= MIN_AUDIO_PEAK
        && stats.active_ratio >= MIN_ACTIVE_AUDIO_RATIO
}

fn sanitize_audio_samples(samples: &mut [f32]) {
    for sample in samples {
        if !sample.is_finite() {
            *sample = 0.0;
        } else {
            *sample = sample.clamp(-1.0, 1.0);
        }
    }
}

fn audio_hash(samples: &[f32]) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    for sample in samples {
        hasher.update(sample.to_le_bytes());
    }
    format!("{:x}", hasher.finalize())
}

fn mark_reused_audio(hash: &str) -> bool {
    let Ok(mut previous) = LAST_AUDIO_HASH.lock() else {
        return false;
    };
    let reused = previous.as_deref() == Some(hash);
    *previous = Some(hash.to_string());
    reused
}

fn sample_window(samples: &[f32], from_start: bool) -> String {
    let iter: Box<dyn Iterator<Item = &f32>> = if from_start {
        Box::new(samples.iter().take(20))
    } else {
        Box::new(samples.iter().rev().take(20))
    };
    let mut values = iter
        .map(|sample| format!("{sample:.6}"))
        .collect::<Vec<_>>();
    if !from_start {
        values.reverse();
    }
    format!("[{}]", values.join(", "))
}

fn save_debug_wav(
    app_data_dir: &std::path::Path,
    samples: &[f32],
    hash: &str,
) -> Result<PathBuf, String> {
    let dir = app_data_dir.join("dictation-debug");
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let path = dir.join(format!("whisper-input-{timestamp}-{}.wav", &hash[..12]));
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: WHISPER_SAMPLE_RATE as u32,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };
    let mut writer = hound::WavWriter::create(&path, spec).map_err(|error| error.to_string())?;
    for sample in samples {
        writer
            .write_sample(*sample)
            .map_err(|error| error.to_string())?;
    }
    writer.finalize().map_err(|error| error.to_string())?;
    let _ = std::fs::copy(&path, dir.join("last-whisper-input.wav"));
    Ok(path)
}

fn log_dictation(message: impl AsRef<str>) {
    let message = format!("dictation: {}", message.as_ref());
    startup_log::log_event(&message);
    log::info!("{message}");
}

fn log_audio_meta(meta: Option<&DictationAudioMeta>) {
    let Some(meta) = meta else {
        log_dictation("frontend meta: missing");
        return;
    };

    log_dictation(format!(
        "frontend meta: recorder={} blob_type={} blob_size={:?} chunks={:?} chunk_sizes={:?} decoded_rate={:?} decoded_channels={:?} decoded_len={:?} decoded_duration={:?} target_rate={:?} sample_format={} track_label={} track_settings={} audio_inputs={:?} frontend_stats={}",
        meta.recorder_mime_type.as_deref().unwrap_or("unknown"),
        meta.blob_type.as_deref().unwrap_or("unknown"),
        meta.blob_size,
        meta.chunk_count,
        meta.chunk_sizes,
        meta.source_sample_rate,
        meta.source_channel_count,
        meta.decoded_length,
        meta.decoded_duration_seconds,
        meta.target_sample_rate,
        meta.sample_format.as_deref().unwrap_or("unknown"),
        meta.track_label.as_deref().unwrap_or("unknown"),
        meta.track_settings.as_ref().map(|value| value.to_string()).unwrap_or_else(|| "null".to_string()),
        meta.audio_inputs,
        meta.frontend_stats.as_ref().map(|value| value.to_string()).unwrap_or_else(|| "null".to_string()),
    ));
}

fn log_audio_stats(
    stats: AudioStats,
    hash: &str,
    reused: bool,
    debug_wav: &std::path::Path,
    samples: &[f32],
) {
    let duration_s = stats.sample_count as f32 / WHISPER_SAMPLE_RATE;
    log_dictation(format!(
        "whisper input: sample_rate={} channels=1 format=f32 normalized_range=-1..1 samples={} duration={:.3}s min={:.6} max={:.6} rms={:.6} peak={:.6} active_ratio={:.4} finite={} nan={} infinite={} clipped={} zero={} all_zero={} hash={} reused={} wav={}",
        WHISPER_SAMPLE_RATE as u32,
        stats.sample_count,
        duration_s,
        stats.min,
        stats.max,
        stats.rms,
        stats.peak,
        stats.active_ratio,
        stats.finite_count,
        stats.nan_count,
        stats.infinite_count,
        stats.clipped_count,
        stats.zero_count,
        stats.finite_count == stats.zero_count,
        &hash[..12],
        reused,
        debug_wav.display(),
    ));
    log_dictation(format!(
        "whisper input first20={}",
        sample_window(samples, true)
    ));
    log_dictation(format!(
        "whisper input last20={}",
        sample_window(samples, false)
    ));
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
pub fn release_whisper_model(state: State<'_, WhisperState>) -> Result<(), String> {
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
    mut audio_samples: Vec<f32>,
    language: Option<String>,
    audio_meta: Option<DictationAudioMeta>,
    state: State<'_, WhisperState>,
) -> Result<String, String> {
    log_audio_meta(audio_meta.as_ref());
    let pre_sanitize_stats = audio_stats(&audio_samples);
    if pre_sanitize_stats.nan_count > 0
        || pre_sanitize_stats.infinite_count > 0
        || pre_sanitize_stats.clipped_count > 0
    {
        log_dictation(format!(
            "input sanitize: nan={} infinite={} clipped={}",
            pre_sanitize_stats.nan_count,
            pre_sanitize_stats.infinite_count,
            pre_sanitize_stats.clipped_count,
        ));
        sanitize_audio_samples(&mut audio_samples);
    }

    let hash = audio_hash(&audio_samples);
    let reused = mark_reused_audio(&hash);
    let debug_wav = save_debug_wav(state.app_data_dir(), &audio_samples, &hash)?;
    let stats = audio_stats(&audio_samples);
    log_audio_stats(stats, &hash, reused, &debug_wav, &audio_samples);

    let duration_s = audio_samples.len() as f32 / WHISPER_SAMPLE_RATE;

    // Reject audio shorter than ~0.3s — insufficient for reliable transcription
    if audio_samples.len() < MIN_AUDIO_SAMPLES {
        log_dictation(format!(
            "transcribe_audio: audio too short ({} samples, {:.2}s), returning empty",
            audio_samples.len(),
            duration_s
        ));
        return Ok(String::new());
    }

    let stats = audio_stats(&audio_samples);
    if !has_audible_audio(stats) {
        log_dictation(format!(
            "transcribe_audio: audio too quiet (rms={:.5}, peak={:.5}, active={:.4}), returning empty",
            stats.rms,
            stats.peak,
            stats.active_ratio,
        ));
        return Ok(String::new());
    }

    // Force English for dictation; auto-detection is unreliable on short clips
    // and is the primary cause of hallucinated single-token outputs like "you".
    let effective_language = match language.as_deref() {
        Some(lang) if lang != "auto" => Some(lang),
        _ => Some("en"),
    };

    let selected_model_id = read_selected_model_id(&state)?
        .ok_or_else(|| "Install a Whisper model before dictation.".to_string())?;
    let model = model_by_id(&selected_model_id)?;
    let model_path = installed_path(&state, model);

    state.with_context(model.id, model_path, |context| {
        let mut whisper_state = context.create_state().map_err(|error| error.to_string())?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        params.set_language(effective_language);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_no_context(true);
        params.set_no_timestamps(true);
        params.set_suppress_nst(true);

        whisper_state
            .full(params, &audio_samples)
            .map_err(|error| error.to_string())?;

        // Diagnostic: detected language
        let lang_id = whisper_state.full_lang_id_from_state();
        let lang_name = whisper_rs::get_lang_str(lang_id).unwrap_or("unknown");
        log_dictation(format!(
            "transcribe_audio: {} samples ({:.2}s), lang={}, segments={}",
            audio_samples.len(),
            duration_s,
            lang_name,
            whisper_state.full_n_segments(),
        ));

        let mut transcript_parts: Vec<String> = Vec::new();
        let n_segments = whisper_state.full_n_segments();

        for seg_idx in 0..n_segments {
            let segment = whisper_state
                .get_segment(seg_idx)
                .ok_or_else(|| "Failed to read segment".to_string())?;

            let text = segment
                .to_str_lossy()
                .map_err(|_| "Failed to read segment text".to_string())?
                .to_string();
            let no_speech_prob = segment.no_speech_probability();
            let n_tokens = segment.n_tokens();

            let mut total_logprob = 0.0_f32;
            for tok_idx in 0..n_tokens {
                if let Some(token) = segment.get_token(tok_idx) {
                    total_logprob += token.token_data().plog;
                }
            }
            let avg_logprob = if n_tokens > 0 {
                total_logprob / n_tokens as f32
            } else {
                -10.0
            };

            log_dictation(format!(
                "  seg[{}]: \"{}\" tokens={} no_speech={:.4} avg_logprob={:.4}",
                seg_idx, text, n_tokens, no_speech_prob, avg_logprob
            ));

            if no_speech_prob > 0.5 {
                log_dictation(format!(
                    "  seg[{}] rejected: no_speech_prob={:.4} > 0.5",
                    seg_idx, no_speech_prob
                ));
                continue;
            }

            if avg_logprob < -2.0 {
                log_dictation(format!(
                    "  seg[{}] rejected: avg_logprob={:.4} < -2.0",
                    seg_idx, avg_logprob
                ));
                continue;
            }

            transcript_parts.push(text);
        }

        let transcript = transcript_parts.join("").trim().to_string();
        log_dictation(format!("  final: \"{}\"", transcript));

        Ok(transcript)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quiet_audio_is_not_transcribed() {
        let samples = vec![0.0002; MIN_AUDIO_SAMPLES];
        assert!(!has_audible_audio(audio_stats(&samples)));
    }

    #[test]
    fn audible_audio_is_transcribed() {
        let samples = vec![0.02; MIN_AUDIO_SAMPLES];
        assert!(has_audible_audio(audio_stats(&samples)));
    }

    #[test]
    fn isolated_click_is_not_transcribed() {
        let mut samples = vec![0.0; MIN_AUDIO_SAMPLES];
        samples[0] = 1.0;
        assert!(!has_audible_audio(audio_stats(&samples)));
    }

    #[test]
    fn sanitize_audio_removes_invalid_samples() {
        let mut samples = vec![f32::NAN, f32::INFINITY, 2.0, -2.0, 0.5];
        sanitize_audio_samples(&mut samples);
        assert_eq!(samples, vec![0.0, 0.0, 1.0, -1.0, 0.5]);
    }
}
