use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProfile {
    total_memory_mb: u64,
    available_memory_mb: u64,
    cpu_count: usize,
}

#[tauri::command]
pub fn get_system_profile() -> SystemProfile {
    let mut system = System::new();
    system.refresh_memory();

    SystemProfile {
        total_memory_mb: system.total_memory() / 1024 / 1024,
        available_memory_mb: system.available_memory() / 1024 / 1024,
        cpu_count: std::thread::available_parallelism()
            .map(|count| count.get())
            .unwrap_or(1),
    }
}
