use crate::AppState;
use std::sync::atomic::Ordering;

#[tauri::command]
pub fn cancel_chat(state: tauri::State<'_, AppState>) {
    state.current_generation_id.fetch_add(1, Ordering::SeqCst);
}
