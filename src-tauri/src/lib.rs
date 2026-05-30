mod auth;
mod commands;
mod db;
mod models;
mod providers;
mod title_generator;
mod web_search;

use crate::commands::chat_commands::{chat, chat_stream, generate_chat_title};
use crate::commands::config_commands::cancel_chat;
use crate::commands::dictation::{is_dictation_available, transcribe_audio, DictationState};
use crate::commands::db_commands::{clear_database, execute_sql};
use crate::commands::model_commands::{cancel_pull, delete_model, get_local_models, pull_model};
use providers::ProviderSelector;
use sqlx::SqlitePool;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use tauri::Manager;

pub struct AppState {
    pub db: SqlitePool,
    pub current_generation_id: AtomicUsize,
    pub is_pull_cancelled: AtomicBool,
    pub provider_selector: ProviderSelector,
    pub dictation: DictationState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_supertonic::init())
        .setup(|app| {
            let db = tauri::async_runtime::block_on(db::connection::init_db(app.handle()))
                .map_err(std::io::Error::other)?;

            app.manage(AppState {
                db: db.clone(),
                current_generation_id: AtomicUsize::new(0),
                is_pull_cancelled: AtomicBool::new(false),
                provider_selector: ProviderSelector::new(db),
                dictation: DictationState::new(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_models,
            pull_model,
            delete_model,
            chat_stream,
            chat,
            generate_chat_title,
            is_dictation_available,
            transcribe_audio,
            cancel_chat,
            cancel_pull,
            auth::auth_signup,
            auth::auth_login,
            auth::auth_logout,
            auth::auth_get_current_user,
            auth::auth_update_status,
            commands::provider_commands::get_providers,
            commands::provider_commands::get_provider_and_models,
            commands::provider_commands::update_provider_config,
            clear_database,
            execute_sql,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
