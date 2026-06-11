use std::path::PathBuf;
use std::sync::Mutex;
use whisper_rs::{WhisperContext, WhisperContextParameters};

pub struct WhisperState {
    app_data_dir: PathBuf,
    context: Mutex<Option<LoadedWhisperContext>>,
}

struct LoadedWhisperContext {
    model_id: String,
    context: WhisperContext,
}

impl WhisperState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            app_data_dir,
            context: Mutex::new(None),
        }
    }

    pub fn app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }

    pub fn with_context<T>(
        &self,
        model_id: &str,
        model_path: PathBuf,
        transcribe: impl FnOnce(&WhisperContext) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut loaded = self
            .context
            .lock()
            .map_err(|_| "Whisper context lock poisoned".to_string())?;

        let should_load = loaded
            .as_ref()
            .map(|current| current.model_id != model_id)
            .unwrap_or(true);

        if should_load {
            let path = model_path
                .to_str()
                .ok_or_else(|| "Whisper model path is not valid UTF-8".to_string())?;
            let context =
                WhisperContext::new_with_params(path, WhisperContextParameters::default())
                    .map_err(|error| error.to_string())?;

            *loaded = Some(LoadedWhisperContext {
                model_id: model_id.to_string(),
                context,
            });
        }

        let loaded_context = loaded
            .as_ref()
            .ok_or_else(|| "Whisper model is not loaded".to_string())?;

        transcribe(&loaded_context.context)
    }
}
