mod auth;
mod commands;
mod db;
mod models;
mod tools;
mod providers;

use crate::commands::chat_commands::{chat, chat_stream};
use crate::commands::config_commands::cancel_chat;
use crate::commands::model_commands::{cancel_pull, delete_model, get_local_models, pull_model};
use crate::commands::tool_commands::{approve_tool, list_tools, toggle_tool};
use crate::commands::db_commands::{clear_database, execute_sql};

use ollama_rs::Ollama;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::Mutex;
use tauri::Manager;
use tokio::sync::oneshot;
use providers::ProviderSelector;

use tools::SharedToolRegistry;

pub struct PendingApproval {
    pub sender: oneshot::Sender<bool>,
    pub tool_name: String,
}

// Legacy OllamaConfig removed in favor of provider_configs table

pub struct AppState {
    pub db: SqlitePool,
    pub current_generation_id: AtomicUsize,
    pub is_pull_cancelled: AtomicBool,
    pub tool_registry: SharedToolRegistry,
    pub pending_approvals: Mutex<HashMap<String, PendingApproval>>,
    pub provider_selector: ProviderSelector,
}

pub fn ollama_client(state: &tauri::State<'_, AppState>) -> Result<Ollama, String> {
    // This helper is now deprecated, but we keep it for backward compatibility
    // with commands that haven't been refactored yet (like model management).
    // It will return a client for the first enabled Ollama provider.

    let selector = &state.provider_selector;
    let configs = tauri::async_runtime::block_on(selector.get_provider_configs())?;
    let ollama_config = configs.into_iter()
        .find(|c| c.provider_type == providers::ProviderType::OllamaLocal && c.enabled)
        .or_else(|| {
            // Fallback to API if local is disabled? Or just default.
            None
        });

    let base_url = ollama_config
        .and_then(|c| c.ollama_host)
        .unwrap_or_else(|| "http://localhost:11434".to_string());

    Ollama::try_new(base_url).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let db = tauri::async_runtime::block_on(db::connection::init_db(app.handle()))
                .map_err(std::io::Error::other)?;

            app.manage(AppState {
                db: db.clone(),
                current_generation_id: AtomicUsize::new(0),
                is_pull_cancelled: AtomicBool::new(false),
                tool_registry: SharedToolRegistry::new(),
                pending_approvals: Mutex::new(HashMap::new()),
                provider_selector: ProviderSelector::new(db),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_models,
            pull_model,
            delete_model,
            chat_stream,
            chat,
            cancel_chat,
            cancel_pull,
            list_tools,
            toggle_tool,
            approve_tool,
            auth::auth_signup,
            auth::auth_login,
            auth::auth_logout,
            auth::auth_get_current_user,
            auth::auth_update_status,
            commands::provider_commands::get_providers,
            commands::provider_commands::update_provider_config,
            commands::provider_commands::refresh_provider_health,
            clear_database,
            execute_sql,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
