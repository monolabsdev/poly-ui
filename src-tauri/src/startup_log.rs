use std::backtrace::Backtrace;
use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::panic::PanicHookInfo;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

const LOG_DIR_NAME: &str = "Poly UI";
const LOG_FILE_NAME: &str = "startup.log";
static CURRENT_STAGE: LazyLock<Mutex<String>> =
    LazyLock::new(|| Mutex::new("process entry".to_string()));

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|panic_info| {
        write_line(&format!(
            "panic: {} | app_version={} | build={} | stage={}",
            format_panic(panic_info),
            env!("CARGO_PKG_VERSION"),
            build_type(),
            current_stage()
        ));
        write_line(&format!("backtrace: {}", Backtrace::force_capture()));
    }));
}

pub fn log_phase(phase: impl AsRef<str>) {
    let phase = phase.as_ref();
    set_stage(phase);
    write_line(&format!("phase: {phase}"));
}

pub fn log_error(message: impl AsRef<str>) {
    write_line(&format!(
        "error: {} | stage={}",
        message.as_ref(),
        current_stage()
    ));
}

pub fn log_startup_environment() {
    log_phase("startup environment");
    write_line(&format!("app_version: {}", env!("CARGO_PKG_VERSION")));
    write_line(&format!("build_type: {}", build_type()));
    match std::env::current_exe() {
        Ok(path) => write_line(&format!("executable_path: {}", path.display())),
        Err(error) => log_error(format!("executable_path failed: {error}")),
    }
    match std::env::current_dir() {
        Ok(path) => write_line(&format!("current_working_directory: {}", path.display())),
        Err(error) => log_error(format!("current_working_directory failed: {error}")),
    }
    match log_dir() {
        Some(path) => write_line(&format!("startup_log_dir: {}", path.display())),
        None => log_error("startup_log_dir unavailable"),
    }
    #[cfg(target_os = "windows")]
    {
        match dirs::data_dir() {
            Some(path) => write_line(&format!("roaming_data_dir: {}", path.display())),
            None => log_error("roaming_data_dir unavailable"),
        }
        match dirs::data_local_dir() {
            Some(path) => write_line(&format!("local_data_dir: {}", path.display())),
            None => log_error("local_data_dir unavailable"),
        }
    }
}

fn set_stage(stage: &str) {
    if let Ok(mut current) = CURRENT_STAGE.lock() {
        *current = stage.to_string();
    }
}

fn current_stage() -> String {
    CURRENT_STAGE
        .lock()
        .map(|stage| stage.clone())
        .unwrap_or_else(|_| "stage lock poisoned".to_string())
}

pub fn log_path() -> Option<PathBuf> {
    log_dir().map(|dir| dir.join(LOG_FILE_NAME))
}

fn write_line(line: &str) {
    let Some(path) = log_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} {}", timestamp_ms(), line);
    }
}

fn log_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        dirs::data_dir().map(|dir| dir.join(LOG_DIR_NAME).join("logs"))
    }

    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|dir| dir.join("Library").join("Logs").join(LOG_DIR_NAME))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        dirs::data_dir().map(|dir| dir.join(LOG_DIR_NAME).join("logs"))
    }
}

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn build_type() -> &'static str {
    if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    }
}

fn format_panic(panic_info: &PanicHookInfo<'_>) -> String {
    let payload = panic_info
        .payload()
        .downcast_ref::<&str>()
        .copied()
        .or_else(|| {
            panic_info
                .payload()
                .downcast_ref::<String>()
                .map(String::as_str)
        })
        .unwrap_or("unknown panic");

    match panic_info.location() {
        Some(location) => format!(
            "{payload} at {}:{}:{}",
            location.file(),
            location.line(),
            location.column()
        ),
        None => payload.to_string(),
    }
}
