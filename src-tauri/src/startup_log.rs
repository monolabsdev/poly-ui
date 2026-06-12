use std::backtrace::Backtrace;
use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::panic::PanicHookInfo;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const LOG_DIR_NAME: &str = "Poly UI";
const LOG_FILE_NAME: &str = "startup.log";

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|panic_info| {
        write_line(&format!("panic: {}", format_panic(panic_info)));
        if std::env::var_os("RUST_BACKTRACE").is_some() {
            write_line(&format!("backtrace: {}", Backtrace::force_capture()));
        }
    }));
}

pub fn log_phase(phase: impl AsRef<str>) {
    write_line(&format!("phase: {}", phase.as_ref()));
}

pub fn log_error(message: impl AsRef<str>) {
    write_line(&format!("error: {}", message.as_ref()));
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
        return dirs::data_dir().map(|dir| dir.join(LOG_DIR_NAME).join("logs"));
    }

    #[cfg(target_os = "macos")]
    {
        return dirs::home_dir().map(|dir| dir.join("Library").join("Logs").join(LOG_DIR_NAME));
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

fn format_panic(panic_info: &PanicHookInfo<'_>) -> String {
    let payload = panic_info
        .payload()
        .downcast_ref::<&str>()
        .copied()
        .or_else(|| panic_info.payload().downcast_ref::<String>().map(String::as_str))
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
