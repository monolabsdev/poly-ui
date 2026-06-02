mod auth;
mod commands;
mod db;
mod error;
mod models;
mod providers;
mod stream_emitter;
mod title_generator;
mod tool_loop;
mod updater;
mod web_search;

use crate::commands::chat_commands::{chat, chat_stream, generate_chat_title};
use crate::commands::config_commands::cancel_chat;
use crate::commands::db_commands::{clear_database, execute_sql};
use crate::commands::dictation::{is_dictation_available, transcribe_audio, DictationState};
use crate::commands::model_commands::{cancel_pull, delete_model, get_local_models, pull_model};
use crate::updater::{check_for_updates, download_update, install_update};
use providers::ProviderSelector;
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::Mutex;
use std::time::Instant;
use tauri::Manager;

pub struct AppState {
    pub db: SqlitePool,
    pub current_generation_id: AtomicUsize,
    pub is_pull_cancelled: AtomicBool,
    pub provider_selector: ProviderSelector,
    pub dictation: DictationState,
    pub last_update_check: Mutex<Option<Instant>>,
    pub update_download_path: Mutex<Option<PathBuf>>,
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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db = tauri::async_runtime::block_on(db::connection::init_db(app.handle()))
                .map_err(std::io::Error::other)?;

            app.manage(AppState {
                db: db.clone(),
                current_generation_id: AtomicUsize::new(0),
                is_pull_cancelled: AtomicBool::new(false),
                provider_selector: ProviderSelector::new(db),
                dictation: DictationState::new(),
                last_update_check: Mutex::new(None),
                update_download_path: Mutex::new(None),
            });

            if let Some(_window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    let _ = _window.set_title_bar_style(tauri::TitleBarStyle::Overlay);
                }


            }

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
            commands::provider_commands::get_provider_models,
            commands::provider_commands::update_provider_config,
            clear_database,
            execute_sql,
            check_for_updates,
            download_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
